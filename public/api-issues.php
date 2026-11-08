<?php
/**
 * YesOrNo - Relational SQLite Persistence & Cloud Sync API
 * 
 * Provides atomic relational storage (SQLite via PDO) with WAL mode,
 * granular write endpoints (vote, reply, react, delete), and
 * backward-compatible batch sync for the local-first client.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

$dbPath = $dataDir . '/yesorno.sqlite';
$jsonFallbackPath = $dataDir . '/issues.json';
$profilesFallbackPath = $dataDir . '/user_profiles.json';

// Initialize SQLite connection or fallback
function get_database_connection($dbPath, $jsonFallbackPath) {
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers())) {
        return null;
    }

    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // High-concurrency WAL mode & foreign key integrity
        $pdo->exec('PRAGMA journal_mode = WAL;');
        $pdo->exec('PRAGMA synchronous = NORMAL;');
        $pdo->exec('PRAGMA foreign_keys = ON;');

        // Create normalized tables if not present
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS issues (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                region TEXT,
                tags TEXT,
                author TEXT NOT NULL,
                creator_id TEXT,
                creator_email TEXT,
                is_anonymous_author INTEGER DEFAULT 0,
                closing_date TEXT,
                duration_label TEXT,
                visibility TEXT DEFAULT 'public',
                invited_emails TEXT,
                invited_groups TEXT,
                yes_count INTEGER DEFAULT 0,
                no_count INTEGER DEFAULT 0,
                likes_count INTEGER DEFAULT 0,
                favorites_count INTEGER DEFAULT 0,
                images TEXT,
                creator_voice_note TEXT,
                featured INTEGER DEFAULT 0,
                summary TEXT,
                is_deleted INTEGER DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS responses (
                id TEXT PRIMARY KEY,
                issue_id TEXT NOT NULL,
                choice TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_email TEXT,
                author_alias TEXT,
                author_role TEXT,
                is_anonymous INTEGER DEFAULT 0,
                note TEXT,
                voice_note TEXT,
                likes_count INTEGER DEFAULT 0,
                is_reported INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS replies (
                id TEXT PRIMARY KEY,
                submission_id TEXT NOT NULL,
                issue_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                author_email TEXT,
                author_alias TEXT,
                author_role TEXT,
                is_anonymous INTEGER DEFAULT 0,
                content TEXT NOT NULL,
                reply_to_name TEXT,
                likes_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY(submission_id) REFERENCES responses(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reactions (
                id TEXT PRIMARY KEY,
                target_type TEXT NOT NULL, -- 'comment' | 'reply'
                target_id TEXT NOT NULL,
                user_key TEXT NOT NULL,
                emoji TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(target_type, target_id, user_key, emoji)
            );

            CREATE TABLE IF NOT EXISTS user_profiles (
                email TEXT PRIMARY KEY,
                user_data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_issues_updated ON issues(updated_at);
            CREATE INDEX IF NOT EXISTS idx_responses_issue ON responses(issue_id);
            CREATE INDEX IF NOT EXISTS idx_replies_sub ON replies(submission_id);
            CREATE INDEX IF NOT EXISTS idx_reactions_target ON reactions(target_type, target_id);
            CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
        ");

        // Migrate existing JSON data if SQLite database is completely fresh
        $checkStmt = $pdo->query("SELECT COUNT(*) FROM issues");
        if ($checkStmt && (int)$checkStmt->fetchColumn() === 0 && file_exists($jsonFallbackPath)) {
            $jsonRaw = @file_get_contents($jsonFallbackPath);
            if ($jsonRaw) {
                $seedIssues = json_decode($jsonRaw, true);
                if (is_array($seedIssues) && count($seedIssues) > 0) {
                    save_batch_issues_sqlite($pdo, $seedIssues);
                }
            }
        }

        return $pdo;
    } catch (Exception $e) {
        error_log('SQLite Init Error: ' . $e->getMessage());
        return null;
    }
}

// Hydrates issues with responses, replies, and reactions into the expected frontend format
function fetch_hydrated_issues_sqlite(PDO $pdo, $since = null) {
    $sql = "SELECT * FROM issues WHERE is_deleted = 0";
    $params = [];
    if ($since) {
        $sql .= " AND updated_at >= :since";
        $params[':since'] = $since;
    }
    $sql .= " ORDER BY created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $issueRows = $stmt->fetchAll();

    if (empty($issueRows)) {
        return [];
    }

    $issueIds = array_column($issueRows, 'id');
    $inPlaceholders = implode(',', array_fill(0, count($issueIds), '?'));

    // Fetch all responses for these issues
    $respStmt = $pdo->prepare("SELECT * FROM responses WHERE issue_id IN ($inPlaceholders) ORDER BY created_at ASC");
    $respStmt->execute($issueIds);
    $allResponses = $respStmt->fetchAll();

    // Fetch all replies for these issues
    $replyStmt = $pdo->prepare("SELECT * FROM replies WHERE issue_id IN ($inPlaceholders) ORDER BY created_at ASC");
    $replyStmt->execute($issueIds);
    $allReplies = $replyStmt->fetchAll();

    // Fetch all reactions
    $reactStmt = $pdo->query("
        SELECT target_type, target_id, emoji, COUNT(*) as cnt, GROUP_CONCAT(user_key) as user_keys
        FROM reactions
        GROUP BY target_type, target_id, emoji
    ");
    $allReactions = $reactStmt ? $reactStmt->fetchAll() : [];

    // Group reactions by target_id -> emoji -> count & users
    $reactionsByTarget = [];
    $userReactionsByTarget = [];
    foreach ($allReactions as $r) {
        $tid = $r['target_id'];
        $emoji = $r['emoji'];
        $cnt = (int)$r['cnt'];
        $users = explode(',', $r['user_keys']);

        if (!isset($reactionsByTarget[$tid])) $reactionsByTarget[$tid] = [];
        if (!isset($userReactionsByTarget[$tid])) $userReactionsByTarget[$tid] = [];

        $reactionsByTarget[$tid][$emoji] = $cnt;
        $userReactionsByTarget[$tid][$emoji] = $users;
    }

    // Group replies by submission_id
    $repliesBySubmission = [];
    foreach ($allReplies as $rep) {
        $subId = $rep['submission_id'];
        if (!isset($repliesBySubmission[$subId])) {
            $repliesBySubmission[$subId] = [];
        }
        $rid = $rep['id'];
        $repliesBySubmission[$subId][] = [
            'id' => $rep['id'],
            'submissionId' => $rep['submission_id'],
            'authorName' => $rep['author_name'],
            'authorEmail' => $rep['author_email'],
            'authorAlias' => $rep['author_alias'],
            'authorRole' => $rep['author_role'],
            'isAnonymous' => (bool)$rep['is_anonymous'],
            'content' => $rep['content'],
            'replyToName' => $rep['reply_to_name'],
            'likesCount' => (int)$rep['likes_count'],
            'createdAt' => $rep['created_at'],
            'reactions' => isset($reactionsByTarget[$rid]) ? $reactionsByTarget[$rid] : [],
            'userReactions' => isset($userReactionsByTarget[$rid]) ? $userReactionsByTarget[$rid] : [],
        ];
    }

    // Group responses by issue_id
    $responsesByIssue = [];
    foreach ($allResponses as $resp) {
        $issId = $resp['issue_id'];
        $respId = $resp['id'];
        if (!isset($responsesByIssue[$issId])) {
            $responsesByIssue[$issId] = [];
        }

        $voiceNote = null;
        if (!empty($resp['voice_note'])) {
            $voiceNote = json_decode($resp['voice_note'], true);
        }

        $responsesByIssue[$issId][] = [
            'id' => $resp['id'],
            'issueId' => $resp['issue_id'],
            'choice' => $resp['choice'],
            'authorName' => $resp['author_name'],
            'authorEmail' => $resp['author_email'],
            'authorAlias' => $resp['author_alias'],
            'authorRole' => $resp['author_role'],
            'isAnonymous' => (bool)$resp['is_anonymous'],
            'note' => $resp['note'],
            'voiceNote' => $voiceNote,
            'likesCount' => (int)$resp['likes_count'],
            'isReported' => (bool)$resp['is_reported'],
            'createdAt' => $resp['created_at'],
            'replies' => isset($repliesBySubmission[$respId]) ? $repliesBySubmission[$respId] : [],
            'reactions' => isset($reactionsByTarget[$respId]) ? $reactionsByTarget[$respId] : [],
            'userReactions' => isset($userReactionsByTarget[$respId]) ? $userReactionsByTarget[$respId] : [],
        ];
    }

    // Format output issues
    $output = [];
    foreach ($issueRows as $row) {
        $id = $row['id'];
        $tags = !empty($row['tags']) ? json_decode($row['tags'], true) : [];
        $invitedEmails = !empty($row['invited_emails']) ? json_decode($row['invited_emails'], true) : [];
        $invitedGroups = !empty($row['invited_groups']) ? json_decode($row['invited_groups'], true) : [];
        $images = !empty($row['images']) ? json_decode($row['images'], true) : [];
        $creatorVoice = !empty($row['creator_voice_note']) ? json_decode($row['creator_voice_note'], true) : null;
        $summary = !empty($row['summary']) ? json_decode($row['summary'], true) : null;

        $output[] = [
            'id' => $row['id'],
            'title' => $row['title'],
            'description' => $row['description'] ?: '',
            'category' => $row['category'],
            'region' => $row['region'] ?: 'Global / Remote',
            'tags' => is_array($tags) ? $tags : [],
            'author' => $row['author'],
            'creatorId' => $row['creator_id'],
            'creatorEmail' => $row['creator_email'],
            'isAnonymousAuthor' => (bool)$row['is_anonymous_author'],
            'closingDate' => $row['closing_date'],
            'durationLabel' => $row['duration_label'] ?: '24 Hours',
            'visibility' => $row['visibility'] ?: 'public',
            'invitedEmails' => is_array($invitedEmails) ? $invitedEmails : [],
            'invitedGroups' => is_array($invitedGroups) ? $invitedGroups : [],
            'yesCount' => (int)$row['yes_count'],
            'noCount' => (int)$row['no_count'],
            'likesCount' => (int)$row['likes_count'],
            'favoritesCount' => (int)$row['favorites_count'],
            'images' => is_array($images) ? $images : [],
            'creatorVoiceNote' => $creatorVoice,
            'featured' => (bool)$row['featured'],
            'summary' => $summary,
            'isDeletedByAuthor' => (bool)$row['is_deleted'],
            'deletedAt' => $row['deleted_at'],
            'createdAt' => $row['created_at'],
            'responses' => isset($responsesByIssue[$id]) ? $responsesByIssue[$id] : [],
        ];
    }

    return $output;
}

// Saves/upserts a list of issues into SQLite within an atomic transaction
function save_batch_issues_sqlite(PDO $pdo, array $issues) {
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $pdo->beginTransaction();

    try {
        $issueStmt = $pdo->prepare("
            INSERT INTO issues (
                id, title, description, category, region, tags, author, creator_id, creator_email,
                is_anonymous_author, closing_date, duration_label, visibility, invited_emails,
                invited_groups, yes_count, no_count, likes_count, favorites_count, images,
                creator_voice_note, featured, summary, is_deleted, deleted_at, created_at, updated_at
            ) VALUES (
                :id, :title, :description, :category, :region, :tags, :author, :creator_id, :creator_email,
                :is_anonymous_author, :closing_date, :duration_label, :visibility, :invited_emails,
                :invited_groups, :yes_count, :no_count, :likes_count, :favorites_count, :images,
                :creator_voice_note, :featured, :summary, :is_deleted, :deleted_at, :created_at, :updated_at
            )
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                category = excluded.category,
                region = excluded.region,
                tags = excluded.tags,
                author = excluded.author,
                creator_id = excluded.creator_id,
                creator_email = excluded.creator_email,
                is_anonymous_author = excluded.is_anonymous_author,
                closing_date = excluded.closing_date,
                duration_label = excluded.duration_label,
                visibility = excluded.visibility,
                invited_emails = excluded.invited_emails,
                invited_groups = excluded.invited_groups,
                yes_count = excluded.yes_count,
                no_count = excluded.no_count,
                likes_count = excluded.likes_count,
                favorites_count = excluded.favorites_count,
                images = excluded.images,
                creator_voice_note = excluded.creator_voice_note,
                featured = excluded.featured,
                summary = excluded.summary,
                is_deleted = excluded.is_deleted,
                deleted_at = excluded.deleted_at,
                updated_at = excluded.updated_at
        ");

        $respStmt = $pdo->prepare("
            INSERT INTO responses (
                id, issue_id, choice, author_name, author_email, author_alias, author_role,
                is_anonymous, note, voice_note, likes_count, is_reported, created_at
            ) VALUES (
                :id, :issue_id, :choice, :author_name, :author_email, :author_alias, :author_role,
                :is_anonymous, :note, :voice_note, :likes_count, :is_reported, :created_at
            )
            ON CONFLICT(id) DO UPDATE SET
                choice = excluded.choice,
                author_name = excluded.author_name,
                author_email = excluded.author_email,
                author_alias = excluded.author_alias,
                author_role = excluded.author_role,
                is_anonymous = excluded.is_anonymous,
                note = excluded.note,
                voice_note = excluded.voice_note,
                likes_count = excluded.likes_count,
                is_reported = excluded.is_reported
        ");

        $replyStmt = $pdo->prepare("
            INSERT INTO replies (
                id, submission_id, issue_id, author_name, author_email, author_alias, author_role,
                is_anonymous, content, reply_to_name, likes_count, created_at
            ) VALUES (
                :id, :submission_id, :issue_id, :author_name, :author_email, :author_alias, :author_role,
                :is_anonymous, :content, :reply_to_name, :likes_count, :created_at
            )
            ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                likes_count = excluded.likes_count
        ");

        $reactStmt = $pdo->prepare("
            INSERT OR IGNORE INTO reactions (id, target_type, target_id, user_key, emoji, created_at)
            VALUES (:id, :target_type, :target_id, :user_key, :emoji, :created_at)
        ");

        foreach ($issues as $iss) {
            if (!isset($iss['id'])) continue;

            $issueStmt->execute([
                ':id' => $iss['id'],
                ':title' => $iss['title'] ?? 'Untitled Issue',
                ':description' => $iss['description'] ?? '',
                ':category' => $iss['category'] ?? 'Community & Neighborhood',
                ':region' => $iss['region'] ?? 'Global / Remote',
                ':tags' => json_encode($iss['tags'] ?? []),
                ':author' => $iss['author'] ?? 'Anonymous',
                ':creator_id' => $iss['creatorId'] ?? null,
                ':creator_email' => $iss['creatorEmail'] ?? null,
                ':is_anonymous_author' => !empty($iss['isAnonymousAuthor']) ? 1 : 0,
                ':closing_date' => $iss['closingDate'] ?? gmdate('Y-m-d\TH:i:s\Z', time() + 86400),
                ':duration_label' => $iss['durationLabel'] ?? '24 Hours',
                ':visibility' => $iss['visibility'] ?? 'public',
                ':invited_emails' => json_encode($iss['invitedEmails'] ?? []),
                ':invited_groups' => json_encode($iss['invitedGroups'] ?? []),
                ':yes_count' => (int)($iss['yesCount'] ?? 0),
                ':no_count' => (int)($iss['noCount'] ?? 0),
                ':likes_count' => (int)($iss['likesCount'] ?? 0),
                ':favorites_count' => (int)($iss['favoritesCount'] ?? 0),
                ':images' => json_encode($iss['images'] ?? []),
                ':creator_voice_note' => isset($iss['creatorVoiceNote']) ? json_encode($iss['creatorVoiceNote']) : null,
                ':featured' => !empty($iss['featured']) ? 1 : 0,
                ':summary' => isset($iss['summary']) ? json_encode($iss['summary']) : null,
                ':is_deleted' => !empty($iss['isDeletedByAuthor']) ? 1 : 0,
                ':deleted_at' => $iss['deletedAt'] ?? null,
                ':created_at' => $iss['createdAt'] ?? $now,
                ':updated_at' => $now,
            ]);

            if (isset($iss['responses']) && is_array($iss['responses'])) {
                foreach ($iss['responses'] as $resp) {
                    if (!isset($resp['id'])) continue;

                    $respStmt->execute([
                        ':id' => $resp['id'],
                        ':issue_id' => $iss['id'],
                        ':choice' => $resp['choice'] ?? 'YES',
                        ':author_name' => $resp['authorName'] ?? 'Anonymous Neighbor',
                        ':author_email' => $resp['authorEmail'] ?? null,
                        ':author_alias' => $resp['authorAlias'] ?? null,
                        ':author_role' => $resp['authorRole'] ?? null,
                        ':is_anonymous' => !empty($resp['isAnonymous']) ? 1 : 0,
                        ':note' => $resp['note'] ?? null,
                        ':voice_note' => isset($resp['voiceNote']) ? json_encode($resp['voiceNote']) : null,
                        ':likes_count' => (int)($resp['likesCount'] ?? 0),
                        ':is_reported' => !empty($resp['isReported']) ? 1 : 0,
                        ':created_at' => $resp['createdAt'] ?? $now,
                    ]);

                    // Save response user reactions if present
                    if (isset($resp['userReactions']) && is_array($resp['userReactions'])) {
                        foreach ($resp['userReactions'] as $emoji => $userKeys) {
                            if (is_array($userKeys)) {
                                foreach ($userKeys as $uk) {
                                    $reactStmt->execute([
                                        ':id' => 'react_' . md5('comment' . $resp['id'] . $uk . $emoji),
                                        ':target_type' => 'comment',
                                        ':target_id' => $resp['id'],
                                        ':user_key' => $uk,
                                        ':emoji' => $emoji,
                                        ':created_at' => $now,
                                    ]);
                                }
                            }
                        }
                    }

                    // Save nested replies if present
                    if (isset($resp['replies']) && is_array($resp['replies'])) {
                        foreach ($resp['replies'] as $reply) {
                            if (!isset($reply['id'])) continue;

                            $replyStmt->execute([
                                ':id' => $reply['id'],
                                ':submission_id' => $resp['id'],
                                ':issue_id' => $iss['id'],
                                ':author_name' => $reply['authorName'] ?? 'Anonymous Neighbor',
                                ':author_email' => $reply['authorEmail'] ?? null,
                                ':author_alias' => $reply['authorAlias'] ?? null,
                                ':author_role' => $reply['authorRole'] ?? null,
                                ':is_anonymous' => !empty($reply['isAnonymous']) ? 1 : 0,
                                ':content' => $reply['content'] ?? '',
                                ':reply_to_name' => $reply['replyToName'] ?? null,
                                ':likes_count' => (int)($reply['likesCount'] ?? 0),
                                ':created_at' => $reply['createdAt'] ?? $now,
                            ]);

                            // Save reply reactions
                            if (isset($reply['userReactions']) && is_array($reply['userReactions'])) {
                                foreach ($reply['userReactions'] as $emoji => $userKeys) {
                                    if (is_array($userKeys)) {
                                        foreach ($userKeys as $uk) {
                                            $reactStmt->execute([
                                                ':id' => 'react_' . md5('reply' . $reply['id'] . $uk . $emoji),
                                                ':target_type' => 'reply',
                                                ':target_id' => $reply['id'],
                                                ':user_key' => $uk,
                                                ':emoji' => $emoji,
                                                ':created_at' => $now,
                                            ]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('Batch Save SQLite Failed: ' . $e->getMessage());
        return false;
    }
}

// ATOMIC GRANULAR WRITES

function handle_atomic_vote(PDO $pdo, array $payload) {
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $issueId = $payload['issueId'] ?? null;
    $choice = $payload['choice'] ?? 'YES';
    $submissionId = $payload['id'] ?? ('vote-' . time() . '-' . substr(md5(mt_rand()), 0, 4));

    if (!$issueId) {
        http_response_code(400);
        return ['success' => false, 'error' => 'Missing issueId'];
    }

    $pdo->beginTransaction();
    try {
        // 1. Insert or update the response
        $stmt = $pdo->prepare("
            INSERT INTO responses (
                id, issue_id, choice, author_name, author_email, author_alias, author_role,
                is_anonymous, note, voice_note, likes_count, is_reported, created_at
            ) VALUES (
                :id, :issue_id, :choice, :author_name, :author_email, :author_alias, :author_role,
                :is_anonymous, :note, :voice_note, :likes_count, :is_reported, :created_at
            )
            ON CONFLICT(id) DO UPDATE SET
                choice = excluded.choice,
                note = excluded.note,
                voice_note = excluded.voice_note
        ");

        $stmt->execute([
            ':id' => $submissionId,
            ':issue_id' => $issueId,
            ':choice' => $choice,
            ':author_name' => $payload['authorName'] ?? 'Anonymous Neighbor',
            ':author_email' => $payload['authorEmail'] ?? null,
            ':author_alias' => $payload['authorAlias'] ?? null,
            ':author_role' => $payload['authorRole'] ?? null,
            ':is_anonymous' => !empty($payload['isAnonymous']) ? 1 : 0,
            ':note' => $payload['note'] ?? null,
            ':voice_note' => isset($payload['voiceNote']) ? json_encode($payload['voiceNote']) : null,
            ':likes_count' => (int)($payload['likesCount'] ?? 0),
            ':is_reported' => 0,
            ':created_at' => $payload['createdAt'] ?? $now,
        ]);

        // 2. Atomically update yes/no counters on issue
        $isYes = strtoupper($choice) === 'YES';
        $updateSql = $isYes 
            ? "UPDATE issues SET yes_count = yes_count + 1, updated_at = :now WHERE id = :id"
            : "UPDATE issues SET no_count = no_count + 1, updated_at = :now WHERE id = :id";
        
        $upStmt = $pdo->prepare($updateSql);
        $upStmt->execute([':now' => $now, ':id' => $issueId]);

        $pdo->commit();
        return ['success' => true, 'submissionId' => $submissionId, 'updatedAt' => $now];
    } catch (Exception $e) {
        $pdo->rollBack();
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function handle_atomic_reply(PDO $pdo, array $payload) {
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $issueId = $payload['issueId'] ?? null;
    $submissionId = $payload['submissionId'] ?? null;
    $reply = $payload['reply'] ?? null;

    if (!$issueId || !$submissionId || !$reply || empty($reply['content'])) {
        http_response_code(400);
        return ['success' => false, 'error' => 'Missing reply parameters'];
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO replies (
                id, submission_id, issue_id, author_name, author_email, author_alias, author_role,
                is_anonymous, content, reply_to_name, likes_count, created_at
            ) VALUES (
                :id, :submission_id, :issue_id, :author_name, :author_email, :author_alias, :author_role,
                :is_anonymous, :content, :reply_to_name, :likes_count, :created_at
            )
        ");

        $replyId = $reply['id'] ?? ('reply-' . time() . '-' . substr(md5(mt_rand()), 0, 4));

        $stmt->execute([
            ':id' => $replyId,
            ':submission_id' => $submissionId,
            ':issue_id' => $issueId,
            ':author_name' => $reply['authorName'] ?? 'Anonymous Neighbor',
            ':author_email' => $reply['authorEmail'] ?? null,
            ':author_alias' => $reply['authorAlias'] ?? null,
            ':author_role' => $reply['authorRole'] ?? null,
            ':is_anonymous' => !empty($reply['isAnonymous']) ? 1 : 0,
            ':content' => $reply['content'],
            ':reply_to_name' => $reply['replyToName'] ?? null,
            ':likes_count' => (int)($reply['likesCount'] ?? 0),
            ':created_at' => $reply['createdAt'] ?? $now,
        ]);

        $upStmt = $pdo->prepare("UPDATE issues SET updated_at = :now WHERE id = :id");
        $upStmt->execute([':now' => $now, ':id' => $issueId]);

        $pdo->commit();
        return ['success' => true, 'replyId' => $replyId, 'updatedAt' => $now];
    } catch (Exception $e) {
        $pdo->rollBack();
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function handle_atomic_reaction(PDO $pdo, array $payload) {
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $targetType = $payload['targetType'] ?? 'comment'; // 'comment' | 'reply'
    $targetId = $payload['targetId'] ?? null;
    $userKey = $payload['userKey'] ?? null;
    $emoji = $payload['emoji'] ?? '❤️';

    if (!$targetId || !$userKey) {
        http_response_code(400);
        return ['success' => false, 'error' => 'Missing targetId or userKey'];
    }

    $pdo->beginTransaction();
    try {
        // Check if exists
        $chk = $pdo->prepare("SELECT id FROM reactions WHERE target_type = :tt AND target_id = :tid AND user_key = :uk AND emoji = :em");
        $chk->execute([
            ':tt' => $targetType,
            ':tid' => $targetId,
            ':uk' => $userKey,
            ':em' => $emoji,
        ]);
        $existing = $chk->fetch();

        if ($existing) {
            // Remove reaction
            $del = $pdo->prepare("DELETE FROM reactions WHERE id = :id");
            $del->execute([':id' => $existing['id']]);
            $reacted = false;
        } else {
            // Add reaction
            $ins = $pdo->prepare("INSERT INTO reactions (id, target_type, target_id, user_key, emoji, created_at) VALUES (:id, :tt, :tid, :uk, :em, :now)");
            $ins->execute([
                ':id' => 'react_' . md5($targetType . $targetId . $userKey . $emoji),
                ':tt' => $targetType,
                ':tid' => $targetId,
                ':uk' => $userKey,
                ':em' => $emoji,
                ':now' => $now,
            ]);
            $reacted = true;
        }

        // Count total for this emoji
        $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM reactions WHERE target_type = :tt AND target_id = :tid AND emoji = :em");
        $cntStmt->execute([':tt' => $targetType, ':tid' => $targetId, ':em' => $emoji]);
        $totalForEmoji = (int)$cntStmt->fetchColumn();

        // If heart, sync likes_count on target
        if ($emoji === '❤️') {
            if ($targetType === 'comment') {
                $up = $pdo->prepare("UPDATE responses SET likes_count = :cnt WHERE id = :id");
                $up->execute([':cnt' => $totalForEmoji, ':id' => $targetId]);
            } else if ($targetType === 'reply') {
                $up = $pdo->prepare("UPDATE replies SET likes_count = :cnt WHERE id = :id");
                $up->execute([':cnt' => $totalForEmoji, ':id' => $targetId]);
            }
        }

        $pdo->commit();
        return [
            'success' => true,
            'reacted' => $reacted,
            'emoji' => $emoji,
            'count' => $totalForEmoji,
        ];
    } catch (Exception $e) {
        $pdo->rollBack();
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

// -------------------------------------------------------------
// USER PROFILE PERSISTENCE (Multi-Device Sync)
// -------------------------------------------------------------

function handle_get_user_profile(?PDO $pdo, string $email, string $profilesFallbackPath): ?array {
    $emailKey = strtolower(trim($email));
    if ($emailKey === '') return null;

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT user_data FROM user_profiles WHERE lower(email) = :email LIMIT 1");
            $stmt->execute([':email' => $emailKey]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['user_data'])) {
                $decoded = json_decode($row['user_data'], true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        } catch (Exception $e) {
            error_log('Error fetching user profile from SQLite: ' . $e->getMessage());
        }
    }

    if (file_exists($profilesFallbackPath)) {
        $raw = @file_get_contents($profilesFallbackPath);
        $map = $raw ? json_decode($raw, true) : null;
        if (is_array($map) && isset($map[$emailKey]) && is_array($map[$emailKey])) {
            return $map[$emailKey];
        }
    }

    return null;
}

function handle_save_user_profile(?PDO $pdo, array $profile, string $profilesFallbackPath): array {
    $emailKey = strtolower(trim($profile['email'] ?? ''));
    if ($emailKey === '') {
        return ['success' => false, 'error' => 'Invalid or missing email'];
    }

    $json = json_encode($profile);
    $now = gmdate('Y-m-d\TH:i:s\Z');

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO user_profiles (email, user_data, updated_at) 
                VALUES (:email, :user_data, :updated_at)
                ON CONFLICT(email) DO UPDATE SET 
                    user_data = :user_data,
                    updated_at = :updated_at
            ");
            $stmt->execute([
                ':email' => $emailKey,
                ':user_data' => $json,
                ':updated_at' => $now
            ]);
            return ['success' => true];
        } catch (Exception $e) {
            error_log('Error saving user profile to SQLite: ' . $e->getMessage());
        }
    }

    // JSON file fallback
    try {
        $map = file_exists($profilesFallbackPath) ? json_decode(@file_get_contents($profilesFallbackPath), true) : [];
        if (!is_array($map)) $map = [];
        $map[$emailKey] = $profile;
        @file_put_contents($profilesFallbackPath, json_encode($map, JSON_PRETTY_PRINT));
        return ['success' => true, 'fallback' => true];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

// -------------------------------------------------------------
// MAIN CONTROLLER EXECUTION
// -------------------------------------------------------------

$pdo = get_database_connection($dbPath, $jsonFallbackPath);
$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : null);

// FALLBACK HANDLING IF SQLITE NOT ACTIVE
if (!$pdo) {
    // Pure JSON file fallback mode
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (isset($_GET['action']) && $_GET['action'] === 'get_profile') {
            $email = trim($_GET['email'] ?? '');
            $profile = handle_get_user_profile(null, $email, $profilesFallbackPath);
            echo json_encode(['success' => true, 'profile' => $profile]);
            exit;
        }
        if (file_exists($jsonFallbackPath)) {
            echo @file_get_contents($jsonFallbackPath) ?: json_encode([]);
        } else {
            echo json_encode([]);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);
        if ($payload) {
            $act = $payload['action'] ?? null;
            if ($act === 'get_profile') {
                $email = trim($payload['email'] ?? '');
                $profile = handle_get_user_profile(null, $email, $profilesFallbackPath);
                echo json_encode(['success' => true, 'profile' => $profile]);
                exit;
            }
            if ($act === 'save_profile') {
                $prof = $payload['profile'] ?? null;
                $res = handle_save_user_profile(null, is_array($prof) ? $prof : [], $profilesFallbackPath);
                echo json_encode($res);
                exit;
            }
            @file_put_contents($jsonFallbackPath, json_encode($payload['issues'] ?? $payload, JSON_PRETTY_PRINT));
            echo json_encode(['success' => true, 'mode' => 'json_fallback']);
            exit;
        }
    }
    echo json_encode(['success' => false]);
    exit;
}

// SQLITE-POWERED API

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['action']) && $_GET['action'] === 'get_profile') {
        $email = trim($_GET['email'] ?? '');
        $profile = handle_get_user_profile($pdo, $email, $profilesFallbackPath);
        echo json_encode(['success' => true, 'profile' => $profile]);
        exit;
    }

    $since = isset($_GET['since']) ? $_GET['since'] : null;
    $data = fetch_hydrated_issues_sqlite($pdo, $since);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
        exit;
    }

    $action = $payload['action'] ?? ($action ?? 'batch');

    switch ($action) {
        case 'get_profile':
            $email = trim($payload['email'] ?? '');
            $profile = handle_get_user_profile($pdo, $email, $profilesFallbackPath);
            echo json_encode(['success' => true, 'profile' => $profile]);
            exit;

        case 'save_profile':
            $userProfile = $payload['profile'] ?? null;
            if (!is_array($userProfile) || empty($userProfile['email'])) {
                echo json_encode(['success' => false, 'error' => 'Missing profile or email']);
                exit;
            }
            $res = handle_save_user_profile($pdo, $userProfile, $profilesFallbackPath);
            echo json_encode($res);
            exit;

        case 'vote':
            $res = handle_atomic_vote($pdo, $payload);
            echo json_encode($res);
            exit;

        case 'reply':
            $res = handle_atomic_reply($pdo, $payload);
            echo json_encode($res);
            exit;

        case 'react':
            $res = handle_atomic_reaction($pdo, $payload);
            echo json_encode($res);
            exit;

        case 'delete':
            $issueId = $payload['issueId'] ?? null;
            if ($issueId) {
                $now = gmdate('Y-m-d\TH:i:s\Z');
                $stmt = $pdo->prepare("UPDATE issues SET is_deleted = 1, deleted_at = :now, updated_at = :now WHERE id = :id");
                $stmt->execute([':now' => $now, ':id' => $issueId]);
                echo json_encode(['success' => true, 'deletedId' => $issueId]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Missing issueId']);
            }
            exit;

        case 'batch':
        default:
            $incomingList = isset($payload['issues']) && is_array($payload['issues'])
                ? $payload['issues']
                : (isset($payload['id']) ? [$payload] : (isset($payload[0]['id']) ? $payload : []));

            if (!empty($incomingList)) {
                $saved = save_batch_issues_sqlite($pdo, $incomingList);
                echo json_encode(['success' => $saved, 'count' => count($incomingList)]);
            } else {
                echo json_encode(['success' => true, 'count' => 0]);
            }
            exit;
    }
}
