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
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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

        // Auto-migration: ensure views_count and impressions_count exist
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN views_count INTEGER DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN impressions_count INTEGER DEFAULT 0");
        } catch (Exception $e) {}

        // Auto-migration: FanZone isolation, binary presets & multi-option poll columns
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN zone TEXT DEFAULT 'civic'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN poll_type TEXT DEFAULT 'binary'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN yes_label TEXT DEFAULT 'YES'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN no_label TEXT DEFAULT 'NO'");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN options_json TEXT");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE responses ADD COLUMN option_id TEXT");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE responses ADD COLUMN option_label TEXT");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE responses ADD COLUMN author_club TEXT");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE replies ADD COLUMN author_club TEXT");
        } catch (Exception $e) {}
        try {
            $pdo->exec("CREATE INDEX IF NOT EXISTS idx_issues_zone ON issues(zone)");
        } catch (Exception $e) {}

        // Self-healing deduplication: soft-delete any duplicate issues with identical titles (keeping oldest)
        try {
            $pdo->exec("
                UPDATE issues SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
                WHERE id IN (
                    SELECT id FROM issues i1
                    WHERE is_deleted = 0
                    AND EXISTS (
                        SELECT 1 FROM issues i2
                        WHERE i2.is_deleted = 0
                        AND LOWER(TRIM(i2.title)) = LOWER(TRIM(i1.title))
                        AND (i2.created_at < i1.created_at OR (i2.created_at = i1.created_at AND i2.id < i1.id))
                    )
                )
            ");
        } catch (Exception $e) {}

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

        // Auto-repair legacy duplicate daily topics in database
        try {
            $fixStmt = $pdo->prepare("
                UPDATE issues 
                SET title = :title, description = :description, category = :category, tags = :tags, updated_at = :now
                WHERE id = :id AND (title LIKE '%genotype%' OR title LIKE '%AS%' OR title LIKE '%sickle%')
            ");

            $fixStmt->execute([
                ':id' => 'issue-daily-2026-11-15-afternoon',
                ':title' => 'Commercial dispatch and delivery bikes on express flyovers: enforce a total ban?',
                ':description' => 'Commuters and highway safety officials argue erratic dispatch riders weaving through high-speed expressway traffic cause daily fatal crashes. Delivery companies and logistics unions argue bans cripple the fast-growing e-commerce gig economy and destroy youth livelihoods.',
                ':category' => 'Community & Neighborhood',
                ':tags' => json_encode(['TransportSafety', 'DispatchRiders', 'LagosTraffic', 'GigEconomy']),
                ':now' => gmdate('Y-m-d\TH:i:s\Z')
            ]);

            $fixStmt->execute([
                ':id' => 'issue-daily-2026-11-15-evening',
                ':title' => 'Tax church and mosque-owned commercial businesses and luxury universities: Yes or No?',
                ':description' => 'Fiscal reformers argue faith-owned universities charging ₦3M+ tuition and luxury commercial ventures generate billions in untaxed profit while public schools collapse. Religious bodies argue educational and charitable missions are non-profit social investments funded by voluntary tithes.',
                ':category' => 'Economy & Finance',
                ':tags' => json_encode(['TaxReform', 'FaithInstitutions', 'EducationCost', 'Economy']),
                ':now' => gmdate('Y-m-d\TH:i:s\Z')
            ]);

            // Auto-attribute Catherine Mbawuike's perspective on Lagos dating issue
            $pdo->exec("
                UPDATE responses 
                SET author_name = 'Catherine Mbawuike',
                    author_username = 'stylushairs1',
                    author_email = 'stylushairs1@gmail.com',
                    author_role = 'Verified Google Account',
                    is_anonymous = 0
                WHERE id = 'vote-1794733633630-abx0'
            ");
        } catch (Exception $e) {}

        // Auto-seed starter FanZone football debates if none exist yet
        try {
            $fzCountStmt = $pdo->query("SELECT COUNT(*) FROM issues WHERE zone = 'fanzone' AND is_deleted = 0");
            if ($fzCountStmt && (int)$fzCountStmt->fetchColumn() === 0) {
                $fzNow = gmdate('Y-m-d\TH:i:s\Z');
                $fzClose = gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400);
                $fzStarterIssues = [
                    [
                        'id' => 'issue-fz-starter-ucl-multi',
                        'poll_type' => 'multi',
                        'yes_label' => 'YES',
                        'no_label' => 'NO',
                        'options' => [
                            ['id' => 'opt-1', 'label' => 'Real Madrid', 'votes' => 42, 'color' => '#10b981'],
                            ['id' => 'opt-2', 'label' => 'Liverpool', 'votes' => 31, 'color' => '#3b82f6'],
                            ['id' => 'opt-3', 'label' => 'FC Barcelona', 'votes' => 26, 'color' => '#f59e0b'],
                            ['id' => 'opt-4', 'label' => 'Arsenal', 'votes' => 22, 'color' => '#f43f5e'],
                        ],
                        'title' => 'Which club is the biggest favorite to lift this season\'s UEFA Champions League trophy?',
                        'description' => 'With knockout intensity heating up across Europe, rival fanbases are split on who has the squad depth and big-game mentality to go all the way.',
                        'category' => 'Champions League',
                        'tags' => ['Real Madrid', 'Arsenal', 'Liverpool', 'FC Barcelona', 'UCL'],
                        'author' => 'Marco Rossi',
                        'creator_id' => 'fz-pers-marco-rossi',
                        'creator_email' => 'marco.rossi@fanzone.football',
                        'yes_count' => 0,
                        'no_count' => 0,
                        'responses' => [
                            ['id' => 'sub-fz-st-1', 'choice' => 'YES', 'option_id' => 'opt-1', 'option_label' => 'Real Madrid', 'name' => 'Carlos Mendoza', 'email' => 'carlos.rma@fanzone.football', 'role' => 'Madridista', 'club' => ['id' => 'real-madrid', 'name' => 'Real Madrid', 'shortName' => 'RMA', 'league' => 'La Liga', 'color' => '#FEBE10', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png'], 'note' => 'Until someone knocks them out in the spring, betting against Real Madrid in the UCL is just charity.'],
                            ['id' => 'sub-fz-st-2', 'choice' => 'YES', 'option_id' => 'opt-2', 'option_label' => 'Liverpool', 'name' => 'Claire Hughes', 'email' => 'claire.lfc@fanzone.football', 'role' => 'Kop End Regular', 'club' => ['id' => 'liverpool', 'name' => 'Liverpool', 'shortName' => 'LIV', 'league' => 'Premier League', 'color' => '#C8102E', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png'], 'note' => 'Anfield under the floodlights plus the cleanest transition attack in Europe right now.'],
                            ['id' => 'sub-fz-st-3', 'choice' => 'YES', 'option_id' => 'opt-4', 'option_label' => 'Arsenal', 'name' => 'Tobi Adeyemi', 'email' => 'tobi.gunner@fanzone.football', 'role' => 'Matchday Fan', 'club' => ['id' => 'arsenal', 'name' => 'Arsenal', 'shortName' => 'ARS', 'league' => 'Premier League', 'color' => '#EF0107', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png'], 'note' => 'Best defensive structure and set-piece threat left in the draw. Do not sleep on N5.'],
                        ],
                    ],
                    [
                        'id' => 'issue-fz-starter-arteta',
                        'poll_type' => 'binary',
                        'yes_label' => 'BACK',
                        'no_label' => 'SACK',
                        'options' => null,
                        'title' => 'If Arsenal finish another season without major silverware, should Mikel Arteta be backed or sacked?',
                        'description' => 'Arsenal supporters point to back-to-back title pushes and tactical stability, while rivals claim five years of heavy backing demands trophies now.',
                        'category' => 'Premier League',
                        'tags' => ['Arsenal', 'Arteta', 'PremierLeague'],
                        'author' => '@n5_tobi',
                        'creator_id' => 'fz-pers-tobi-gunner',
                        'creator_email' => 'tobi.gunner@fanzone.football',
                        'yes_count' => 64,
                        'no_count' => 38,
                        'responses' => [
                            ['id' => 'sub-fz-st-4', 'choice' => 'YES', 'option_id' => null, 'option_label' => null, 'name' => 'Tobi Adeyemi', 'email' => 'tobi.gunner@fanzone.football', 'role' => 'Matchday Fan', 'club' => ['id' => 'arsenal', 'name' => 'Arsenal', 'shortName' => 'ARS', 'league' => 'Premier League', 'color' => '#EF0107', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png'], 'note' => 'BACK 100%. Arteta turned Arsenal back into a genuine European powerhouse.'],
                            ['id' => 'sub-fz-st-5', 'choice' => 'NO', 'option_id' => null, 'option_label' => null, 'name' => 'Kwame Mensah', 'email' => 'kwame.che@fanzone.football', 'role' => 'Chelsea Supporter', 'club' => ['id' => 'chelsea', 'name' => 'Chelsea', 'shortName' => 'CHE', 'league' => 'Premier League', 'color' => '#034694', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png'], 'note' => 'Five years and £700m+ without a trophy lift? At big clubs that means pressure.'],
                            ['id' => 'sub-fz-st-6', 'choice' => 'NO', 'option_id' => null, 'option_label' => null, 'name' => 'Devon Brooks', 'email' => 'devon.utd@fanzone.football', 'role' => 'Red Devils Fan', 'club' => ['id' => 'man-utd', 'name' => 'Manchester United', 'shortName' => 'MUN', 'league' => 'Premier League', 'color' => '#DA291C', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png'], 'note' => 'Next Season FC cannot last forever. At some point you have to deliver silverware.'],
                        ],
                    ],
                    [
                        'id' => 'issue-fz-starter-chelsea',
                        'poll_type' => 'binary',
                        'yes_label' => 'FACT',
                        'no_label' => 'CAP',
                        'options' => null,
                        'title' => 'Real talk: Has Chelsea\'s aggressive youth transfer strategy finally been vindicated?',
                        'description' => 'Critics mocked the long contracts and massive squad turnover, yet Chelsea\'s young core is suddenly flying.',
                        'category' => 'Premier League',
                        'tags' => ['Chelsea', 'PremierLeague', 'Transfers'],
                        'author' => '@cfc_kwame',
                        'creator_id' => 'fz-pers-kwame-blues',
                        'creator_email' => 'kwame.che@fanzone.football',
                        'yes_count' => 58,
                        'no_count' => 44,
                        'responses' => [
                            ['id' => 'sub-fz-st-7', 'choice' => 'YES', 'option_id' => null, 'option_label' => null, 'name' => 'Kwame Mensah', 'email' => 'kwame.che@fanzone.football', 'role' => 'Chelsea Supporter', 'club' => ['id' => 'chelsea', 'name' => 'Chelsea', 'shortName' => 'CHE', 'league' => 'Premier League', 'color' => '#034694', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png'], 'note' => 'FACT. Cole Palmer alone justifies half the rebuild and the squad is locked in for years.'],
                            ['id' => 'sub-fz-st-8', 'choice' => 'NO', 'option_id' => null, 'option_label' => null, 'name' => 'Elena Puig', 'email' => 'elena.barca@fanzone.football', 'role' => 'La Masia Supporter', 'club' => ['id' => 'barcelona', 'name' => 'FC Barcelona', 'shortName' => 'BAR', 'league' => 'La Liga', 'color' => '#A50044', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png'], 'note' => 'CAP. One good stretch does not vindicate £1bn spent without silverware.'],
                        ],
                    ],
                    [
                        'id' => 'issue-fz-starter-saudi-bids',
                        'poll_type' => 'binary',
                        'yes_label' => 'SIGN',
                        'no_label' => 'PASS',
                        'options' => null,
                        'title' => 'Should European giants cash in on club legends when £60m+ Saudi Pro League bids arrive?',
                        'description' => 'Loyalty vs PSR financial discipline: accept massive fees for players over 30 or keep dressing-room icons?',
                        'category' => 'Transfers & Rumors',
                        'tags' => ['Liverpool', 'ManUtd', 'AlNassr', 'Transfers'],
                        'author' => 'Marco Rossi',
                        'creator_id' => 'fz-pers-marco-rossi',
                        'creator_email' => 'marco.rossi@fanzone.football',
                        'yes_count' => 53,
                        'no_count' => 47,
                        'responses' => [
                            ['id' => 'sub-fz-st-9', 'choice' => 'YES', 'option_id' => null, 'option_label' => null, 'name' => 'Tariq Al-Mansoor', 'email' => 'tariq.nsr@fanzone.football', 'role' => 'Saudi Pro League Fan', 'club' => ['id' => 'al-nassr', 'name' => 'Al-Nassr', 'shortName' => 'NSR', 'league' => 'Saudi Pro League', 'color' => '#FFCD00', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/817.png'], 'note' => 'Win-win deal for everyone—European clubs dodge PSR issues and global fans watch legends live.'],
                            ['id' => 'sub-fz-st-10', 'choice' => 'NO', 'option_id' => null, 'option_label' => null, 'name' => 'Claire Hughes', 'email' => 'claire.lfc@fanzone.football', 'role' => 'Kop End Regular', 'club' => ['id' => 'liverpool', 'name' => 'Liverpool', 'shortName' => 'LIV', 'league' => 'Premier League', 'color' => '#C8102E', 'logoUrl' => 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png'], 'note' => 'You cannot replace 25 guaranteed goals and big-match leadership with a spreadsheet.'],
                        ],
                    ],
                ];

                $fzIssStmt = $pdo->prepare("
                    INSERT OR IGNORE INTO issues (
                        id, zone, poll_type, yes_label, no_label, options_json,
                        title, description, category, region, tags, author, creator_id, creator_email,
                        is_anonymous_author, closing_date, duration_label, visibility, invited_emails, invited_groups,
                        yes_count, no_count, likes_count, favorites_count, views_count, impressions_count,
                        featured, is_deleted, created_at, updated_at
                    ) VALUES (
                        :id, 'fanzone', :poll_type, :yes_label, :no_label, :options_json,
                        :title, :description, :category, 'Global / Remote', :tags, :author, :creator_id, :creator_email,
                        0, :closing_date, '7 Days', 'public', '[]', '[]',
                        :yes_count, :no_count, 18, 6, 320, 740,
                        1, 0, :created_at, :updated_at
                    )
                ");
                $fzRespStmt = $pdo->prepare("
                    INSERT OR IGNORE INTO responses (
                        id, issue_id, choice, option_id, option_label, author_name, author_email,
                        author_role, author_club, is_anonymous, note, likes_count, is_reported, created_at
                    ) VALUES (
                        :id, :issue_id, :choice, :option_id, :option_label, :author_name, :author_email,
                        :author_role, :author_club, 0, :note, 9, 0, :created_at
                    )
                ");

                foreach ($fzStarterIssues as $si) {
                    $fzIssStmt->execute([
                        ':id' => $si['id'],
                        ':poll_type' => $si['poll_type'],
                        ':yes_label' => $si['yes_label'],
                        ':no_label' => $si['no_label'],
                        ':options_json' => $si['options'] ? json_encode($si['options']) : null,
                        ':title' => $si['title'],
                        ':description' => $si['description'],
                        ':category' => $si['category'],
                        ':tags' => json_encode($si['tags']),
                        ':author' => $si['author'],
                        ':creator_id' => $si['creator_id'],
                        ':creator_email' => $si['creator_email'],
                        ':closing_date' => $fzClose,
                        ':yes_count' => $si['yes_count'],
                        ':no_count' => $si['no_count'],
                        ':created_at' => $fzNow,
                        ':updated_at' => $fzNow,
                    ]);
                    foreach ($si['responses'] as $sr) {
                        $fzRespStmt->execute([
                            ':id' => $sr['id'],
                            ':issue_id' => $si['id'],
                            ':choice' => $sr['choice'],
                            ':option_id' => $sr['option_id'],
                            ':option_label' => $sr['option_label'],
                            ':author_name' => $sr['name'],
                            ':author_email' => $sr['email'],
                            ':author_role' => $sr['role'],
                            ':author_club' => json_encode($sr['club']),
                            ':note' => $sr['note'],
                            ':created_at' => $fzNow,
                        ]);
                    }
                }
            }
        } catch (Exception $e) {}

        return $pdo;
    } catch (Exception $e) {
        error_log('SQLite Init Error: ' . $e->getMessage());
        return null;
    }
}

// Hydrates issues with responses, replies, and reactions into the expected frontend format
function fetch_hydrated_issues_sqlite(PDO $pdo, $since = null, $zone = null) {
    $sql = "SELECT * FROM issues WHERE is_deleted = 0";
    $params = [];
    if ($since) {
        $sql .= " AND updated_at >= :since";
        $params[':since'] = $since;
    }
    if ($zone === 'fanzone') {
        $sql .= " AND zone = 'fanzone'";
    } else if ($zone === 'civic') {
        $sql .= " AND (zone IS NULL OR zone = '' OR zone = 'civic')";
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

    // Build user profiles map for avatar & username hydration
    $profilesMap = [];
    try {
        $profStmt = $pdo->query("SELECT email, user_data FROM user_profiles");
        while ($pRow = $profStmt->fetch(PDO::FETCH_ASSOC)) {
            $uData = json_decode($pRow['user_data'], true);
            if ($uData && !empty($pRow['email'])) {
                $profilesMap[strtolower($pRow['email'])] = $uData;
                if (!empty($uData['name'])) {
                    $profilesMap['name:' . strtolower(trim($uData['name']))] = $uData;
                }
                if (!empty($uData['username'])) {
                    $cleanU = ltrim(strtolower(trim($uData['username'])), '@');
                    $profilesMap['user:' . $cleanU] = $uData;
                }
            }
        }
    } catch (Exception $e) {
        // user_profiles table might be empty or missing
    }

    // Also load seed_personas.json as base/fallback
    $seedFile = __DIR__ . '/data/seed_personas.json';
    if (file_exists($seedFile)) {
        $seedPersonas = json_decode(file_get_contents($seedFile), true);
        if (is_array($seedPersonas)) {
            foreach ($seedPersonas as $sp) {
                $eKey = strtolower($sp['email'] ?? '');
                if ($eKey && !isset($profilesMap[$eKey])) {
                    $profilesMap[$eKey] = $sp;
                }
                if (!empty($sp['name'])) {
                    $nKey = 'name:' . strtolower(trim($sp['name']));
                    if (!isset($profilesMap[$nKey])) {
                        $profilesMap[$nKey] = $sp;
                    }
                }
                if (!empty($sp['username'])) {
                    $cleanU = ltrim(strtolower(trim($sp['username'])), '@');
                    if (!isset($profilesMap['user:' . $cleanU])) {
                        $profilesMap['user:' . $cleanU] = $sp;
                    }
                }
            }
        }
    }

    $lookupProfile = function($email, $name = null, $alias = null) use (&$profilesMap) {
        if (!empty($email)) {
            $eKey = strtolower(trim($email));
            if (isset($profilesMap[$eKey])) return $profilesMap[$eKey];
        }
        if (!empty($name)) {
            $nKey = 'name:' . strtolower(trim($name));
            if (isset($profilesMap[$nKey])) return $profilesMap[$nKey];
        }
        if (!empty($alias)) {
            $uKey = 'user:' . ltrim(strtolower(trim($alias)), '@');
            if (isset($profilesMap[$uKey])) return $profilesMap[$uKey];
        }
        return null;
    };

    // Group replies by submission_id
    $repliesBySubmission = [];
    foreach ($allReplies as $rep) {
        $subId = $rep['submission_id'];
        if (!isset($repliesBySubmission[$subId])) {
            $repliesBySubmission[$subId] = [];
        }
        $rid = $rep['id'];
        $repProf = $lookupProfile($rep['author_email'], $rep['author_name'], $rep['author_alias']);
        $repAvatar = $repProf['avatar'] ?? null;
        $repUsername = $repProf['username'] ?? null;
        $repPref = $repProf['displayPreference'] ?? null;
        $repClub = !empty($rep['author_club']) ? json_decode($rep['author_club'], true) : ($repProf['favoriteClub'] ?? null);

        $repliesBySubmission[$subId][] = [
            'id' => $rep['id'],
            'submissionId' => $rep['submission_id'],
            'authorName' => $rep['author_name'],
            'authorUsername' => $repUsername,
            'authorAvatar' => $repAvatar,
            'authorEmail' => $rep['author_email'],
            'authorAlias' => $rep['author_alias'],
            'authorRole' => $rep['author_role'],
            'authorClub' => is_array($repClub) ? $repClub : null,
            'displayPreference' => $repPref,
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

        $respProf = $lookupProfile($resp['author_email'], $resp['author_name'], $resp['author_alias']);
        $respAvatar = $respProf['avatar'] ?? null;
        $respUsername = $respProf['username'] ?? null;
        $respPref = $respProf['displayPreference'] ?? null;
        $respClub = !empty($resp['author_club']) ? json_decode($resp['author_club'], true) : ($respProf['favoriteClub'] ?? null);

        $responsesByIssue[$issId][] = [
            'id' => $resp['id'],
            'issueId' => $resp['issue_id'],
            'choice' => $resp['choice'],
            'optionId' => $resp['option_id'] ?? null,
            'optionLabel' => $resp['option_label'] ?? null,
            'authorName' => $resp['author_name'],
            'authorUsername' => $respUsername,
            'authorAvatar' => $respAvatar,
            'authorEmail' => $resp['author_email'],
            'authorAlias' => $resp['author_alias'],
            'authorRole' => $resp['author_role'],
            'authorClub' => is_array($respClub) ? $respClub : null,
            'displayPreference' => $respPref,
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
        $options = !empty($row['options_json']) ? json_decode($row['options_json'], true) : null;
        $issueResponses = isset($responsesByIssue[$id]) ? $responsesByIssue[$id] : [];

        $respYes = 0;
        $respNo = 0;
        $respOptionCounts = [];
        foreach ($issueResponses as $r) {
            $ch = strtoupper($r['choice'] ?? '');
            if ($ch === 'YES') $respYes++;
            else if ($ch === 'NO') $respNo++;
            if (!empty($r['optionId'])) {
                $oid = $r['optionId'];
                $respOptionCounts[$oid] = ($respOptionCounts[$oid] ?? 0) + 1;
            }
        }
        $calcYes = max((int)$row['yes_count'], $respYes);
        $calcNo = max((int)$row['no_count'], $respNo);

        if (is_array($options)) {
            foreach ($options as &$opt) {
                if (is_array($opt) && !empty($opt['id'])) {
                    $oid = $opt['id'];
                    $opt['votes'] = max((int)($opt['votes'] ?? 0), $respOptionCounts[$oid] ?? 0);
                }
            }
            unset($opt);
        }

        $issueProf = $lookupProfile($row['creator_email'], $row['author'], null);
        $creatorAvatar = $issueProf['avatar'] ?? null;
        $creatorUsername = $issueProf['username'] ?? null;
        $creatorPref = $issueProf['displayPreference'] ?? null;

        $rawRegion = $row['region'] ?: 'Africa & Middle East';
        if ($rawRegion === 'West Africa') {
            $rawRegion = 'Africa & Middle East';
        }

        $output[] = [
            'id' => $row['id'],
            'zone' => !empty($row['zone']) ? $row['zone'] : 'civic',
            'pollType' => !empty($row['poll_type']) ? $row['poll_type'] : 'binary',
            'yesLabel' => !empty($row['yes_label']) ? $row['yes_label'] : 'YES',
            'noLabel' => !empty($row['no_label']) ? $row['no_label'] : 'NO',
            'options' => is_array($options) ? $options : null,
            'title' => $row['title'],
            'description' => $row['description'] ?: '',
            'category' => $row['category'],
            'region' => $rawRegion,
            'tags' => is_array($tags) ? $tags : [],
            'author' => $row['author'],
            'creatorId' => $row['creator_id'],
            'creatorEmail' => $row['creator_email'],
            'creatorAvatar' => $creatorAvatar,
            'creatorUsername' => $creatorUsername,
            'creatorDisplayPreference' => $creatorPref,
            'isAnonymousAuthor' => (bool)$row['is_anonymous_author'],
            'closingDate' => $row['closing_date'],
            'durationLabel' => $row['duration_label'] ?: '24 Hours',
            'visibility' => $row['visibility'] ?: 'public',
            'invitedEmails' => is_array($invitedEmails) ? $invitedEmails : [],
            'invitedGroups' => is_array($invitedGroups) ? $invitedGroups : [],
            'yesCount' => $calcYes,
            'noCount' => $calcNo,
            'likesCount' => (int)$row['likes_count'],
            'favoritesCount' => (int)$row['favorites_count'],
            'images' => is_array($images) ? $images : [],
            'creatorVoiceNote' => $creatorVoice,
            'featured' => (bool)$row['featured'],
            'summary' => $summary,
            'viewsCount' => (int)($row['views_count'] ?? 0),
            'impressionsCount' => (int)($row['impressions_count'] ?? 0),
            'isDeletedByAuthor' => (bool)$row['is_deleted'],
            'deletedAt' => $row['deleted_at'],
            'createdAt' => $row['created_at'],
            'responses' => $issueResponses,
        ];
    }

    // Sort output issues by a mix of latest and most popular (votes, comments, views/impressions)
    $now = time();
    usort($output, function($a, $b) use ($now) {
        $ageA = max(0, ($now - strtotime($a['createdAt'] ?? '')) / 3600);
        $ageB = max(0, ($now - strtotime($b['createdAt'] ?? '')) / 3600);

        $votesA = ($a['yesCount'] ?? 0) + ($a['noCount'] ?? 0);
        $votesB = ($b['yesCount'] ?? 0) + ($b['noCount'] ?? 0);

        $commentsA = count($a['responses'] ?? []);
        foreach ($a['responses'] ?? [] as $r) { $commentsA += count($r['replies'] ?? []); }

        $commentsB = count($b['responses'] ?? []);
        foreach ($b['responses'] ?? [] as $r) { $commentsB += count($r['replies'] ?? []); }

        $viewsA = !empty($a['viewsCount']) ? $a['viewsCount'] : (int)($votesA * 4.2 + $commentsA * 3.5 + ($a['likesCount'] ?? 0) * 2 + 20);
        $viewsB = !empty($b['viewsCount']) ? $b['viewsCount'] : (int)($votesB * 4.2 + $commentsB * 3.5 + ($b['likesCount'] ?? 0) * 2 + 20);

        $popA = ($votesA * 7) + ($commentsA * 14) + ($viewsA * 0.5) + (($a['likesCount'] ?? 0) * 4);
        $popB = ($votesB * 7) + ($commentsB * 14) + ($viewsB * 0.5) + (($b['likesCount'] ?? 0) * 4);

        $scoreA = (($popA * 12) / pow($ageA + 2, 1.15)) + (180 * exp(-$ageA / 14)) + (!empty($a['featured']) ? 30 : 0);
        $scoreB = (($popB * 12) / pow($ageB + 2, 1.15)) + (180 * exp(-$ageB / 14)) + (!empty($b['featured']) ? 30 : 0);

        if ($scoreA == $scoreB) return 0;
        return ($scoreA > $scoreB) ? -1 : 1;
    });

    return $output;
}

// Saves/upserts a list of issues into SQLite within an atomic transaction
function save_batch_issues_sqlite(PDO $pdo, array $issues) {
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $pdo->beginTransaction();

    try {
        $issueStmt = $pdo->prepare("
            INSERT INTO issues (
                id, zone, poll_type, yes_label, no_label, options_json,
                title, description, category, region, tags, author, creator_id, creator_email,
                is_anonymous_author, closing_date, duration_label, visibility, invited_emails,
                invited_groups, yes_count, no_count, likes_count, favorites_count, images,
                creator_voice_note, featured, summary, is_deleted, deleted_at, created_at, updated_at
            ) VALUES (
                :id, :zone, :poll_type, :yes_label, :no_label, :options_json,
                :title, :description, :category, :region, :tags, :author, :creator_id, :creator_email,
                :is_anonymous_author, :closing_date, :duration_label, :visibility, :invited_emails,
                :invited_groups, :yes_count, :no_count, :likes_count, :favorites_count, :images,
                :creator_voice_note, :featured, :summary, :is_deleted, :deleted_at, :created_at, :updated_at
            )
            ON CONFLICT(id) DO UPDATE SET
                zone = COALESCE(excluded.zone, issues.zone),
                poll_type = COALESCE(excluded.poll_type, issues.poll_type),
                yes_label = COALESCE(excluded.yes_label, issues.yes_label),
                no_label = COALESCE(excluded.no_label, issues.no_label),
                options_json = COALESCE(excluded.options_json, issues.options_json),
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
                yes_count = MAX(COALESCE(issues.yes_count, 0), COALESCE(excluded.yes_count, 0)),
                no_count = MAX(COALESCE(issues.no_count, 0), COALESCE(excluded.no_count, 0)),
                likes_count = MAX(COALESCE(issues.likes_count, 0), COALESCE(excluded.likes_count, 0)),
                favorites_count = MAX(COALESCE(issues.favorites_count, 0), COALESCE(excluded.favorites_count, 0)),
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
                id, issue_id, choice, option_id, option_label, author_name, author_email, author_alias, author_role, author_club,
                is_anonymous, note, voice_note, likes_count, is_reported, created_at
            ) VALUES (
                :id, :issue_id, :choice, :option_id, :option_label, :author_name, :author_email, :author_alias, :author_role, :author_club,
                :is_anonymous, :note, :voice_note, :likes_count, :is_reported, :created_at
            )
            ON CONFLICT(id) DO UPDATE SET
                choice = excluded.choice,
                option_id = COALESCE(excluded.option_id, responses.option_id),
                option_label = COALESCE(excluded.option_label, responses.option_label),
                author_name = excluded.author_name,
                author_email = excluded.author_email,
                author_alias = excluded.author_alias,
                author_role = excluded.author_role,
                author_club = COALESCE(excluded.author_club, responses.author_club),
                is_anonymous = excluded.is_anonymous,
                note = excluded.note,
                voice_note = excluded.voice_note,
                likes_count = excluded.likes_count,
                is_reported = excluded.is_reported
        ");

        $replyStmt = $pdo->prepare("
            INSERT INTO replies (
                id, submission_id, issue_id, author_name, author_email, author_alias, author_role, author_club,
                is_anonymous, content, reply_to_name, likes_count, created_at
            ) VALUES (
                :id, :submission_id, :issue_id, :author_name, :author_email, :author_alias, :author_role, :author_club,
                :is_anonymous, :content, :reply_to_name, :likes_count, :created_at
            )
            ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                likes_count = excluded.likes_count,
                author_club = COALESCE(excluded.author_club, replies.author_club)
        ");

        $reactStmt = $pdo->prepare("
            INSERT OR IGNORE INTO reactions (id, target_type, target_id, user_key, emoji, created_at)
            VALUES (:id, :target_type, :target_id, :user_key, :emoji, :created_at)
        ");

        foreach ($issues as $iss) {
            if (!isset($iss['id'])) continue;

            $issueStmt->execute([
                ':id' => $iss['id'],
                ':zone' => !empty($iss['zone']) ? $iss['zone'] : 'civic',
                ':poll_type' => !empty($iss['pollType']) ? $iss['pollType'] : 'binary',
                ':yes_label' => !empty($iss['yesLabel']) ? $iss['yesLabel'] : 'YES',
                ':no_label' => !empty($iss['noLabel']) ? $iss['noLabel'] : 'NO',
                ':options_json' => isset($iss['options']) && is_array($iss['options']) ? json_encode($iss['options']) : null,
                ':title' => $iss['title'] ?? 'Untitled Issue',
                ':description' => $iss['description'] ?? '',
                ':category' => $iss['category'] ?? 'Community & Neighborhood',
                ':region' => (!empty($iss['region']) && $iss['region'] !== 'West Africa') ? $iss['region'] : 'Africa & Middle East',
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
                        ':option_id' => $resp['optionId'] ?? null,
                        ':option_label' => $resp['optionLabel'] ?? null,
                        ':author_name' => $resp['authorName'] ?? 'Anonymous Neighbor',
                        ':author_email' => $resp['authorEmail'] ?? null,
                        ':author_alias' => $resp['authorAlias'] ?? null,
                        ':author_role' => $resp['authorRole'] ?? null,
                        ':author_club' => isset($resp['authorClub']) && is_array($resp['authorClub']) ? json_encode($resp['authorClub']) : null,
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
                                ':author_club' => isset($reply['authorClub']) && is_array($reply['authorClub']) ? json_encode($reply['authorClub']) : null,
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
        // Ensure parent issue row exists in SQLite so foreign key constraints never fail
        $checkStmt = $pdo->prepare("SELECT id FROM issues WHERE id = :id");
        $checkStmt->execute([':id' => $issueId]);
        if (!$checkStmt->fetch()) {
            $phStmt = $pdo->prepare("
                INSERT OR IGNORE INTO issues (
                    id, title, description, category, region, tags, author,
                    yes_count, no_count, is_deleted, created_at, updated_at
                ) VALUES (
                    :id, :title, '', 'Community & Neighborhood', 'Global / Remote', '[]', 'Community',
                    0, 0, 0, :created_at, :updated_at
                )
            ");
            $phStmt->execute([
                ':id' => $issueId,
                ':title' => $payload['issueTitle'] ?? 'Community Deliberation',
                ':created_at' => $now,
                ':updated_at' => $now,
            ]);
        }

        // 1. Insert or update the response
        $optionId = !empty($payload['optionId']) ? trim((string)$payload['optionId']) : null;
        $optionLabel = !empty($payload['optionLabel']) ? trim((string)$payload['optionLabel']) : null;
        $authorClubJson = (isset($payload['authorClub']) && is_array($payload['authorClub'])) ? json_encode($payload['authorClub']) : null;

        $stmt = $pdo->prepare("
            INSERT INTO responses (
                id, issue_id, choice, option_id, option_label, author_name, author_email, author_alias, author_role, author_club,
                is_anonymous, note, voice_note, likes_count, is_reported, created_at
            ) VALUES (
                :id, :issue_id, :choice, :option_id, :option_label, :author_name, :author_email, :author_alias, :author_role, :author_club,
                :is_anonymous, :note, :voice_note, :likes_count, :is_reported, :created_at
            )
            ON CONFLICT(id) DO UPDATE SET
                choice = excluded.choice,
                option_id = COALESCE(excluded.option_id, responses.option_id),
                option_label = COALESCE(excluded.option_label, responses.option_label),
                author_club = COALESCE(excluded.author_club, responses.author_club),
                note = excluded.note,
                voice_note = excluded.voice_note
        ");

        $stmt->execute([
            ':id' => $submissionId,
            ':issue_id' => $issueId,
            ':choice' => $choice,
            ':option_id' => $optionId,
            ':option_label' => $optionLabel,
            ':author_name' => $payload['authorName'] ?? 'Anonymous Neighbor',
            ':author_email' => $payload['authorEmail'] ?? null,
            ':author_alias' => $payload['authorAlias'] ?? null,
            ':author_role' => $payload['authorRole'] ?? null,
            ':author_club' => $authorClubJson,
            ':is_anonymous' => !empty($payload['isAnonymous']) ? 1 : 0,
            ':note' => $payload['note'] ?? null,
            ':voice_note' => isset($payload['voiceNote']) ? json_encode($payload['voiceNote']) : null,
            ':likes_count' => (int)($payload['likesCount'] ?? 0),
            ':is_reported' => 0,
            ':created_at' => $payload['createdAt'] ?? $now,
        ]);

        // 2. Atomically update multi-option counts or yes/no counters on issue
        $updatedOptions = null;
        if ($optionId !== null && $optionId !== '') {
            $optFetchStmt = $pdo->prepare("SELECT options_json FROM issues WHERE id = :id");
            $optFetchStmt->execute([':id' => $issueId]);
            $optRow = $optFetchStmt->fetch();
            $opts = (!empty($optRow['options_json'])) ? json_decode($optRow['options_json'], true) : null;
            if (is_array($opts)) {
                foreach ($opts as &$opt) {
                    if (is_array($opt) && ($opt['id'] ?? '') === $optionId) {
                        $opt['votes'] = (int)($opt['votes'] ?? 0) + 1;
                    }
                }
                unset($opt);
                $updatedOptions = $opts;
                $optUpStmt = $pdo->prepare("UPDATE issues SET options_json = :opts, updated_at = :now WHERE id = :id");
                $optUpStmt->execute([':opts' => json_encode($opts), ':now' => $now, ':id' => $issueId]);
            }
        } else {
            $isYes = strtoupper($choice) === 'YES';
            $updateSql = $isYes 
                ? "UPDATE issues SET yes_count = COALESCE(yes_count, 0) + 1, updated_at = :now WHERE id = :id"
                : "UPDATE issues SET no_count = COALESCE(no_count, 0) + 1, updated_at = :now WHERE id = :id";
            
            $upStmt = $pdo->prepare($updateSql);
            $upStmt->execute([':now' => $now, ':id' => $issueId]);
        }

        // Query authoritative counts from the database
        $cntStmt = $pdo->prepare("SELECT yes_count, no_count FROM issues WHERE id = :id");
        $cntStmt->execute([':id' => $issueId]);
        $countsRow = $cntStmt->fetch();

        $pdo->commit();
        $result = [
            'success' => true, 
            'submissionId' => $submissionId, 
            'yesCount' => (int)($countsRow['yes_count'] ?? 1),
            'noCount' => (int)($countsRow['no_count'] ?? 0),
            'updatedAt' => $now
        ];
        if (is_array($updatedOptions)) {
            $result['options'] = $updatedOptions;
        }
        return $result;
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
        $replyClubJson = (isset($reply['authorClub']) && is_array($reply['authorClub'])) ? json_encode($reply['authorClub']) : null;
        $stmt = $pdo->prepare("
            INSERT INTO replies (
                id, submission_id, issue_id, author_name, author_email, author_alias, author_role, author_club,
                is_anonymous, content, reply_to_name, likes_count, created_at
            ) VALUES (
                :id, :submission_id, :issue_id, :author_name, :author_email, :author_alias, :author_role, :author_club,
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
            ':author_club' => $replyClubJson,
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

function handle_get_user_profile(?PDO $pdo, ?string $email, string $profilesFallbackPath, ?string $username = null): ?array {
    $emailKey = strtolower(trim($email ?? ''));
    $usernameKey = strtolower(ltrim(trim($username ?? ''), '@'));
    if ($emailKey === '' && $usernameKey === '') return null;

    if ($pdo) {
        try {
            if ($emailKey !== '') {
                $stmt = $pdo->prepare("SELECT user_data FROM user_profiles WHERE lower(email) = :email LIMIT 1");
                $stmt->execute([':email' => $emailKey]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row && !empty($row['user_data'])) {
                    $decoded = json_decode($row['user_data'], true);
                    if (is_array($decoded)) {
                        return $decoded;
                    }
                }
            }

            if ($usernameKey !== '') {
                // 1. Try SQLite json_extract
                try {
                    $stmt = $pdo->prepare("SELECT user_data FROM user_profiles WHERE lower(json_extract(user_data, '$.username')) = :u OR lower(json_extract(user_data, '$.username')) = :at_u LIMIT 1");
                    $stmt->execute([':u' => $usernameKey, ':at_u' => '@' . $usernameKey]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row && !empty($row['user_data'])) {
                        $decoded = json_decode($row['user_data'], true);
                        if (is_array($decoded)) {
                            return $decoded;
                        }
                    }
                } catch (Exception $eJson) {
                    // Fallback to substring query if json_extract is unavailable in SQLite build
                }

                // 2. Fallback like search
                $stmt = $pdo->prepare("SELECT user_data FROM user_profiles WHERE lower(user_data) LIKE :pattern LIMIT 20");
                $stmt->execute([':pattern' => '%' . $usernameKey . '%']);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    if (!empty($r['user_data'])) {
                        $decoded = json_decode($r['user_data'], true);
                        if (is_array($decoded)) {
                            $u = strtolower(ltrim(trim($decoded['username'] ?? ''), '@'));
                            if ($u === $usernameKey) {
                                return $decoded;
                            }
                        }
                    }
                }
            }
        } catch (Exception $e) {
            error_log('Error fetching user profile from SQLite: ' . $e->getMessage());
        }
    }

    if (file_exists($profilesFallbackPath)) {
        $raw = @file_get_contents($profilesFallbackPath);
        $map = $raw ? json_decode($raw, true) : null;
        if (is_array($map)) {
            if ($emailKey !== '' && isset($map[$emailKey]) && is_array($map[$emailKey])) {
                return $map[$emailKey];
            }
            if ($usernameKey !== '') {
                foreach ($map as $prof) {
                    if (is_array($prof)) {
                        $u = strtolower(ltrim(trim($prof['username'] ?? ''), '@'));
                        if ($u === $usernameKey) {
                            return $prof;
                        }
                    }
                }
            }
        }
    }

    // Check seed personas file as well
    $seedFile = __DIR__ . '/data/seed_personas.json';
    if (file_exists($seedFile)) {
        $seedRaw = @file_get_contents($seedFile);
        $seedList = $seedRaw ? json_decode($seedRaw, true) : null;
        if (is_array($seedList)) {
            foreach ($seedList as $p) {
                if (is_array($p)) {
                    $pEmail = strtolower(trim($p['email'] ?? ''));
                    $pUsername = strtolower(ltrim(trim($p['username'] ?? ''), '@'));
                    if (($emailKey !== '' && $pEmail === $emailKey) || ($usernameKey !== '' && $pUsername === $usernameKey)) {
                        return $p;
                    }
                }
            }
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
// ADMIN USERS DIRECTORY & ACTIVITY AGGREGATION
// -------------------------------------------------------------

function handle_admin_users(?PDO $pdo, string $profilesFallbackPath): array {
    $usersMap = [];

    // Load seed personas to classify real vs system users accurately
    $seedFile = __DIR__ . '/data/seed_personas.json';
    $seedPersonasMap = [];
    if (file_exists($seedFile)) {
        $spData = json_decode(@file_get_contents($seedFile), true);
        if (is_array($spData)) {
            foreach ($spData as $sp) {
                $eKey = strtolower(trim($sp['email'] ?? ''));
                if ($eKey) {
                    $seedPersonasMap[$eKey] = $sp;
                }
                if (!empty($sp['id'])) {
                    $seedPersonasMap[strtolower(trim($sp['id']))] = $sp;
                }
                if (!empty($sp['username'])) {
                    $seedPersonasMap['@' . strtolower(trim($sp['username']))] = $sp;
                }
            }
        }
    }

    if ($pdo) {
        try {
            // 1. Load all stored user profiles
            $stmt = $pdo->query("SELECT email, user_data, updated_at FROM user_profiles");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $email = strtolower(trim($row['email']));
                if (!$email) continue;
                $data = json_decode($row['user_data'], true);
                if (is_array($data)) {
                    $usersMap[$email] = [
                        'profile' => $data,
                        'updated_at' => $row['updated_at'],
                    ];
                }
            }

            // 2. Aggregate votes & last vote from responses
            $voteAgg = [];
            $vStmt = $pdo->query("
                SELECT 
                    lower(trim(r.author_email)) as email,
                    count(*) as vote_count,
                    max(r.created_at) as last_vote_at,
                    r.author_name,
                    r.author_role
                FROM responses r
                WHERE r.author_email IS NOT NULL AND trim(r.author_email) != ''
                GROUP BY lower(trim(r.author_email))
            ");
            while ($vRow = $vStmt->fetch(PDO::FETCH_ASSOC)) {
                $em = $vRow['email'];
                $voteAgg[$em] = [
                    'count' => (int)$vRow['vote_count'],
                    'last_at' => $vRow['last_vote_at'],
                    'sample_name' => $vRow['author_name'] ?? '',
                    'sample_role' => $vRow['author_role'] ?? '',
                ];
            }

            // Also get most recent vote description for each email
            $recentVotesStmt = $pdo->query("
                SELECT lower(trim(r.author_email)) as email, r.choice, r.created_at, i.title
                FROM responses r
                LEFT JOIN issues i ON r.issue_id = i.id
                WHERE r.author_email IS NOT NULL AND trim(r.author_email) != ''
                ORDER BY r.created_at DESC
            ");
            while ($rv = $recentVotesStmt->fetch(PDO::FETCH_ASSOC)) {
                $em = $rv['email'];
                if (isset($voteAgg[$em]) && !isset($voteAgg[$em]['last_desc'])) {
                    $issueTitle = $rv['title'] ? substr($rv['title'], 0, 50) . '...' : 'an issue';
                    $voteAgg[$em]['last_desc'] = "Voted " . ($rv['choice'] ?: 'YES') . " on: " . $issueTitle;
                }
            }

            // 3. Aggregate issues created from issues table
            $issueAgg = [];
            $iStmt = $pdo->query("
                SELECT 
                    lower(trim(creator_email)) as email,
                    count(*) as issue_count,
                    max(created_at) as last_issue_at,
                    author
                FROM issues
                WHERE is_deleted = 0 AND creator_email IS NOT NULL AND trim(creator_email) != ''
                GROUP BY lower(trim(creator_email))
            ");
            while ($iRow = $iStmt->fetch(PDO::FETCH_ASSOC)) {
                $em = $iRow['email'];
                $issueAgg[$em] = [
                    'count' => (int)$iRow['issue_count'],
                    'last_at' => $iRow['last_issue_at'],
                    'sample_name' => $iRow['author'] ?? '',
                ];
            }

            $recentIssuesStmt = $pdo->query("
                SELECT lower(trim(creator_email)) as email, title, created_at
                FROM issues
                WHERE is_deleted = 0 AND creator_email IS NOT NULL AND trim(creator_email) != ''
                ORDER BY created_at DESC
            ");
            while ($ri = $recentIssuesStmt->fetch(PDO::FETCH_ASSOC)) {
                $em = $ri['email'];
                if (isset($issueAgg[$em]) && !isset($issueAgg[$em]['last_desc'])) {
                    $issueAgg[$em]['last_desc'] = "Created issue: " . substr($ri['title'] ?? '', 0, 50) . '...';
                }
            }

            // 4. Aggregate comments from replies table
            $replyAgg = [];
            $rStmt = $pdo->query("
                SELECT 
                    lower(trim(author_email)) as email,
                    count(*) as reply_count,
                    max(created_at) as last_reply_at,
                    author_name
                FROM replies
                WHERE author_email IS NOT NULL AND trim(author_email) != ''
                GROUP BY lower(trim(author_email))
            ");
            while ($rRow = $rStmt->fetch(PDO::FETCH_ASSOC)) {
                $em = $rRow['email'];
                $replyAgg[$em] = [
                    'count' => (int)$rRow['reply_count'],
                    'last_at' => $rRow['last_reply_at'],
                    'sample_name' => $rRow['author_name'] ?? '',
                ];
            }

            $recentRepliesStmt = $pdo->query("
                SELECT lower(trim(author_email)) as email, content, created_at
                FROM replies
                WHERE author_email IS NOT NULL AND trim(author_email) != ''
                ORDER BY created_at DESC
            ");
            while ($rr = $recentRepliesStmt->fetch(PDO::FETCH_ASSOC)) {
                $em = $rr['email'];
                if (isset($replyAgg[$em]) && !isset($replyAgg[$em]['last_desc'])) {
                    $replyAgg[$em]['last_desc'] = 'Commented: "' . substr(strip_tags($rr['content'] ?? ''), 0, 45) . '..."';
                }
            }

            // 5. Gather all unique emails (from profiles, responses, issues, replies, and seed personas)
            $seedEmails = array_filter(array_keys($seedPersonasMap), function($k) {
                return strpos($k, '@') !== false && strpos($k, '@') > 0;
            });

            $allEmails = array_unique(array_merge(
                array_keys($usersMap),
                array_keys($voteAgg),
                array_keys($issueAgg),
                array_keys($replyAgg),
                $seedEmails
            ));

            $resultUsers = [];
            foreach ($allEmails as $email) {
                $entry = $usersMap[$email] ?? null;
                $profile = $entry ? ($entry['profile'] ?? []) : [];
                $updatedAt = $entry ? ($entry['updated_at'] ?? null) : null;

                $vData = $voteAgg[$email] ?? null;
                $iData = $issueAgg[$email] ?? null;
                $rData = $replyAgg[$email] ?? null;

                $id = $profile['id'] ?? ('usr_' . substr(md5($email), 0, 12));
                $emailParts = explode('@', $email);
                $fallbackHandle = preg_replace('/[^a-z0-9_]/i', '_', $emailParts[0] ?? 'user');

                // Check against seed personas map
                $matchedSeed = $seedPersonasMap[$email] ?? ($seedPersonasMap[strtolower($id)] ?? null);
                if (!$matchedSeed && !empty($profile['username'])) {
                    $matchedSeed = $seedPersonasMap['@' . strtolower(trim($profile['username']))] ?? null;
                }
                if (!$matchedSeed && !empty($profile['id'])) {
                    $matchedSeed = $seedPersonasMap[strtolower(trim($profile['id']))] ?? null;
                }

                $name = !empty($profile['name']) ? $profile['name'] : (
                    !empty($matchedSeed['name']) ? $matchedSeed['name'] : (
                        !empty($vData['sample_name']) ? $vData['sample_name'] : (
                            !empty($iData['sample_name']) ? $iData['sample_name'] : (
                                !empty($rData['sample_name']) ? $rData['sample_name'] : ucwords(str_replace(['.', '_', '-'], ' ', $emailParts[0] ?? 'User'))
                            )
                        )
                    )
                );

                $username = !empty($profile['username']) ? $profile['username'] : (!empty($matchedSeed['username']) ? $matchedSeed['username'] : $fallbackHandle);
                $role = !empty($profile['role']) ? $profile['role'] : (!empty($matchedSeed['role']) ? $matchedSeed['role'] : (!empty($vData['sample_role']) ? $vData['sample_role'] : 'Civic Participant'));
                $bio = !empty($profile['bio']) ? $profile['bio'] : ($matchedSeed['bio'] ?? '');
                $avatar = !empty($profile['avatar']) ? $profile['avatar'] : ($matchedSeed['avatar'] ?? '');
                $region = !empty($profile['region']) ? $profile['region'] : ($matchedSeed['region'] ?? '');
                $groups = $profile['groups'] ?? [];
                $interests = !empty($profile['interests']) ? $profile['interests'] : ($matchedSeed['interests'] ?? []);

                if ($matchedSeed && (empty($id) || strpos($id, 'usr_') === 0)) {
                    $id = $matchedSeed['id'] ?? $id;
                }

                // Determine userType: registered (real citizen) vs seed (system AI persona)
                $isSeed = ($matchedSeed !== null) || (strpos($id, 'pers-') === 0) || (($profile['userType'] ?? '') === 'seed') || (isset($profile['id']) && strpos($profile['id'], 'pers-') === 0);
                $userType = $isSeed ? 'seed' : 'registered';

                // Determine isVerified & badge
                $isGmail = (strpos($email, '@gmail.') !== false) || (strpos($email, '@googlemail.') !== false);
                $isOfficialDomain = preg_match('/\.(gov|edu|org|mil)(\.[a-z]{2})?$/i', $email) === 1;
                $isVerified = isset($profile['isVerified']) ? (bool)$profile['isVerified'] : ($isGmail || $isOfficialDomain || $isSeed);

                $verificationBadge = $profile['verificationBadge'] ?? (
                    $isGmail ? 'google' : ($isOfficialDomain ? 'official' : ($isVerified ? 'resident' : 'none'))
                );

                // Registered At timestamp
                $registeredAt = $profile['registeredAt'] ?? null;
                if (!$registeredAt) {
                    $candidates = array_filter([
                        $updatedAt,
                        $vData['last_at'] ?? null,
                        $iData['last_at'] ?? null,
                        $rData['last_at'] ?? null
                    ]);
                    $registeredAt = !empty($candidates) ? min($candidates) : gmdate('Y-m-d\TH:i:s\Z');
                }

                // Last Login At
                $lastLoginAt = $profile['lastLoginAt'] ?? (
                    $updatedAt ?: (
                        $vData['last_at'] ?? (
                            $iData['last_at'] ?? (
                                $rData['last_at'] ?? $registeredAt
                            )
                        )
                    )
                );

                // Compute counts
                $votesCount = max(
                    $vData ? $vData['count'] : 0,
                    isset($profile['votedIssues']) && is_array($profile['votedIssues']) ? count($profile['votedIssues']) : 0
                );
                $issuesCount = $iData ? $iData['count'] : 0;
                $commentsCount = $rData ? $rData['count'] : 0;

                // Determine most recent action
                $actions = [];
                if (!empty($vData['last_at'])) {
                    $actions[] = [
                        'at' => $vData['last_at'],
                        'desc' => $vData['last_desc'] ?? 'Cast a vote on an issue'
                    ];
                }
                if (!empty($iData['last_at'])) {
                    $actions[] = [
                        'at' => $iData['last_at'],
                        'desc' => $iData['last_desc'] ?? 'Published a civic issue'
                    ];
                }
                if (!empty($rData['last_at'])) {
                    $actions[] = [
                        'at' => $rData['last_at'],
                        'desc' => $rData['last_desc'] ?? 'Posted a deliberative comment'
                    ];
                }
                if ($updatedAt) {
                    $actions[] = [
                        'at' => $updatedAt,
                        'desc' => 'Updated civic profile and preferences'
                    ];
                }

                usort($actions, function($a, $b) {
                    return strcmp($b['at'], $a['at']);
                });

                $lastActionObj = !empty($actions) ? $actions[0] : null;
                $lastActionAt = $lastActionObj ? $lastActionObj['at'] : $lastLoginAt;
                $lastAction = $lastActionObj ? $lastActionObj['desc'] : 'Active on YesOrNo platform';

                $acquisitionSource = !empty($profile['acquisitionSource']) ? $profile['acquisitionSource'] : (
                    $isSeed ? 'AI Seed Engine' : 'Direct / Organic'
                );
                $landingPath = $profile['registrationSource']['landingPath'] ?? ($profile['landingPath'] ?? null);

                $resultUsers[] = [
                    'id' => $id,
                    'name' => $name,
                    'username' => $username,
                    'email' => $email,
                    'role' => $role,
                    'avatar' => $avatar,
                    'bio' => $bio,
                    'region' => $region,
                    'userType' => $userType,
                    'isVerified' => (bool)$isVerified,
                    'verificationBadge' => $verificationBadge,
                    'registeredAt' => $registeredAt,
                    'lastLoginAt' => $lastLoginAt,
                    'lastActionAt' => $lastActionAt,
                    'lastAction' => $lastAction,
                    'votesCount' => $votesCount,
                    'issuesCount' => $issuesCount,
                    'commentsCount' => $commentsCount,
                    'groups' => $groups,
                    'interests' => $interests,
                    'acquisitionSource' => $acquisitionSource,
                    'landingPath' => $landingPath,
                ];
            }

            // Sort by lastActionAt or lastLoginAt descending by default
            usort($resultUsers, function($a, $b) {
                return strcmp($b['lastActionAt'] ?? $b['lastLoginAt'], $a['lastActionAt'] ?? $a['lastLoginAt']);
            });

            $registeredCount = 0;
            $seedCount = 0;
            $verifiedCount = 0;
            foreach ($resultUsers as $u) {
                if ($u['userType'] === 'registered') $registeredCount++;
                if ($u['userType'] === 'seed') $seedCount++;
                if (!empty($u['isVerified'])) $verifiedCount++;
            }

            return [
                'success' => true,
                'totalCount' => count($resultUsers),
                'registeredCount' => $registeredCount,
                'seedCount' => $seedCount,
                'verifiedCount' => $verifiedCount,
                'users' => $resultUsers,
            ];

        } catch (Exception $e) {
            error_log('Error generating admin users report: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    return ['success' => false, 'error' => 'Database connection unavailable'];
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
            $username = trim($_GET['username'] ?? $_GET['handle'] ?? '');
            $profile = handle_get_user_profile(null, $email, $profilesFallbackPath, $username);
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
                $username = trim($payload['username'] ?? $payload['handle'] ?? '');
                $profile = handle_get_user_profile(null, $email, $profilesFallbackPath, $username);
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
    if (isset($_GET['action']) && $_GET['action'] === 'admin_users') {
        $res = handle_admin_users($pdo, $profilesFallbackPath);
        echo json_encode($res);
        exit;
    }

    if (isset($_GET['action']) && $_GET['action'] === 'get_profile') {
        $email = trim($_GET['email'] ?? '');
        $username = trim($_GET['username'] ?? $_GET['handle'] ?? '');
        $profile = handle_get_user_profile($pdo, $email, $profilesFallbackPath, $username);
        echo json_encode(['success' => true, 'profile' => $profile]);
        exit;
    }

    $since = isset($_GET['since']) ? $_GET['since'] : null;
    $zone = isset($_GET['zone']) ? trim($_GET['zone']) : null;
    $data = fetch_hydrated_issues_sqlite($pdo, $since, $zone);
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
        case 'admin_users':
            $res = handle_admin_users($pdo, $profilesFallbackPath);
            echo json_encode($res);
            exit;

        case 'get_profile':
            $email = trim($payload['email'] ?? '');
            $username = trim($payload['username'] ?? $payload['handle'] ?? '');
            $profile = handle_get_user_profile($pdo, $email, $profilesFallbackPath, $username);
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
