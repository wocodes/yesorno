<?php
/**
 * YesOrNo FanZone - Autonomous Football AI Curator & Live RSS Engine
 *
 * Features:
 * - Pulls live global football headlines from BBC Sport, ESPN FC, and The Guardian RSS
 * - Generates matchday debates, transfer verdicts, and 3-4 option polls via Gemini
 * - Falls back to curated global football hot takes when no Gemini key is configured
 * - Persists directly into yesorno.sqlite with zone = 'fanzone' and club-affiliated fan responses
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/data';
$dbPath = $dataDir . '/yesorno.sqlite';
$settingsPath = $dataDir . '/curator_settings.json';
$fzPersonasPath = $dataDir . '/fanzone_personas.json';

function fz_get_settings($settingsPath) {
    $defaults = [
        'isEnabled' => true,
        'geminiApiKey' => '',
        'model' => 'gemini-2.5-flash',
        'minTargetVotes' => 65,
        'maxTargetVotes' => 145,
    ];
    if (file_exists($settingsPath)) {
        $raw = @file_get_contents($settingsPath);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return array_merge($defaults, $decoded);
        }
    }
    return $defaults;
}

function fz_get_pdo($dbPath) {
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers())) {
        return null;
    }
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA journal_mode = WAL;');
        return $pdo;
    } catch (Exception $e) {
        return null;
    }
}

function fz_load_personas($fzPersonasPath) {
    if (file_exists($fzPersonasPath)) {
        $raw = @file_get_contents($fzPersonasPath);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) return $decoded;
    }
    return [];
}

function fz_seed_personas_db(PDO $pdo, array $personas) {
    $stmt = $pdo->prepare("
        INSERT INTO user_profiles (email, user_data, updated_at)
        VALUES (:email, :data, :updated_at)
        ON CONFLICT(email) DO UPDATE SET
            user_data = excluded.user_data,
            updated_at = excluded.updated_at
    ");
    $now = gmdate('Y-m-d\TH:i:s\Z');
    foreach ($personas as $p) {
        if (empty($p['email'])) continue;
        $stmt->execute([
            ':email' => strtolower(trim($p['email'])),
            ':data' => json_encode($p, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':updated_at' => $now,
        ]);
    }
}

/**
 * Fetches live global football headlines via free public RSS feeds.
 */
function fetch_live_football_rss_headlines($limit = 12) {
    $feeds = [
        'BBC Sport' => 'https://feeds.bbci.co.uk/sport/football/rss.xml',
        'ESPN FC' => 'https://www.espn.com/espn/rss/soccer/news',
        'The Guardian' => 'https://www.theguardian.com/football/rss',
    ];

    $headlines = [];
    if (!function_exists('curl_init') || !function_exists('simplexml_load_string')) {
        return $headlines;
    }

    foreach ($feeds as $source => $url) {
        try {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_USERAGENT, 'FanZoneBot/1.0');
            $xmlRaw = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code >= 200 && $code < 300 && !empty($xmlRaw)) {
                libxml_use_internal_errors(true);
                $xml = @simplexml_load_string($xmlRaw);
                libxml_clear_errors();
                if ($xml && isset($xml->channel->item)) {
                    $count = 0;
                    foreach ($xml->channel->item as $item) {
                        $title = trim((string)$item->title);
                        if ($title !== '') {
                            $headlines[] = "[{$source}] {$title}";
                            $count++;
                        }
                        if ($count >= 4) break;
                    }
                }
            }
        } catch (Exception $e) {
            // Skip unreachable RSS source gracefully
        }
    }

    return array_slice($headlines, 0, $limit);
}

function fz_call_gemini($prompt, $apiKey, $model = 'gemini-2.5-flash') {
    if (empty($apiKey) || !function_exists('curl_init')) return null;
    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
    $body = json_encode([
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature' => 0.9,
            'responseMimeType' => 'application/json',
        ],
    ]);

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code < 200 || $code >= 300 || empty($res)) return null;
    $data = json_decode($res, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if (!$text) return null;
    $parsed = json_decode($text, true);
    return is_array($parsed) ? $parsed : null;
}

function fz_fallback_debates() {
    return [
        [
            'title' => 'Which club is the biggest favorite to lift this season\'s UEFA Champions League trophy?',
            'description' => 'With knockout intensity heating up across Europe, rival fanbases are split on who has the squad depth and big-game mentality to go all the way.',
            'category' => 'Champions League',
            'tags' => ['Real Madrid', 'Arsenal', 'Liverpool', 'Barcelona', 'UCL'],
            'pollType' => 'multi',
            'yesLabel' => 'YES',
            'noLabel' => 'NO',
            'options' => [
                ['id' => 'opt-1', 'label' => 'Real Madrid', 'votes' => 42, 'color' => '#10b981'],
                ['id' => 'opt-2', 'label' => 'Liverpool', 'votes' => 31, 'color' => '#3b82f6'],
                ['id' => 'opt-3', 'label' => 'FC Barcelona', 'votes' => 26, 'color' => '#f59e0b'],
                ['id' => 'opt-4', 'label' => 'Arsenal', 'votes' => 22, 'color' => '#f43f5e'],
            ],
            'responses' => [
                ['choice' => 'YES', 'optionId' => 'opt-1', 'optionLabel' => 'Real Madrid', 'note' => 'Until someone knocks them out in the spring, betting against Real Madrid in the UCL is just charity.'],
                ['choice' => 'YES', 'optionId' => 'opt-2', 'optionLabel' => 'Liverpool', 'votes' => 0, 'note' => 'Anfield under the floodlights plus the cleanest transition attack in Europe right now.'],
                ['choice' => 'YES', 'optionId' => 'opt-3', 'optionLabel' => 'FC Barcelona', 'note' => 'If our teenagers stay fit, nobody can live with that high-press tempo over two legs.'],
                ['choice' => 'YES', 'optionId' => 'opt-4', 'optionLabel' => 'Arsenal', 'note' => 'Best defensive structure and set-piece threat left in the draw. Do not sleep on N5.'],
            ],
        ],
        [
            'title' => 'Real talk: Has Chelsea\'s aggressive youth-heavy transfer strategy finally been vindicated?',
            'description' => 'Critics mocked the eight-year contracts and massive turnover two seasons ago, but the Blues are suddenly playing electric, fearless football.',
            'category' => 'Premier League',
            'tags' => ['Chelsea', 'PremierLeague', 'ColePalmer'],
            'pollType' => 'binary',
            'yesLabel' => 'FACT',
            'noLabel' => 'CAP',
            'responses' => [
                ['choice' => 'YES', 'note' => 'FACT. Cole Palmer alone justifies half the rebuild and the wage structure is miles healthier now.'],
                ['choice' => 'NO', 'note' => 'CAP. One good run does not erase £1bn spent without a league title or UCL trophy yet.'],
                ['choice' => 'YES', 'note' => 'Credit where due—they look younger, faster, and hungrier than half the top six.'],
                ['choice' => 'NO', 'note' => 'Wait until they play three top sides in ten days before printing trophies.'],
            ],
        ],
        [
            'title' => 'If Arsenal finish another season without major silverware, should Mikel Arteta be backed or sacked?',
            'description' => 'Arsenal fans point to back-to-back title pushes and tactical stability, while rivals claim five years of heavy backing demands trophies now.',
            'category' => 'Premier League',
            'tags' => ['Arsenal', 'Arteta', 'PremierLeague'],
            'pollType' => 'binary',
            'yesLabel' => 'BACK',
            'noLabel' => 'SACK',
            'responses' => [
                ['choice' => 'YES', 'note' => 'BACK 100%. Remembering the banter era—Arteta turned Arsenal back into an elite European powerhouse.'],
                ['choice' => 'NO', 'note' => 'You cannot spend £700m+ and call finishing second a dynasty forever. Silverware or move on.'],
                ['choice' => 'YES', 'note' => 'Sacking a manager competing on all fronts because Man City/Liverpool exist would be pure madness.'],
                ['choice' => 'NO', 'note' => 'Too rigid in big knockout moments. Sometimes a fresh voice unlocks the final step.'],
            ],
        ],
        [
            'title' => 'Should Premier League clubs cash in on aging club legends when £60m+ Saudi Pro League bids arrive?',
            'description' => 'Loyalty vs PSR sustainability: should boards prioritize emotional farewells or ruthless squad reinvestment?',
            'category' => 'Transfers & Rumors',
            'tags' => ['Transfers', 'Liverpool', 'ManUtd', 'AlNassr'],
            'pollType' => 'binary',
            'yesLabel' => 'SIGN',
            'noLabel' => 'PASS',
            'responses' => [
                ['choice' => 'YES', 'note' => 'Sell at peak value, fund two 22-year-old starters, and stay ahead of PSR rules.'],
                ['choice' => 'NO', 'note' => 'Some players mean more than an accounting spreadsheet. Look at how leaders carry dressing rooms.'],
                ['choice' => 'YES', 'note' => 'Madrid let legends go on time and keep winning UCLs. Emotion ruins rebuilds.'],
                ['choice' => 'NO', 'note' => 'You cannot replace 25 goals a season guaranteed just with spreadsheets.'],
            ],
        ],
        [
            'title' => 'Which football debate deserves to be settled right now: Best manager of the modern era?',
            'description' => 'Four iconic tactical blueprints—which gaffer stands alone at the summit when all trophies and legacies are weighed?',
            'category' => 'GOAT & Legacy',
            'tags' => ['ManCity', 'ManUtd', 'RealMadrid', 'Liverpool'],
            'pollType' => 'multi',
            'yesLabel' => 'YES',
            'noLabel' => 'NO',
            'options' => [
                ['id' => 'opt-1', 'label' => 'Pep Guardiola', 'votes' => 38, 'color' => '#10b981'],
                ['id' => 'opt-2', 'label' => 'Carlo Ancelotti', 'votes' => 29, 'color' => '#3b82f6'],
                ['id' => 'opt-3', 'label' => 'Sir Alex Ferguson', 'votes' => 34, 'color' => '#f59e0b'],
                ['id' => 'opt-4', 'label' => 'Jürgen Klopp', 'votes' => 16, 'color' => '#f43f5e'],
            ],
            'responses' => [
                ['choice' => 'YES', 'optionId' => 'opt-1', 'optionLabel' => 'Pep Guardiola', 'note' => 'Changed how the entire sport is coached from grassroots to World Cups. Unmatched dominance.'],
                ['choice' => 'YES', 'optionId' => 'opt-2', 'optionLabel' => 'Carlo Ancelotti', 'note' => 'Won every top 5 league and 5 UCLs across different eras without needing a £1bn rebuild.'],
                ['choice' => 'YES', 'optionId' => 'opt-3', 'optionLabel' => 'Sir Alex Ferguson', 'note' => 'Built three separate title-winning dynasties with pure mentality and Aberdeen on his CV too.'],
            ],
        ],
    ];
}

function generate_fanzone_debate($personas, $apiKey, $model, PDO $pdo) {
    $rssHeadlines = fetch_live_football_rss_headlines(12);
    $existingTitles = [];
    try {
        $stmt = $pdo->query("SELECT title FROM issues WHERE zone = 'fanzone' AND is_deleted = 0 ORDER BY created_at DESC LIMIT 20");
        while ($row = $stmt->fetch()) {
            $existingTitles[] = $row['title'];
        }
    } catch (Exception $e) {}

    if (!empty($apiKey) && !empty($rssHeadlines)) {
        $headlinesStr = implode("\n- ", $rssHeadlines);
        $excludeStr = !empty($existingTitles) ? implode(" | ", $existingTitles) : 'None';
        $useMulti = (rand(1, 100) <= 35);
        $formatInstruction = $useMulti
            ? 'Create a MULTI-OPTION poll ("pollType": "multi") with 3 or 4 short punchy choices in "options": [{"id":"opt-1","label":"...","votes":0},{"id":"opt-2","label":"...","votes":0},...]. Include "yesLabel":"YES","noLabel":"NO".'
            : 'Create a BINARY debate ("pollType": "binary") picking the best preset pair for ("yesLabel","noLabel") from: ["FACT","CAP"], ["BACK","SACK"], ["PENALTY","NO PEN"], ["SIGN","PASS"], ["GOAT","OVERRATED"], or ["YES","NO"].';

        $prompt = "You are FanZone's viral global football debate producer. Based on these LIVE football news headlines:\n- {$headlinesStr}\n\nAvoid duplicating these existing topics: {$excludeStr}\n\n{$formatInstruction}\nGenerate 1 sharp, banter-worthy global football debate topic as strict JSON with keys:\n{\n  \"title\": \"Punchy question ending with ? (under 140 chars)\",\n  \"description\": \"2-sentence balanced fan controversy framing both sides\",\n  \"category\": \"One of: Premier League | Champions League | La Liga | Serie A & Bundesliga | International & World Cup | Transfers & Rumors | VAR & Officiating | GOAT & Legacy | Matchday Banter\",\n  \"tags\": [\"ClubName\", \"PlayerOrTopic\"],\n  \"pollType\": \"binary\" or \"multi\",\n  \"yesLabel\": \"...\",\n  \"noLabel\": \"...\",\n  \"options\": [... if multi ...],\n  \"responses\": [\n    {\"choice\": \"YES\" or \"NO\", \"optionId\": \"opt-1 if multi\", \"optionLabel\": \"...\", \"note\": \"Authentic short fan banter comment (1-2 sentences)\"}\n  ]\n}\nInclude 4 diverse fan responses.";

        $generated = fz_call_gemini($prompt, $apiKey, $model);
        if (is_array($generated) && !empty($generated['title'])) {
            return $generated;
        }
    }

    // Curated fallback rotation
    $bank = fz_fallback_debates();
    foreach ($bank as $candidate) {
        $candNorm = preg_replace('/[^a-z0-9]/', '', strtolower($candidate['title']));
        $dup = false;
        foreach ($existingTitles as $ex) {
            if (preg_replace('/[^a-z0-9]/', '', strtolower($ex)) === $candNorm) {
                $dup = true;
                break;
            }
        }
        if (!$dup) return $candidate;
    }

    return null;
}

function persist_fanzone_debate(PDO $pdo, array $personas, array $debateData, array $settings) {
    if (empty($debateData['title'])) return null;

    $normalizedNew = preg_replace('/[^a-z0-9]/', '', strtolower($debateData['title']));
    $chk = $pdo->query("SELECT id, title FROM issues WHERE is_deleted = 0");
    while ($row = $chk->fetch()) {
        if (preg_replace('/[^a-z0-9]/', '', strtolower($row['title'])) === $normalizedNew) {
            return ['duplicate' => true, 'issueId' => $row['id'], 'title' => $row['title']];
        }
    }

    $now = gmdate('Y-m-d\TH:i:s\Z');
    $issueId = 'issue-fz-' . bin2hex(random_bytes(5));
    $pollType = ($debateData['pollType'] ?? 'binary') === 'multi' ? 'multi' : 'binary';
    $yesLabel = $debateData['yesLabel'] ?? 'YES';
    $noLabel = $debateData['noLabel'] ?? 'NO';
    $options = ($pollType === 'multi' && !empty($debateData['options']) && is_array($debateData['options']))
        ? $debateData['options']
        : null;

    $minVotes = max(45, (int)($settings['minTargetVotes'] ?? 65));
    $maxVotes = max($minVotes + 15, (int)($settings['maxTargetVotes'] ?? 145));
    $totalVotes = rand($minVotes, $maxVotes);
    $yesPct = rand(42, 61) / 100.0;
    $yesCount = $pollType === 'multi' ? 0 : (int)round($totalVotes * $yesPct);
    $noCount = $pollType === 'multi' ? 0 : ($totalVotes - $yesCount);

    $authorPersona = !empty($personas) ? $personas[array_rand($personas)] : [
        'id' => 'fz-pers-marco-rossi',
        'name' => 'Marco Rossi',
        'email' => 'marco.rossi@fanzone.football',
    ];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO issues (
                id, zone, poll_type, yes_label, no_label, options_json,
                title, description, category, region, tags, author, creator_id, creator_email,
                is_anonymous_author, closing_date, duration_label, visibility, invited_emails, invited_groups,
                yes_count, no_count, likes_count, favorites_count, views_count, impressions_count,
                featured, is_deleted, created_at, updated_at
            ) VALUES (
                :id, 'fanzone', :poll_type, :yes_label, :no_label, :options_json,
                :title, :description, :category, 'Global / Remote', :tags, :author, :creator_id, :creator_email,
                0, :closing_date, '7 Days', 'public', '[]', '[]',
                :yes_count, :no_count, :likes_count, :favorites_count, :views_count, :impressions_count,
                1, 0, :created_at, :updated_at
            )
        ");

        $stmt->execute([
            ':id' => $issueId,
            ':poll_type' => $pollType,
            ':yes_label' => $yesLabel,
            ':no_label' => $noLabel,
            ':options_json' => $options ? json_encode($options) : null,
            ':title' => $debateData['title'],
            ':description' => $debateData['description'] ?? '',
            ':category' => $debateData['category'] ?? 'Matchday Banter',
            ':tags' => json_encode($debateData['tags'] ?? ['Football']),
            ':author' => $authorPersona['name'],
            ':creator_id' => $authorPersona['id'] ?? null,
            ':creator_email' => $authorPersona['email'] ?? null,
            ':closing_date' => gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400),
            ':yes_count' => $yesCount,
            ':no_count' => $noCount,
            ':likes_count' => rand(12, 40),
            ':favorites_count' => rand(4, 15),
            ':views_count' => rand(180, 480),
            ':impressions_count' => rand(400, 950),
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);

        if (!empty($debateData['responses']) && is_array($debateData['responses']) && !empty($personas)) {
            $respStmt = $pdo->prepare("
                INSERT INTO responses (
                    id, issue_id, choice, option_id, option_label, author_name, author_email,
                    author_role, author_club, is_anonymous, note, likes_count, is_reported, created_at
                ) VALUES (
                    :id, :issue_id, :choice, :option_id, :option_label, :author_name, :author_email,
                    :author_role, :author_club, 0, :note, :likes_count, 0, :created_at
                )
            ");
            $shuffled = $personas;
            shuffle($shuffled);
            foreach ($debateData['responses'] as $idx => $r) {
                $p = $shuffled[$idx % count($shuffled)];
                $respStmt->execute([
                    ':id' => 'sub-fz-' . bin2hex(random_bytes(5)),
                    ':issue_id' => $issueId,
                    ':choice' => $r['choice'] ?? 'YES',
                    ':option_id' => $r['optionId'] ?? null,
                    ':option_label' => $r['optionLabel'] ?? null,
                    ':author_name' => $p['name'],
                    ':author_email' => $p['email'],
                    ':author_role' => $p['role'] ?? 'Football Fan',
                    ':author_club' => !empty($p['favoriteClub']) ? json_encode($p['favoriteClub']) : null,
                    ':note' => $r['note'] ?? '',
                    ':likes_count' => rand(2, 24),
                    ':created_at' => gmdate('Y-m-d\TH:i:s\Z', time() - (count($debateData['responses']) - $idx) * 180),
                ]);
            }
        }

        $pdo->commit();
        return ['success' => true, 'issueId' => $issueId, 'title' => $debateData['title'], 'zone' => 'fanzone'];
    } catch (Exception $e) {
        $pdo->rollBack();
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

// EXECUTION ROUTER
$pdo = fz_get_pdo($dbPath);
$settings = fz_get_settings($settingsPath);
$personas = fz_load_personas($fzPersonasPath);

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$isCli = (php_sapi_name() === 'cli');

if ($action === 'seed_fanzone') {
    if (!$pdo) {
        echo json_encode(['success' => false, 'error' => 'Database offline']);
        exit;
    }
    if (!empty($personas)) {
        fz_seed_personas_db($pdo, $personas);
    }
    $created = [];
    foreach (fz_fallback_debates() as $d) {
        $res = persist_fanzone_debate($pdo, $personas, $d, $settings);
        if ($res && empty($res['duplicate'])) {
            $created[] = $res;
        }
    }
    echo json_encode(['success' => true, 'personasSeeded' => count($personas), 'created' => $created]);
    exit;
}

if ($action === 'generate_fanzone' || $isCli) {
    if (!$pdo) {
        echo json_encode(['success' => false, 'error' => 'Database offline']);
        exit;
    }
    if (!empty($personas)) {
        fz_seed_personas_db($pdo, $personas);
    }
    $debate = generate_fanzone_debate($personas, $settings['geminiApiKey'] ?? '', $settings['model'] ?? 'gemini-2.5-flash', $pdo);
    $res = $debate ? persist_fanzone_debate($pdo, $personas, $debate, $settings) : ['success' => false, 'message' => 'No unique debate generated'];
    echo json_encode(['success' => true, 'result' => $res]);
    exit;
}

echo json_encode([
    'success' => true,
    'service' => 'FanZone AI Curator',
    'personasCount' => count($personas),
    'liveHeadlinesSample' => fetch_live_football_rss_headlines(4),
]);
