<?php
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=UTF-8');
        }
        echo json_encode(['success' => false, 'error' => $error['message'] ?? 'Fatal PHP error', 'details' => $error]);
        exit;
    }
});
/**
 * YesOrNo - Autonomous AI Curation & Debate Engine
 * Powered by Gemini API & Multi-Persona Synthetic Deliberation
 * 
 * Features:
 * - Master Admin Kill Switch (ON / PAUSED)
 * - 50+ Diverse Intellectual Personas (Economists, Historians, Analysts, etc.)
 * - Automatic Issue Generation & Seeded Perspectives (YES / NO / Threaded Rebuttals)
 * - Gradual Vote Ramp Simulation (~85 to ~140 votes with natural variance)
 * - Cron & Webhook support for periodic autonomous runs
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

$dbPath = $dataDir . '/yesorno.sqlite';
$settingsPath = $dataDir . '/curator_settings.json';
$personasPath = $dataDir . '/seed_personas.json';

// Initialize Settings
function get_curator_settings($settingsPath) {
    $defaults = [
        'isEnabled' => true,
        'geminiApiKey' => '',
        'model' => 'gemini-1.5-flash',
        'intervalHours' => 2,
        'lastRunAt' => null,
        'minTargetVotes' => 85,
        'maxTargetVotes' => 140,
        'minResponses' => 4,
        'maxResponses' => 6,
        'recentCurations' => []
    ];

    if (file_exists($settingsPath)) {
        $raw = @file_get_contents($settingsPath);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return array_merge($defaults, $decoded);
        }
    }

    @file_put_contents($settingsPath, json_encode($defaults, JSON_PRETTY_PRINT));
    return $defaults;
}

function save_curator_settings($settingsPath, $settings) {
    @file_put_contents($settingsPath, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

// Get SQLite Connection with Auto-Schema
function get_curator_pdo($dbPath) {
    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers())) {
        return null;
    }
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA journal_mode = WAL;');

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

            CREATE TABLE IF NOT EXISTS user_profiles (
                email TEXT PRIMARY KEY,
                user_data TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        ");

        // Auto-migration: ensure views_count and impressions_count exist
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN views_count INTEGER DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE issues ADD COLUMN impressions_count INTEGER DEFAULT 0");
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

        return $pdo;
    } catch (Exception $e) {
        return null;
    }
}

// Load Personas
function load_seed_personas($personasPath) {
    if (!file_exists($personasPath)) {
        return [];
    }
    $raw = @file_get_contents($personasPath);
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// Seed Personas into user_profiles table
function seed_personas_into_db(PDO $pdo, $personas) {
    $count = 0;
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $stmt = $pdo->prepare("
        INSERT INTO user_profiles (email, user_data, updated_at)
        VALUES (:email, :user_data, :updated_at)
        ON CONFLICT(email) DO UPDATE SET
            user_data = :user_data,
            updated_at = :updated_at
    ");

    foreach ($personas as $p) {
        $userData = [
            'id' => $p['id'],
            'name' => $p['name'],
            'username' => $p['username'],
            'avatar' => $p['avatar'] ?? null,
            'email' => $p['email'],
            'role' => $p['role'],
            'bio' => $p['bio'],
            'city' => $p['city'] ?? null,
            'region' => $p['region'] ?? 'Africa & Middle East',
            'displayPreference' => $p['displayPreference'] ?? 'username',
            'interests' => $p['interests'] ?? [],
            'groups' => [],
            'onboardingCompleted' => true
        ];

        $stmt->execute([
            ':email' => strtolower($p['email']),
            ':user_data' => json_encode($userData, JSON_UNESCAPED_SLASHES),
            ':updated_at' => $now
        ]);
        $count++;
    }
    return $count;
}

// Call Google Gemini API
function call_gemini_api($prompt, $apiKey, $model = 'gemini-1.5-flash') {
    if (empty($apiKey)) {
        return null;
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.85,
            'topP' => 0.95,
            'maxOutputTokens' => 2048,
            'responseMimeType' => 'application/json'
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    $resDecoded = json_decode($response, true);
    $text = $resDecoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if (!$text) return null;

    $json = json_decode($text, true);
    return is_array($json) ? $json : null;
}

// Extract JSON array or object from raw model output (handles markdown fences)
function extract_json_from_text($text) {
    if (empty($text)) return null;
    $text = trim($text);

    // Strip markdown code block fences ```json ... ```
    if (preg_match('/```(?:json)?\s*(.*?)\s*```/s', $text, $matches)) {
        $text = trim($matches[1]);
    }

    $decoded = json_decode($text, true);
    if (is_array($decoded)) return $decoded;

    // Search for array [ { ... } ]
    if (preg_match('/\[\s*\{.*\}\s*\]/s', $text, $arrMatch)) {
        $arrDecoded = json_decode($arrMatch[0], true);
        if (is_array($arrDecoded)) return $arrDecoded;
    }

    // Search for single object { ... }
    if (preg_match('/\{.*\}/s', $text, $objMatch)) {
        $objDecoded = json_decode($objMatch[0], true);
        if (is_array($objDecoded)) return [$objDecoded];
    }

    return null;
}

// Call Gemini API with Google Search Grounding or Real-Time Generation
function call_gemini_with_search($prompt, $apiKey, $model = 'gemini-2.5-flash') {
    if (empty($apiKey)) return null;

    $candidateModels = array_unique(array_filter([$model, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']));

    foreach ($candidateModels as $m) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$m}:generateContent?key=" . urlencode($apiKey);

        // Attempt 1: Gemini with Google Search tool enabled
        $payloadWithSearch = [
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'tools' => [
                ['googleSearch' => (object)[]]
            ],
            'generationConfig' => [
                'temperature' => 0.7,
                'topP' => 0.95,
                'maxOutputTokens' => 2048
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payloadWithSearch));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $resDecoded = json_decode($response, true);
            $text = $resDecoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if ($text) {
                $parsed = extract_json_from_text($text);
                if ($parsed && is_array($parsed)) {
                    return ['data' => $parsed, 'grounded' => true];
                }
            }
        }

        // Attempt 2: Direct generation with responseMimeType
        $payloadStandard = [
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ],
            'generationConfig' => [
                'temperature' => 0.75,
                'topP' => 0.95,
                'maxOutputTokens' => 2048,
                'responseMimeType' => 'application/json'
            ]
        ];

        $ch2 = curl_init($url);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_POST, true);
        curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode($payloadStandard));
        curl_setopt($ch2, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 30);
        $res2 = curl_exec($ch2);
        $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        if ($code2 === 200 && $res2) {
            $dec2 = json_decode($res2, true);
            $text2 = $dec2['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if ($text2) {
                $parsed2 = extract_json_from_text($text2);
                if ($parsed2 && is_array($parsed2)) {
                    return ['data' => $parsed2, 'grounded' => false];
                }
            }
        }
    }

    return null;
}

// Fetch Real-Time X (Twitter) Trends for Nigeria
function fetch_live_nigerian_x_trends() {
    $xTrends = [];

    // Source 1: getdaytrends.com/nigeria/
    $url = "https://getdaytrends.com/nigeria/";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && !empty($html)) {
        if (preg_match_all('/<th scope="row" class="pos">(\d+)<\/th>\s*<td class="main">\s*<a[^>]*>(.*?)<\/a>/is', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $pos = (int)$m[1];
                $name = trim(strip_tags($m[2]));
                if (!empty($name) && strlen($name) > 1 && strlen($name) < 65) {
                    $weight = max(25, 100 - (($pos - 1) * 2));
                    $xTrends[] = [
                        'name' => $name,
                        'rank' => $pos,
                        'weight' => $weight,
                        'platform' => 'x'
                    ];
                }
            }
        }
    }

    // Source 2: trends24.in/nigeria/ as fallback/supplement
    if (count($xTrends) < 5) {
        $url2 = "https://trends24.in/nigeria/";
        $ch2 = curl_init($url2);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch2, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch2, CURLOPT_USERAGENT, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        $html2 = curl_exec($ch2);
        $httpCode2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        if ($httpCode2 === 200 && !empty($html2)) {
            if (preg_match_all('/<a[^>]*href="https:\/\/twitter\.com\/search\?q=[^"]*"[^>]*class=trend-link[^>]*>([^<]+)<\/a>/i', $html2, $matches2)) {
                $rank = 1;
                foreach ($matches2[1] as $rawTrend) {
                    $name = trim(urldecode($rawTrend));
                    if (!empty($name) && strlen($name) > 1 && strlen($name) < 65) {
                        $weight = max(25, 100 - (($rank - 1) * 2));
                        $xTrends[] = [
                            'name' => $name,
                            'rank' => $rank,
                            'weight' => $weight,
                            'platform' => 'x'
                        ];
                        $rank++;
                        if ($rank > 25) break;
                    }
                }
            }
        }
    }

    return $xTrends;
}

// Fetch Real-Time News Headlines from Google News RSS for Nigeria
function fetch_live_nigerian_news_headlines($context = '') {
    $context = trim($context);
    if (!empty($context)) {
        $encoded = urlencode($context . ' Nigeria');
        $url = "https://news.google.com/rss/search?q={$encoded}&hl=en-NG&gl=NG&ceid=NG:en";
    } else {
        $url = "https://news.google.com/rss?hl=en-NG&gl=NG&ceid=NG:en";
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 7);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)');
    $xmlData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || empty($xmlData)) {
        return [];
    }

    $headlines = [];
    try {
        $xml = @simplexml_load_string($xmlData);
        if ($xml && isset($xml->channel->item)) {
            foreach ($xml->channel->item as $item) {
                $rawTitle = (string)$item->title;
                $cleanTitle = trim(preg_replace('/\s*-\s*[^-]+$/', '', $rawTitle));
                $source = (string)($item->source ?? 'Live Breaking News');
                if (!empty($cleanTitle) && strlen($cleanTitle) > 15) {
                    $headlines[] = [
                        'title' => $cleanTitle,
                        'source' => $source
                    ];
                }
                if (count($headlines) >= 12) break;
            }
        }
    } catch (Exception $e) {
        return [];
    }

    return $headlines;
}

// Curated Context-Aware Trend Fallbacks with Dynamic Angle Cycling, 𝕏 Viral Weight & Deduplication
function get_trend_fallback_suggestions($context = '', $category = '', $excludeTitles = [], $cycle = 1, $liveHeadlines = [], $liveXTrends = []) {
    $contextLower = strtolower($context);
    $pool = [];

    // 1. If live headlines were fetched from Google News RSS, dynamically synthesize real-time debate topics from them
    if (!empty($liveHeadlines) && is_array($liveHeadlines)) {
        foreach ($liveHeadlines as $h) {
            $ht = $h['title'];
            if (empty($ht)) continue;

            if (preg_match('/\b(petrol|fuel|dangote|nnpcl?|pump|refinery|subsidy|oil|gantry)\b/i', $ht)) {
                $pool[] = [
                    'title' => 'Dangote refinery & domestic fuel pricing: should government force retail stations to drop pump prices below ₦1,000?',
                    'description' => 'Commuters argue local refining must immediately end extortionate transportation costs. Fuel marketers maintain old high-price stock and distribution logistics prevent immediate price slashes without insolvency.',
                    'category' => 'Economy & Finance',
                    'tags' => ['DangoteRefinery', 'PetrolPrices', 'EnergyCrisis', 'NigeriaEconomy'],
                    'trendContext' => 'Breaking live news: ' . $ht,
                    'trendScore' => 97,
                    'xRank' => 1,
                    'platforms' => ['x', 'google_news']
                ];
            } elseif (preg_match('/\b(election|tinubu|rally|violence|apc|pdp|lp|nnpp|vote|2027|inec)\b/i', $ht)) {
                $pool[] = [
                    'title' => 'Politicians and sponsors implicated in election violence: should they receive lifetime bans from public office?',
                    'description' => 'Civic watchdogs argue only permanent disqualification and asset forfeiture will stop godfathers from deploying thugs at rallies. Critics argue ruling administrations easily weaponize violence charges to silence opposition contenders.',
                    'category' => 'Politics & Policy',
                    'tags' => ['2027Elections', 'PoliticalViolence', 'Tinubu', 'Democracy'],
                    'trendContext' => 'Breaking live news: ' . $ht,
                    'trendScore' => 93,
                    'xRank' => 4,
                    'platforms' => ['x', 'google_news']
                ];
            } elseif (preg_match('/\b(naira|fx|dollar|cbn|inflation|bank|tax|revenue|vat)\b/i', $ht)) {
                $pool[] = [
                    'title' => 'Floating the Naira: should the central bank return to currency pegging to arrest runaway cost of living?',
                    'description' => 'Struggling workers point out that the depreciated currency destroyed real wages and tripled staple food prices. Monetary economists insist artificial pegging burns national foreign reserves and enriches currency arbitrage cartels.',
                    'category' => 'Economy & Finance',
                    'tags' => ['NairaFloating', 'Inflation', 'CBN', 'CostOfLiving'],
                    'trendContext' => 'Breaking live news: ' . $ht,
                    'trendScore' => 95,
                    'xRank' => 3,
                    'platforms' => ['x', 'google_news']
                ];
            } elseif (preg_match('/\b(grid|power|electricity|disco|band.?a|blackout|tcn)\b/i', $ht)) {
                $pool[] = [
                    'title' => 'Repeated national grid collapses: should state governments disconnect completely and build independent state grids?',
                    'description' => 'Industrialists and estate associations maintain state-level power generation is the only sustainable exit from perpetual national blackouts. Federal grid authorities argue fragmenting the transmission network threatens national security.',
                    'category' => 'Environment & Climate',
                    'tags' => ['NationalGrid', 'PowerSector', 'ElectricityAct', 'BandATariff'],
                    'trendContext' => 'Breaking live news: ' . $ht,
                    'trendScore' => 91,
                    'xRank' => 6,
                    'platforms' => ['x', 'google_news']
                ];
            } elseif (preg_match('/\b(wage|minimum wage|salary|workers?|nlc|labour|trade union)\b/i', $ht)) {
                $pool[] = [
                    'title' => '₦70,000 minimum wage standoff: should cash-strapped state governments retrench workers to pay the new wage?',
                    'description' => 'State governors argue spending 85% of allocations on civil service wages starves infrastructure, healthcare, and schools. Labour unions counter that retrenching workers during hyperinflation is cruelty and breaches the law.',
                    'category' => 'Workplace & Career',
                    'tags' => ['MinimumWage', 'LabourRights', 'CivilService', 'StateBudgets'],
                    'trendContext' => 'Breaking live news: ' . $ht,
                    'trendScore' => 92,
                    'xRank' => 5,
                    'platforms' => ['x', 'google_news']
                ];
            } elseif (preg_match('/\b(food|diabetes|health|disease|lassa|hospital|doctor|cappa|drug)\b/i', $ht)) {
                $pool[] = [
                    'title' => 'Should government enforce emergency price controls and advertising bans on essential foods and sugary drinks?',
                    'description' => 'Public health advocates insist chronic disease burdens and market price gouging are killing vulnerable families. Food manufacturers argue state price caps trigger factory closures, job losses, and black-market hoarding.',
                    'category' => 'Business',
                    'tags' => ['PublicHealth', 'FoodInflation', 'ConsumerRights', 'Healthcare'],
                    'trendContext' => 'Breaking live news: ' . $ht,
                    'trendScore' => 88,
                    'platforms' => ['google_news']
                ];
            }
        }
    }

    // 2. If live 𝕏 trends were fetched, dynamically synthesize debates from the top hashtags and topics
    if (!empty($liveXTrends) && is_array($liveXTrends)) {
        foreach (array_slice($liveXTrends, 0, 8) as $xt) {
            $xName = $xt['name'] ?? '';
            $xRank = (int)($xt['rank'] ?? 1);
            $xWeight = (int)($xt['weight'] ?? 80);
            if (empty($xName)) continue;

            $pool[] = [
                'title' => "Trend debate on {$xName}: should public policy intervene or let cultural and market forces decide?",
                'description' => "Trending #{$xRank} on 𝕏 Nigeria with viral commentary across social channels. One camp insists this demands strict regulatory oversight and civic standards, while opponents insist personal autonomy and market freedom must prevail.",
                'category' => 'Politics & Policy',
                'tags' => [preg_replace('/[^a-zA-Z0-9]/', '', $xName), 'XTrendsNigeria', 'ViralDebate'],
                'trendContext' => "Trending #{$xRank} on 𝕏 (Twitter) Nigeria right now with high viral engagement.",
                'trendScore' => $xWeight,
                'xRank' => $xRank,
                'platforms' => ['x']
            ];
        }
    }

    // 2. High-Friction Current Trend Library (Grounded in late-2026 Nigerian Realities)
    $currentTrendPool = [
        [
            'title' => 'Dangote refinery selling petrol directly to marketers: will national pump prices drop below ₦1,000?',
            'description' => 'Consumers and transport unions expect direct domestic supply to dismantle import monopolies and slash fares. Marketers caution that financing costs, distribution margins, and crude exchange rates will keep pump prices elevated.',
            'category' => 'Economy & Finance',
            'tags' => ['DangoteRefinery', 'PetrolPrices', 'NNPCL', 'CostOfLiving', 'Energy'],
            'trendContext' => 'Grounded in breaking developments as domestic refineries commence direct distribution to major petroleum marketers.'
        ],
        [
            'title' => 'Floating the Naira: was unpegging the currency the single worst economic blunder in 20 years?',
            'description' => 'Critiques point to a collapsed middle class, hyperinflation, and factory closures across manufacturing corridors. Free-market economists maintain that subsidized official exchange rates were bankrupting foreign reserves and enriching currency speculators.',
            'category' => 'Economy & Finance',
            'tags' => ['NairaFloating', 'ForexMarket', 'CBN', 'EconomicPolicy', 'Inflation'],
            'trendContext' => 'Debated across central bank monetary policy updates and public cost of living town halls.'
        ],
        [
            'title' => 'State governments that cannot afford the ₦70,000 minimum wage: should they retrench civil servants?',
            'description' => 'Fiscal analysts insist states cannot deploy 85% of monthly revenue to pay government staff while citizens lack clean water and clinics. Trade unions declare any state worker retrenchment an act of economic warfare.',
            'category' => 'Workplace & Career',
            'tags' => ['MinimumWage', 'CivilService', 'LabourUnion', 'StateBudgets', 'Governance'],
            'trendContext' => 'Following disputes between state governors and organized labour over minimum wage implementation deadlines.'
        ],
        [
            'title' => 'Should state governments completely disconnect from the national grid and commission independent regional power plants?',
            'description' => 'Manufacturers declare repeated national grid collapses are strangling industrial production. Federal energy officials argue decentralized state grids undermine collective energy security and leave poor states in total darkness.',
            'category' => 'Environment & Climate',
            'tags' => ['ElectricityAct', 'NationalGrid', 'PowerGeneration', 'IndustrialCrisis', 'RenewableEnergy'],
            'trendContext' => 'Sparked by repeated national grid trips and state electricity regulatory commissions granting private power licenses.'
        ],
        [
            'title' => 'Tech companies ending hybrid work and mandating 5-day office attendance: is remote work dead in Lagos?',
            'description' => 'Corporate bosses argue that in-person collaboration, apprentice mentorship, and speed are impossible over Zoom. Tech workers argue that 4-hour daily traffic on third mainland bridge destroys productivity and mental health.',
            'category' => 'Workplace & Career',
            'tags' => ['RemoteWork', 'ReturnToOffice', 'TechEcosystem', 'LagosTraffic', 'WorkplaceCulture'],
            'trendContext' => 'Prompted by corporate directives from banks and technology firms enforcing full in-office work weeks.'
        ],
        [
            'title' => 'Should Value Added Tax (VAT) revenues be shared strictly by where goods are consumed rather than corporate headquarters?',
            'description' => 'Consuming states demand fiscal federalism, arguing corporate headquarters in commercial hubs siphon taxes paid by citizens nationwide. Hub states respond that their state-funded infrastructure sustains those corporations and deserves the revenue.',
            'category' => 'Politics & Policy',
            'tags' => ['TaxReform', 'VATSharing', 'FiscalFederalism', 'NationalAssembly', 'RevenueMobilization'],
            'trendContext' => 'Debated in heated legislative hearings over national tax reform bills and state derivation allocations.'
        ],
        [
            'title' => 'Politicians and sponsors implicated in political rally violence: lifetime ban from public office?',
            'description' => 'Civic activists argue only permanent disqualification and jail time will prevent godfathers from unleashing armed thugs. Defenders argue ruling parties will weaponize violence accusations to disqualify strong opposition contenders.',
            'category' => 'Politics & Policy',
            'tags' => ['2027Elections', 'ElectoralViolence', 'CivicAccountability', 'Democracy', 'PoliceReform'],
            'trendContext' => 'Prompted by warnings from security agencies and civil society ahead of upcoming electoral mobilization.'
        ],
        [
            'title' => 'Should landlords demanding 2 years rent upfront from monthly salary earners be jailed?',
            'description' => 'Tenants argue forcing salary earners to cough up multi-million Naira lump sums fuels bribery and drives families into homelessness. Property developers respond that tenant default rates and zero tenancy insurance make multi-year deposits essential.',
            'category' => 'Business',
            'tags' => ['LagosRent', 'TenantRights', 'RealEstate', 'HousingDeficit', 'CostOfLiving'],
            'trendContext' => 'In response to nationwide controversies on residential rent affordability and quarterly rent proposals.'
        ]
    ];

    $pool = array_merge($pool, $currentTrendPool);

    // 3. Extended Curated Trend & Debate Library
    $extendedPool = [
        [
            'title' => 'Should Lagos State hold binding citizen referendums before implementing any new highway or bridge tolling?',
            'description' => 'Supporters argue governors cannot realistically function as chief security officers while federal police commands wait on directives from Abuja. Opponents caution that without federal oversight, state police command could be weaponized by incumbent governors against political rivals.',
            'category' => 'Politics & Policy',
            'tags' => ['StatePolice', 'SecurityReform', 'LagosState', 'Federalism', 'GovernorsForum'],
            'trendContext' => 'Spurred by recent gubernatorial debate commitments and National Assembly deliberations on state police decentralization.'
        ],
        [
            'title' => 'Should commercial real estate developers in Lagos flood-prone coastal zones pay a mandatory 15% drainage surcharge?',
            'description' => 'Environmental town planners argue unchecked luxury reclamation blocks natural drainage channels and floods surrounding working-class mainland neighborhoods. Property developers warn that adding punitive levies on top of soaring material costs will trigger a severe housing affordability crisis.',
            'category' => 'Environment & Climate',
            'tags' => ['LagosFlooding', 'UrbanMasterplan', 'RealEstate', 'DrainageReform', 'CoastalErosion'],
            'trendContext' => 'Prompted by recent controversies surrounding coastal sand-filling projects, seasonal flooding, and drainage canal enforcement.'
        ],
        [
            'title' => 'Should Lagos State completely ban informal yellow Danfo minibuses on major transport corridors to enforce rapid transit?',
            'description' => 'Transit reform advocates insist informal minibuses cause chaotic traffic bottlenecks and harbor unsafe driving practices. Commuter advocates argue that without triples the current BRT bus fleet, sudden bans leave millions of daily workers stranded on highways.',
            'category' => 'Politics & Policy',
            'tags' => ['DanfoBan', 'LagosTransport', 'BRTTransit', 'CommuterMobility', 'TrafficReform'],
            'trendContext' => 'Debated in gubernatorial manifestos regarding metropolitan transport modernizations and multimodal integration.'
        ],
        [
            'title' => 'Should local government chairmen receive direct federal allocations without state joint-account deductions?',
            'description' => 'Grassroots activists insist local development has stalled because state governors siphon municipal revenue into centralized funds. Governors counter that councils lack the administrative transparency and auditing capacity to manage large revenues independently.',
            'category' => 'Politics & Policy',
            'tags' => ['LocalGovAutonomy', 'SupremeCourtRuling', 'GrassrootsDev', 'FederalAllocations', 'CivicAccountability'],
            'trendContext' => 'Following the landmark Supreme Court ruling on local government financial autonomy and gubernatorial implementation.'
        ],
        [
            'title' => 'Should community development associations (CDAs) be legally prohibited from locking residential street gates before midnight?',
            'description' => 'Night shift professionals, doctors, and emergency delivery drivers argue locking public residential streets at 10 PM is tyrannical. Estate security committees insist midnight curfews are the only proven deterrent against armed robbery gangs in unpoliced neighborhoods.',
            'category' => 'Community & Neighborhood',
            'tags' => ['GatedCommunities', 'EstateSecurity', 'PublicRoads', 'LagosLiving', 'NeighborRights'],
            'trendContext' => 'Triggered by recurrent clashes between night commuters and private estate security guards in metropolitan centers.'
        ],
        [
            'title' => 'Should heavy container trucks and fuel tankers be legally restricted to transit only between 11:00 PM and 5:00 AM?',
            'description' => 'Motorists and civic safety advocates demand nighttime-only truck transit to end fatal container falls and catastrophic gridlock on highway bridges. Maritime haulage operators argue night-only movement is impossible given dangerous highway security conditions and daytime port cargo clearances.',
            'category' => 'Politics & Policy',
            'tags' => ['TruckSafety', 'ApapaCorridor', 'HighwayTraffic', 'PortHaulage', 'RoadSafety'],
            'trendContext' => 'Sparked by ongoing traffic bottlenecks around port corridors and highway safety campaigns.'
        ],
        [
            'title' => 'Should Lagos State require verified state residency cards (LASRRA) for patients to access subsidized care at state hospitals?',
            'description' => 'Fiscal planners argue Lagos tax-payers cannot indefinitely subsidize healthcare for influx patients from neighboring states. Healthcare rights advocates declare emergency hospital access is a universal humanitarian right that must never be gated by administrative cards.',
            'category' => 'Politics & Policy',
            'tags' => ['HealthcareAccess', 'LASRRA', 'PublicHospitals', 'CivicWelfare', 'StateBudget'],
            'trendContext' => 'Debated as state healthcare boards evaluate resident verification policies to manage hospital bed over-capacity.'
        ],
        [
            'title' => 'Should the state government offer a 50% property tax rebate to landlords who contractually cap annual rent increases at 10%?',
            'description' => 'Tenant rights coalitions argue predatory 50% to 100% annual rent spikes are driving middle-class families into homelessness. Real estate investors respond that high building maintenance costs, inflation, and currency devaluation make artificial rent caps unfeasible.',
            'category' => 'Economy & Finance',
            'tags' => ['TenantsRights', 'RentControl', 'LagosHousing', 'PropertyTax', 'CostOfLiving'],
            'trendContext' => 'In response to heated town hall discussions on tenant protections and skyrocketing residential rent in urban centers.'
        ]
    ];

    // Context-dependent pool matching
    if (strpos($contextLower, 'lagos') !== false || strpos($contextLower, 'transport') !== false || strpos($contextLower, 'rent') !== false || strpos($contextLower, 'road') !== false) {
        $pool = array_merge($pool, $extendedPool);
    }
    // 2. Context matches Tax / Finance / Crypto / Dollar / Economy
    else if (strpos($contextLower, 'tax') !== false || strpos($contextLower, 'crypto') !== false || strpos($contextLower, 'dollar') !== false || strpos($contextLower, 'econom') !== false) {
        $pool = [
            [
                'title' => 'Should remote tech workers and freelancers earning in USD or GBP pay a progressive foreign currency income surcharge?',
                'description' => 'Proponents claim high-earning remote professionals benefit from low domestic living expenses while local currency volatility deepens local wealth inequality. Remote tech workers respond that they already pay for their own power, security, and satellite internet without government support.',
                'category' => 'Economy & Finance',
                'tags' => ['RemoteWork', 'Taxation', 'TechEcosystem', 'Economy', 'Forex'],
                'trendContext' => 'Grounded in ongoing public reactions to proposed progressive tax brackets on foreign exchange freelance earnings.'
            ],
            [
                'title' => 'Should the central bank fully legitimize and license peer-to-peer cryptocurrency exchanges for domestic settlements?',
                'description' => 'Tech advocates assert that crypto liquidity provides vital capital channels for young entrepreneurs and hedges against currency depreciation. Traditional central bankers caution that unregulated digital assets exacerbate exchange rate volatility and facilitate untraceable capital flight.',
                'category' => 'Economy & Finance',
                'tags' => ['CryptoRegulation', 'Fintech', 'CentralBank', 'P2PTrading', 'NairaStability'],
                'trendContext' => 'In response to recent SEC guidelines and central bank policy updates regarding virtual asset service providers.'
            ],
            [
                'title' => 'Should commercial banks be mandated to automatically refund customers plus pay a 10% penalty for failed digital transfers delayed past 1 hour?',
                'description' => 'Frustrated consumers argue bank network failures trap emergency funds and ruin small traders without any accountability. Bankers argue telecom fibre cuts and interbank switch downtimes are systemic external shocks that individual banks cannot insure against.',
                'category' => 'Business',
                'tags' => ['BankingService', 'NIBSS', 'CustomerProtection', 'FintechReliability', 'CentralBankDirectives'],
                'trendContext' => 'Triggered by rising consumer complaints regarding trapped funds and digital banking network glitches during peak transaction hours.'
            ],
            [
                'title' => 'Should the government replace the mandatory 1-year NYSC service with a direct ₦1,000,000 business startup grant for graduates?',
                'description' => 'Youth advocates point out that posting graduates to under-resourced schools for a year does nothing to address mass youth unemployment. Traditionalists argue NYSC is the only surviving institution fostering national unity, cultural integration, and cross-ethnic tolerance.',
                'category' => 'Economy & Finance',
                'tags' => ['NYSCReform', 'YouthEmployment', 'StartupGrants', 'NationalUnity', 'GraduateJobs'],
                'trendContext' => 'Spurred by recent legislative motions on restructuring youth service programs into entrepreneurship incubators.'
            ],
            [
                'title' => 'Should early-stage tech and creative startups be exempt from all company income taxes for their first 5 years of operation?',
                'description' => 'Venture ecosystem founders argue tax holidays allow nascent startups to survive the high mortality rate of early years and build scale. Revenue authorities argue blanket tax exemptions starve the government of vital non-oil tax revenue when public budgets are severely strained.',
                'category' => 'Business',
                'tags' => ['StartupAct', 'TaxIncentives', 'VentureCapital', 'InnovationHubs', 'EconomicGrowth'],
                'trendContext' => 'Debated during implementation town halls for the national Startup Act and tech investment pioneer status.'
            ]
        ];
        $pool = array_merge($pool, $extendedPool);
    }
    // 3. Context matches AI / Universities / Education / Campus
    else if (strpos($contextLower, 'ai') !== false || strpos($contextLower, 'school') !== false || strpos($contextLower, 'universit') !== false || strpos($contextLower, 'student') !== false) {
        $pool = [
            [
                'title' => 'Should universities permanently ban generative AI tools for undergraduate coursework and essays?',
                'description' => 'Faculty senates insist that AI-assisted essays undermine deep critical thinking, original research, and the integrity of academic degrees. Student innovators argue generative AI is the modern calculator and institutions must teach AI collaboration rather than fighting an unstoppable technological tide.',
                'category' => 'Education & Campus',
                'tags' => ['GenerativeAI', 'UniversityReform', 'AcademicIntegrity', 'CampusLife', 'TechInEducation'],
                'trendContext' => 'Triggered by campus Senate circulars addressing AI plagiarism and curriculum redesign across tertiary institutions.'
            ],
            [
                'title' => 'Should public universities be allowed to increase tuition by 200% to fund competitive lecturer salaries and modern laboratories?',
                'description' => 'University administrators state that chronic underfunding and strike actions will only cease when institutions achieve financial sustainability. Student associations and labor unions declare education is a fundamental public good that must remain accessible to low-income households.',
                'category' => 'Education & Campus',
                'tags' => ['TuitionHike', 'UniversityFunding', 'ASUU', 'StudentLoans', 'PublicEducation'],
                'trendContext' => 'Prompted by recent federal student loan scheme rollouts and student union protests over tertiary fee revisions.'
            ],
            [
                'title' => 'Should university lecturers who force students to buy course handouts be dismissed immediately without benefits?',
                'description' => 'Student anti-corruption activists declare mandatory handout sales are extortionate scams that exploit financially vulnerable scholars. Defending faculty argue poor departmental budgets and unpaid research allowances leave them with zero resources to print reference materials.',
                'category' => 'Education & Campus',
                'tags' => ['CampusHandouts', 'LecturerExtortion', 'UniversityEthics', 'StudentRights', 'EducationReform'],
                'trendContext' => 'Following anti-corruption agency investigations into unauthorized course material levies in tertiary faculties.'
            ],
            [
                'title' => 'Should tech corporations drop 4-year degree requirements and hire software engineers strictly based on verified portfolio tests?',
                'description' => 'Tech hiring managers argue self-taught developers and bootcamp alumni often out-perform traditional graduates in practical skills. Academic institutions maintain that structured degree programs provide foundational ethics, collaboration, and systemic problem-solving that bootcamps cannot replicate.',
                'category' => 'Workplace & Career',
                'tags' => ['DegreeVsSkills', 'TechHiring', 'SoftwareEngineering', 'CampusToCareer', 'JobMarket'],
                'trendContext' => 'In response to major tech employers revising hiring credentials to emphasize real-world project portfolios.'
            ]
        ];
        $pool = array_merge($pool, $extendedPool);
    }
    // 4. Default broad trending civic debates (Energy, Fuel Subsidy, Food Security, Culture)
    else {
        $pool = [
            [
                'title' => 'Should governments completely eliminate retail electricity subsidies and enforce cost-reflective billing for all residential bands?',
                'description' => 'Power distribution companies argue capital investments and reliable 24-hour supply require cost-reflective tariffs across all consumer segments. Consumer advocacy groups argue sudden steep tariff hikes cripple small neighborhood businesses and households coping with high inflation.',
                'category' => 'Economy & Finance',
                'tags' => ['ElectricityTariff', 'PowerSector', 'BandA', 'EnergyCrisis', 'ConsumerRights'],
                'trendContext' => 'Spurred by recent electricity tariff reviews, Band-A billing disputes, and ongoing national grid modernization debates.'
            ],
            [
                'title' => 'Should private food commodity hoarders face immediate criminal asset forfeiture during severe national food price spikes?',
                'description' => 'Civic rights defenders argue artificial hoarding of essential grains in warehouses for speculative profit starves vulnerable citizens. Agricultural merchants argue bulk storage is normal market inventory management against inflation and government price controls always collapse supply.',
                'category' => 'Business',
                'tags' => ['FoodInflation', 'MarketEnforcement', 'Agriculture', 'CostOfLiving', 'EconomicSecurity'],
                'trendContext' => 'Grounded in consumer protection taskforce warehouse inspections and nationwide food affordability concerns.'
            ],
            [
                'title' => 'Should public transport fares on commuter rail and rapid bus systems be subsidized by 50% using state oil revenues?',
                'description' => 'Urban sociologists point out that accessible public transit is the single fastest way to ease post-subsidy cost of living pressures. Fiscal conservatives argue open-ended transport subsidies drain public treasuries and starve funding for essential hospitals and schools.',
                'category' => 'Politics & Policy',
                'tags' => ['MassTransit', 'TransportSubsidy', 'UrbanMobility', 'FuelSubsidy', 'PublicSpending'],
                'trendContext' => 'Prompted by rising inter-city and metropolitan transit costs following fuel subsidy adjustments.'
            ],
            [
                'title' => 'Should married couples be culturally expected to contribute equally (50/50) to monthly housing and grocery bills?',
                'description' => 'Modern financial planners point out that dual-income household partnership is essential to thrive in high-inflation urban economies. Cultural traditionalists insist that providing for the home is the primary non-negotiable responsibility of a man.',
                'category' => 'Family & Home',
                'tags' => ['MarriageFinances', 'FiftyFifty', 'ModernRelationships', 'HouseholdBudget', 'CulturalTradition'],
                'trendContext' => 'Sparked by viral social debates on relationship financial dynamics and equitable domestic partnership.'
            ],
            [
                'title' => 'Should religious centers with high-decibel outdoor loudspeakers in residential estates face immediate operational shutdown after 10:00 PM?',
                'description' => 'Sleep-deprived neighbors argue residential peace and public health are fundamental constitutional rights that noise polluters must respect. Worship groups counter that overnight vigils and public calls to prayer are protected expressions of freedom of religion.',
                'category' => 'Community & Neighborhood',
                'tags' => ['NoisePollution', 'FreedomOfWorship', 'ResidentialEstates', 'PublicHealth', 'NeighborEtiquette'],
                'trendContext' => 'In response to municipal environmental agency enforcement sweeps against noise pollution in residential districts.'
            ],
            [
                'title' => 'Should companies have the legal right to terminate employees caught working secondary remote jobs during standard business hours?',
                'description' => 'Corporate leaders insist that dual-employment divides focus, creates intellectual property conflicts of interest, and violates employment contracts. Remote professionals argue as long as daily deliverables and key results are achieved, how they utilize their remaining hours is their private prerogative.',
                'category' => 'Workplace & Career',
                'tags' => ['Overemployment', 'RemoteWorkEthics', 'Moonlighting', 'CorporateGovernance', 'CareerFreedom'],
                'trendContext' => 'Prompted by corporate HR directives and discussions around remote work multi-jobbing in tech and finance.'
            ]
        ];
        $pool = array_merge($pool, $extendedPool);
    }

    // Exclude previously displayed titles to guarantee fresh, distinct angles on every click
    if (!empty($excludeTitles) && is_array($excludeTitles)) {
        $normalizedExclude = array_map(function($t) { return strtolower(trim($t)); }, $excludeTitles);
        $filtered = array_filter($pool, function($item) use ($normalizedExclude) {
            return !in_array(strtolower(trim($item['title'])), $normalizedExclude);
        });
        if (count($filtered) >= 3) {
            $pool = array_values($filtered);
        }
    }

    // Shuffle pool with dynamic random seed incorporating cycle and microtime
    $seed = crc32($context . microtime(true) . $cycle . rand(100, 9999));
    srand($seed);
    shuffle($pool);

    return array_slice($pool, 0, 3);
}

// Generate Trend Questions using Gemini + Live Google Search Grounding & Real-Time Headlines + 𝕏 (Twitter) Trends
function generate_trend_question_suggestions($context = '', $category = '', $region = 'Africa & Middle East', $apiKey = '', $model = 'gemini-2.5-flash', $excludeTitles = [], $cycle = 1) {
    $context = trim($context);
    $category = trim($category);

    // Fetch real-time live headlines from Google News RSS for Nigeria
    $liveHeadlines = fetch_live_nigerian_news_headlines($context);

    // Fetch real-time live viral trends from 𝕏 (Twitter) in Nigeria
    $liveXTrends = fetch_live_nigerian_x_trends();

    if (!empty($apiKey)) {
        $excludePrompt = '';
        if (!empty($excludeTitles) && is_array($excludeTitles)) {
            $excludePrompt = "\nIMPORTANT DIVERSITY RULE: Provide COMPLETELY FRESH, alternative debate angles. DO NOT repeat, duplicate, or closely rephrase any of these previous questions:\n"
                . implode("\n", array_map(function($t) { return "- \"{$t}\""; }, $excludeTitles))
                . "\nExplore contrasting sub-topics, different affected stakeholders, or unexpected policy/ethical angles.\n";
        }

        $liveHeadlinesText = '';
        if (!empty($liveHeadlines)) {
            $liveHeadlinesText = "\nREAL-TIME BREAKING NEWS HEADLINES IN NIGERIA RIGHT NOW:\n"
                . implode("\n", array_map(function($h) { return "- \"" . $h['title'] . "\" (Source: " . $h['source'] . ")"; }, $liveHeadlines))
                . "\n";
        }

        $liveXTrendsText = '';
        if (!empty($liveXTrends)) {
            $liveXTrendsText = "\nREAL-TIME 𝕏 (TWITTER) TRENDING IN NIGERIA RIGHT NOW (VIRAL WEIGHT & VOLUME):\n"
                . implode("\n", array_map(function($x) {
                    return "- Rank #{$x['rank']}: \"{$x['name']}\" (Viral Traction Weight: {$x['weight']}/100)";
                }, array_slice($liveXTrends, 0, 15)))
                . "\n\nCRITICAL MULTI-PLATFORM RULE: Cross-reference viral conversations on 𝕏 with breaking Google News headlines. Assign higher weight scores (85-98) to issues that are burning on both platforms simultaneously!\n";
        }

        $prompt = "You are an elite investigative journalist, viral poll designer, and civic debate moderator for YesOrNo (a public deliberation platform).\n"
            . "Generation Cycle: #{$cycle}\n\n"
            . "Task:\n"
            . (!empty($context) 
                ? "Research and ground your questions in the latest real-time trends, news stories, and public debates regarding: \"{$context}\".\n"
                : "Research the top trending news stories, viral civic discussions, policy disputes, and cultural dilemmas in Nigeria, Africa, and global tech/politics today.\n")
            . $liveHeadlinesText
            . $liveXTrendsText
            . (!empty($category) ? "Target Category: {$category}\n" : "")
            . "Target Region: {$region}\n"
            . $excludePrompt . "\n"
            . "Identify the core point of controversy, tension, or policy dilemma where thoughtful citizens, experts, and community members are divided roughly 50/50.\n\n"
            . "Generate 2 to 3 distinct polarizing YES/NO debate question suggestions based on these current trends and facts as a Nigerian for Nigerians.\n\n"
            . "For each suggestion, provide:\n"
            . "1. \"title\": A sharp, provocative, culturally authentic YES/NO question (strictly ending with a single '?'). VARY THE FORMAT across these styles:\n"
            . "   - Captivating True-Life Story / Dilemma Hook (DO NOT prefix with labels like 'CONFESSION:' or 'TRUE STORY:' — jump directly into the raw first-person hook, e.g. 'I found out my fiancé has a secret 4-year-old child 2 weeks before our wedding: should I cancel?', 'I earn ₦2.8M in Lagos and refuse to fund my 30-year-old brother\\'s lifestyle: am I being selfish?', 'I secretly took a DNA test on our 2-year-old son behind my wife\\'s back: was I wrong to doubt her?')\n"
            . "   - Short & sharp direct question (e.g. 'End NYSC now?', 'Ban plastic bags?', 'Checking partner\\'s phone: justified?')\n"
            . "   - Statement preamble + question (e.g. 'Fuel subsidy removed: should it be brought back?', 'Dangote refinery cuts petrol price: will filling stations drop pump prices?')\n"
            . "   - Direct binary polarity hot-take (e.g. '50/50 rent in marriage: Yes or No?', 'A man earning ₦150k has no business dating in Lagos: agree?')\n"
            . "   - Provocative civic question (e.g. 'Should politicians seeking foreign healthcare be stripped of office?')\n"
            . "2. \"description\": 2 to 4 punchy sentences. CRITICAL SOCIAL MEDIA RULE:\n"
            . "   - Because social media link previews (X, WhatsApp, Facebook, LinkedIn) only highlight the first 8-15 words, FRONT-LOAD AN IRRESISTIBLE HOOK in the very first sentence (e.g. 'I was cleaning my husband\\'s car when a birth certificate with his name fell out...', 'My mother-in-law moved in for \"two weeks\" and it has now been 14 months without an exit date...').\n"
            . "   - Then outline the emotional dilemma: why the YES camp insists one action is necessary, and why the NO camp passionately calls it betrayal or heartless.\n"
            . "3. \"category\": Best fitting category from: ['Politics & Policy', 'Economy & Finance', 'Workplace & Career', 'Business', 'Environment & Climate', 'Education & Campus', 'Community & Neighborhood', 'Family & Home', 'Entertainment', 'Counselling', 'Gender', 'Religious & Faith'].\n"
            . "4. \"tags\": 3 to 5 relevant hashtags or keywords (e.g. ['DangoteRefinery', 'PetrolPrices', 'CommuterRights']).\n"
            . "5. \"trendContext\": A 1-2 sentence summary of the recent news, event, or trend that sparked this debate.\n"
            . "6. \"trendScore\": Integer from 70 to 98 (combined viral weight score based on 𝕏 viral traction and Google News coverage).\n"
            . "7. \"xRank\": Integer position on 𝕏 Nigeria trends if matching an active topic, or null.\n"
            . "8. \"platforms\": Array containing [\"x\", \"google_news\"].\n\n"
            . "Return pure JSON matching this exact structure:\n"
            . "[\n"
            . "  {\n"
            . "    \"title\": \"...\",\n"
            . "    \"description\": \"...\",\n"
            . "    \"category\": \"...\",\n"
            . "    \"tags\": [\"...\"],\n"
            . "    \"trendContext\": \"...\",\n"
            . "    \"trendScore\": 94,\n"
            . "    \"xRank\": 3,\n"
            . "    \"platforms\": [\"x\", \"google_news\"]\n"
            . "  }\n"
            . "]";

        $result = call_gemini_with_search($prompt, $apiKey, $model);
        if ($result && !empty($result['data']) && is_array($result['data'])) {
            $suggestions = $result['data'];
            // Normalize suggestions if single object wrapped in array
            if (isset($suggestions['title'])) {
                $suggestions = [$suggestions];
            }
            return [
                'success' => true,
                'source' => $result['grounded'] ? 'gemini_google_search' : 'gemini_generative',
                'grounded' => $result['grounded'],
                'context' => $context,
                'cycle' => $cycle,
                'xTrendsCount' => count($liveXTrends),
                'suggestions' => $suggestions
            ];
        }
    }

    // Dynamic Curated Real-Time News & Trend Fallback with angle cycling and deduplication
    $fallbackList = get_trend_fallback_suggestions($context, $category, $excludeTitles, $cycle, $liveHeadlines, $liveXTrends);
    return [
        'success' => true,
        'source' => (!empty($liveHeadlines) || !empty($liveXTrends)) ? 'realtime_news_and_x_trends' : 'curated_trend_engine',
        'grounded' => (!empty($liveHeadlines) || !empty($liveXTrends)),
        'context' => $context,
        'cycle' => $cycle,
        'xTrendsCount' => count($liveXTrends),
        'suggestions' => $fallbackList
    ];
}

// Curated Fallback Debate Templates (Natural Nigerian Context, Semi-Formal/Informal Tone)
function get_curated_fallback_debates() {
    return [
        [
            'title' => 'Should remote workers earning in foreign currency (USD/GBP) pay higher domestic income taxes?',
            'description' => 'With the rise of international remote tech workers and freelancers earning in strong currencies amidst local currency volatility, some argue for a specialized progressive tax bracket. Tech professionals argue they already provide their own power, internet, and security.',
            'category' => 'Economy & Finance',
            'region' => 'Africa & Middle East',
            'tags' => ['Remote Work', 'Taxation', 'Tech', 'Economy', 'Cost of Living'],
            'perspectives' => [
                [
                    'archetype' => 'Tax Accountant',
                    'choice' => 'YES',
                    'note' => 'Civil servants earning ₦70k have PAYE deducted at source before seeing their alert. Why should someone living in the same country, buying in the same market, pay zero tax just because their client is in London? Equity must touch everybody.'
                ],
                [
                    'archetype' => 'Tech Youth & Freelancer',
                    'choice' => 'NO',
                    'note' => 'We buy solar, fuel our own generators, pay private clinics, and use Starlink because public infrastructure is zero. And now government wants a cut of our hard-earned foreign currency? Are we joking or what?'
                ],
                [
                    'archetype' => 'Economist',
                    'choice' => 'NO',
                    'note' => 'Targeting remote knowledge workers makes zero sense. In an economy starving for foreign exchange, you want tech talent to stay here and spend dollars locally, not pack their bags and relocate to Kigali or London.'
                ],
                [
                    'archetype' => 'Policy Insider',
                    'choice' => 'YES',
                    'note' => 'Nobody is saying tax people to death, but having young earners making millions in foreign currency while roads decay is unsustainable. A flat, simple presumptive tax is basic common sense.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Tech Youth & Freelancer',
                    'archetype' => 'Labor Advocate',
                    'content' => 'Ah yes, because roads, streetlights, and basic security are downloaded straight from Starlink, right? Everyone is buying generator fuel. If you live here, contribute like everyone else abeg.'
                ]
            ]
        ],
        [
            'title' => 'Is spending over ₦3 Million on traditional and white weddings a financial mistake for young couples in 2026?',
            'description' => 'With high inflation, soaring house rents, and rising living costs, more young people are debating whether elaborate wedding ceremonies are worth the financial strain, or if families should embrace intimate court weddings.',
            'category' => 'Family & Home',
            'region' => 'Africa & Middle East',
            'tags' => ['Weddings', 'Family', 'Personal Finance', 'Culture', 'Relationships'],
            'perspectives' => [
                [
                    'archetype' => 'Financial Educator',
                    'choice' => 'YES',
                    'note' => 'Starting marriage with an empty bank account just so 400 distant relatives can complain the fried rice was cold is pure comedy. That ₦3M is 2 full years of house rent. Use your head please.'
                ],
                [
                    'archetype' => 'Hospitality & Small Business',
                    'choice' => 'NO',
                    'note' => 'Weddings are cultural milestones that bring families together. You only do it once in your lifetime. Celebrating with parents and elders has emotional value that cannot be measured on an Excel spreadsheet.'
                ],
                [
                    'archetype' => 'Sociologist',
                    'choice' => 'NO',
                    'note' => 'Ah, the Twitter financial advisors have arrived. A wedding is about community honor and family blessing, not just money. Some things are bigger than your personal savings account.'
                ],
                [
                    'archetype' => 'Student Leader',
                    'choice' => 'YES',
                    'note' => 'Let us be honest with ourselves: half the people at big weddings are only there for free food and souvenirs. Those same guests will not send you ₦5k when rent is due next year. Sign court papers and protect your peace.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Hospitality & Small Business',
                    'archetype' => 'Artisan & Business Owner',
                    'content' => 'When landlord comes knocking 6 months after the wedding, show him the family blessings and see if he accepts it as payment for rent. Wisdom comes before party.'
                ]
            ]
        ],
        [
            'title' => 'Should commercial motorcycles and tricycles (Okada & Keke) be banned from major highway expressways?',
            'description' => 'Megacity transport regulators argue that bikes and tricycles cause catastrophic highway accidents and traffic anarchy on high-speed corridors. Commuters and transport unions argue formal buses cannot handle daily demand.',
            'category' => 'Infrastructure',
            'region' => 'Africa & Middle East',
            'tags' => ['Transportation', 'Urban Planning', 'Public Safety', 'Labor', 'Commuting'],
            'perspectives' => [
                [
                    'archetype' => 'Medical Doctor',
                    'choice' => 'YES',
                    'note' => 'Every weekend, hospital emergency rooms are full of people with broken heads and shattered legs from trailer collisions. 100cc motorbikes and 40-foot container trucks physically do not belong on the same express lane!'
                ],
                [
                    'archetype' => 'Labor Advocate',
                    'choice' => 'NO',
                    'note' => 'Ban okada? Fantastic idea! Now where are the alternative buses? People wake up at 4 AM to hustle. If you ban them without affordable buses, how should ordinary workers reach their jobs? Fly?'
                ],
                [
                    'archetype' => 'Urban Planner',
                    'choice' => 'YES',
                    'note' => 'Expressways are built for 100km/h traffic throughput. When motorbikes weave blindly between lanes against oncoming trailers, the whole corridor slows down and casualty rates spike.'
                ],
                [
                    'archetype' => 'Grassroots Trader',
                    'choice' => 'NO',
                    'note' => 'Market women carrying heavy food baskets depend on Keke to reach early markets. When bans happen, police start taking bribes and fares double for passengers. It hurts the poor the most.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Urban Planner',
                    'archetype' => 'Logistics Operator',
                    'content' => 'Buses sound sweet in air-conditioned conference rooms, but who will finance the 2,000 new buses needed by tomorrow morning? Banning transport before providing alternatives is pure punishment.'
                ]
            ]
        ],
        [
            'title' => 'Should universities permanently ban students from using generative AI tools for essays and assignments?',
            'description' => 'With the explosion of AI writing tools, university departments are divided. Some want strict bans and return to handwritten exams, while others argue AI is a workplace reality that students must master.',
            'category' => 'Education',
            'region' => 'Africa & Middle East',
            'tags' => ['Artificial Intelligence', 'Education', 'Students', 'Technology', 'Career'],
            'perspectives' => [
                [
                    'archetype' => 'Educationist',
                    'choice' => 'YES',
                    'note' => 'If students use AI to draft their essays from year one, they skip the cognitive struggle of researching, reading primary books, and organizing their own original thoughts. You cannot build intellectual muscle if a computer does all the heavy lifting.'
                ],
                [
                    'archetype' => 'Tech Youth & Freelancer',
                    'choice' => 'NO',
                    'note' => 'Banning AI in 2026 is like telling accounting students they cannot use Excel. Employers want people who know how to prompt AI, catch hallucinations, and deliver real work faster. Teach students how to audit AI, don’t handicap them.'
                ],
                [
                    'archetype' => 'Historian',
                    'choice' => 'YES',
                    'note' => 'People compared AI to calculators, but language is the core foundation of reasoning and debate. If a university graduate cannot write a coherent 5-page argument without machine assistance, our educational standard has truly collapsed.'
                ],
                [
                    'archetype' => 'Student Leader',
                    'choice' => 'NO',
                    'note' => 'Archived 3-hour handwritten exams test memorization and fast handwriting, not actual understanding. If an AI can answer an assignment perfectly, the problem is with lazy assignment prompts, not students using modern tools.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Educationist',
                    'archetype' => 'Cloud Engineer',
                    'content' => 'Students will use AI on their phones regardless of university bans. Instead of pretending it does not exist, teach students to build original projects that AI cannot simply copy-paste.'
                ]
            ]
        ],
        // Confidently Annoying / Rage-Baiting & High-Friction Debates
        [
            'title' => 'If you earn under ₦800,000 monthly, is dating in Lagos pure financial recklessness?',
            'description' => 'With the average casual dinner date costing upwards of ₦45,000 plus surge Bolt rides and drinks, financial pragmatists argue that dating on a modest salary is fiscal suicide, while romantics argue that companionship should not be reserved for high earners.',
            'category' => 'Relationships & Dating',
            'region' => 'Africa & Middle East',
            'tags' => ['Dating', 'Relationships', 'Personal Finance', 'Lagos Life', 'Cost of Living'],
            'perspectives' => [
                [
                    'archetype' => 'Financial Educator',
                    'choice' => 'YES',
                    'note' => 'Let us do simple maths. Take two dinner dates a month at ₦40k each, add surge Bolt fares of ₦15k round trip, and throw in occasional unexpected requests. You have blown ₦120k on outings alone. If your take-home is under ₦800k, you are literally dating yourself into poverty. Focus on your cash flow first.'
                ],
                [
                    'archetype' => 'Full-Time Mother',
                    'choice' => 'NO',
                    'note' => 'Our parents built marriages on teacher salaries and modest civil service wages. If you wait until you have millions before you date, you will wake up at 40 with a loaded bank account and zero companionship. The problem is not salary; the problem is trying to impress people with expensive lifestyle inflation.'
                ],
                [
                    'archetype' => 'Ride-Hailing Driver',
                    'choice' => 'YES',
                    'note' => 'I pick up young guys from Mainland taking girls to restaurants in Victoria Island every weekend. By Sunday evening their transfer accounts are crying. If you cannot afford to maintain yourself without sweating over fuel prices, why are you carrying extra baggage? Stay in your house and rest.'
                ],
                [
                    'archetype' => 'Barber & Stylist',
                    'choice' => 'NO',
                    'note' => 'Dating does not mean booking a table at an upscale seafood lounge every weekend. A real partner will sit with you to eat roasted plantain and fish while you both plan your future. If the person you are dating requires ₦800k minimum wage to smile, you picked the wrong person.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Full-Time Mother',
                    'archetype' => 'E-Commerce Seller',
                    'content' => 'Our parents dated when a crate of eggs was ₦150 and house rent in Yaba was ₦3,000 a year! You cannot use 1985 economic reality to judge 2026 inflation.'
                ]
            ]
        ],
        [
            'title' => 'If you sleep more than 4 hours a night in your twenties, are you quietly planning for poverty?',
            'description' => 'Self-proclaimed hustle gurus argue that your twenties are for extreme sleepless sacrifice, side projects, and continuous compounding, while medical professionals warn that glorifying chronic sleep deprivation causes early organ breakdown and mental ruin.',
            'category' => 'Workplace & Career',
            'region' => 'Africa & Middle East',
            'tags' => ['Hustle Culture', 'Sleep', 'Health', 'Productivity', 'Youth'],
            'perspectives' => [
                [
                    'archetype' => 'Crypto Trader',
                    'choice' => 'YES',
                    'note' => 'Your twenties are your only compounding window. While you are sleeping 8 full hours under a cozy duvet, global competitors in India and China are upskilling, trading markets at 3 AM, and building software. Nobody ever broke generational poverty by observing beauty sleep.'
                ],
                [
                    'archetype' => 'Frontline Nurse',
                    'choice' => 'NO',
                    'note' => 'Sleeping 4 hours a night does not make you a billionaire; it gives you high blood pressure at 27, clinical depression, and chronic kidney damage. We admit young burnout patients into hospital wards every week. You cannot spend wealth from an intensive care unit bed.'
                ],
                [
                    'archetype' => 'Fitness Coach',
                    'choice' => 'NO',
                    'note' => 'Brain recovery, muscle protein synthesis, and hormone regulation all happen during deep REM sleep. A person who sleeps 7 hours makes sharper, high-leverage strategic decisions than a sleep-deprived zombie typing bugs for 18 hours straight. Work smart, not suicidal.'
                ],
                [
                    'archetype' => 'Entrepreneur',
                    'choice' => 'YES',
                    'note' => 'Building a business in an environment with poor electricity, bad roads, and volatile currency requires abnormal obsession. If you insist on European work-life balance in an emerging market, your startup will run out of cash before your second product launch.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Crypto Trader',
                    'archetype' => 'Medical Doctor',
                    'content' => 'Chronic 4-hour sleep impairs cognitive reaction time equivalent to being legally drunk. You are not compounding wealth at 3 AM; you are just typing hallucinated code.'
                ]
            ]
        ],
        [
            'title' => 'Should a woman immediately block a man who suggests splitting the bill on a first date?',
            'description' => 'A fiery battle between traditional romantic courtship and modern progressive partnership. Traditionalists argue that the person initiating the date must provide, while modernists argue that equal adults should share expenses without entitlement.',
            'category' => 'Relationships & Dating',
            'region' => 'Africa & Middle East',
            'tags' => ['Dating', 'Chivalry', 'Gender Roles', 'Modern Life', 'Etiquette'],
            'perspectives' => [
                [
                    'archetype' => 'Beauty Stylist',
                    'choice' => 'YES',
                    'note' => 'A first date is a man presenting his best foot forward. If he is already calculating 50/50 on two plates of pasta and mocktails, he has zero chivalry and will split hospital bills when you are in labor. Save your energy and block him with immediate effect.'
                ],
                [
                    'archetype' => 'Tech Youth & Freelancer',
                    'choice' => 'NO',
                    'note' => 'We are in 2026 where women earn salaries, run businesses, and demand equal respect in offices and boardrooms. A first date is two equal humans meeting to check mutual vibe, not a job interview where the man must pay a feeding allowance.'
                ],
                [
                    'archetype' => 'Sociologist',
                    'choice' => 'NO',
                    'note' => 'Splitting or offering to cover your share shows emotional maturity and mutual consideration. The sense of entitlement that expects one stranger to sponsor another stranger\'s luxury lifestyle on day one is why dating in modern cities has become so transactional.'
                ],
                [
                    'archetype' => 'Customer Service',
                    'choice' => 'YES',
                    'note' => 'Whoever picks the expensive venue should pay. If a guy chooses an upscale restaurant in Lekki and expects you to whip out your debit card when the bill arrives, that is a trap, not a date. Generosity is attractive; stinginess is an immediate turn-off.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Beauty Stylist',
                    'archetype' => 'Law Student & Debater',
                    'content' => 'You cannot demand progressive equality in careers and politics, but revert to 18th-century patriarchal entitlement the second the waiter drops the receipt.'
                ]
            ]
        ],
        [
            'title' => 'Is working from bed in your pajamas \'real work\' compared to doctors, mechanics, and teachers?',
            'description' => 'A battle between traditional physical labor and modern remote knowledge work. Traditional trade artisans argue that physical presence and grit are the true markers of productivity, while remote workers argue value is purely cognitive.',
            'category' => 'Workplace & Career',
            'region' => 'Africa & Middle East',
            'tags' => ['Remote Work', 'Blue Collar', 'Future of Work', 'Tech', 'Career'],
            'perspectives' => [
                [
                    'archetype' => 'Artisan & Business Owner',
                    'choice' => 'NO',
                    'note' => 'Real work is sweat, handling raw materials, standing on your feet for 8 hours, and creating physical value that people can touch. Lying under a duvet in shorts pressing keyboard while eating cereal is a comfortable hobby. When your transformer blows up, you call real workers to fix your life.'
                ],
                [
                    'archetype' => 'Systems Engineer',
                    'choice' => 'YES',
                    'note' => 'Companies do not pay for your physical sweat or how much you suffered inside a yellow Danfo bus in traffic; they pay for business leverage. One optimization to an international payment gateway processes millions of dollars in seconds. Brain work is 100x more scalable than manual labor.'
                ],
                [
                    'archetype' => 'Ride-Hailing Driver',
                    'choice' => 'NO',
                    'note' => 'Let all the remote workers stay in bed for two weeks while drivers, doctors, electricity technicians, and market women take a break. The entire country will collapse into darkness and starvation in 48 hours. Let us not confuse comfort with essential productivity.'
                ],
                [
                    'archetype' => 'Creative & Designer',
                    'choice' => 'YES',
                    'note' => 'Without the remote designers, software engineers, and product managers who built your mobile banking app and mapping software, the driver cannot find rides and the mechanic cannot receive bank transfers. All legitimate honest work is real work.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Artisan & Business Owner',
                    'archetype' => 'Tech Youth & Freelancer',
                    'content' => 'Suffering is not a KPI! Just because someone didn\'t inhale exhaust fumes on third mainland bridge doesn\'t mean their brain didn\'t solve complex problems all day.'
                ]
            ]
        ],
        [
            'title' => '50/50 rent in marriage: Yes or No?',
            'description' => 'Modernists argue runaway urban inflation makes dual-income partnership mandatory for household survival. Cultural and religious traditionalists insist that providing shelter remains strictly the husband’s non-negotiable obligation.',
            'category' => 'Gender',
            'region' => 'Africa & Middle East',
            'tags' => ['Marriage', '5050Rent', 'Relationships', 'CostOfLiving', 'GenderRoles'],
            'perspectives' => [
                [
                    'archetype' => 'Financial Educator',
                    'choice' => 'YES',
                    'note' => 'With 2-bedroom flats in Lekki and Ikeja hitting ₦4 Million to ₦7 Million annually, expecting one partner to shoulder 100% of shelter while the other keeps their entire salary is unrealistic in 2026. Marriage is an economic partnership.'
                ],
                [
                    'archetype' => 'Full-Time Mother',
                    'choice' => 'NO',
                    'note' => 'A man is the priest and provider of his household. The day a wife starts paying 50% of the rent, authority in the home becomes contested and respect fades. If a man cannot afford a ₦3M flat, he should rent a ₦1M apartment within his means.'
                ],
                [
                    'archetype' => 'Creative & Designer',
                    'choice' => 'YES',
                    'note' => 'Both people sleep under the same roof, turn on the same air conditioner, and use the same water. If you both earn decent salaries, splitting major fixed expenses equally reduces financial stress and builds generational wealth faster.'
                ],
                [
                    'archetype' => 'Sociologist',
                    'choice' => 'NO',
                    'note' => 'African societal structure still places the full burden of domestic labor, childbirth, and nursing disproportionately on women. Asking a woman to match financial contributions 50/50 without 50/50 domestic labor sharing is double exploitation.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Financial Educator',
                    'archetype' => 'Labor Advocate',
                    'content' => 'If you want 50/50 rent, make sure you also do 50% of the midnight infant nursing, 50% of school runs, and 50% of the kitchen work. You cannot pick and choose where equality begins.'
                ]
            ]
        ],
        [
            'title' => 'Fuel subsidy removed and transport costs tripled: should government bring it back?',
            'description' => 'Working citizens and small businesses argue astronomical petrol prices have crippled daily livelihood, spiked food prices, and destroyed the middle class. Fiscal economists maintain that fuel subsidies drained national reserves and enriched smugglers.',
            'category' => 'Economy & Finance',
            'region' => 'Africa & Middle East',
            'tags' => ['FuelSubsidy', 'TransportCosts', 'Economy', 'Inflation', 'Nigeria'],
            'perspectives' => [
                [
                    'archetype' => 'Grassroots Trader',
                    'choice' => 'YES',
                    'note' => 'I spend ₦4,500 daily just to transport vegetables from Mile 12 to my stall, compared to ₦1,200 before. Customers cannot afford to buy food. The government must intervene with fuel subsidies before ordinary families starve completely.'
                ],
                [
                    'archetype' => 'Economist',
                    'choice' => 'NO',
                    'note' => 'Nigeria was borrowing billions of dollars every month simply to subsidize cheap fuel that criminal syndicates smuggled across the borders to Cameroon and Benin. Reinstating subsidies guarantees total national bankruptcy and debt default.'
                ],
                [
                    'archetype' => 'Ride-Hailing Driver',
                    'choice' => 'YES',
                    'note' => 'We are buying petrol at ₦1,100 per litre while riders complain when ride fares increase by ₦500. After fueling the car, paying commission to the app company, and fixing suspension, drivers are taking home zero profit. Bring it back!'
                ],
                [
                    'archetype' => 'Policy Insider',
                    'choice' => 'NO',
                    'note' => 'The solution is not returning to a corrupt subsidy regime that swallowed ₦4 Trillion annually. The real urgency is accelerating CNG bus conversions, fixing rail corridors, and investing oil revenues directly into public healthcare and education.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Economist',
                    'archetype' => 'Student Leader',
                    'content' => 'Saying subsidies caused bankruptcy is easy when you earn in dollars or work in an air-conditioned office. The millions of students who walk miles to campus every day cannot eat macroeconomic theories.'
                ]
            ]
        ],
        [
            'title' => 'Mandatory DNA testing before issuing any child birth certificate: Yes or No?',
            'description' => 'Alarming paternity fraud statistics in urban clinics have sparked nationwide calls for compulsory DNA verification before fathers sign birth registers. Opponents warn mandatory testing destroys marital trust and weaponizes biology against children.',
            'category' => 'Family & Home',
            'region' => 'Africa & Middle East',
            'tags' => ['DNATesting', 'PaternityFraud', 'MarriageEthics', 'FamilyLaw', 'ParentalRights'],
            'perspectives' => [
                [
                    'archetype' => 'Family Lawyer',
                    'choice' => 'YES',
                    'note' => 'Paternity fraud is emotional and financial devastation of the highest order. Making DNA verification mandatory at hospital delivery removes stigma, protects men from raising children not their own, and provides absolute legal clarity for child custody and inheritance.'
                ],
                [
                    'archetype' => 'Sociologist',
                    'choice' => 'NO',
                    'note' => 'Treating every pregnant mother as a suspected fraudster destroys the bedrock of trust in marriage. Fatherhood is a commitment of nurture, love, and community protection, not just a laboratory swab.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Sociologist',
                    'archetype' => 'Labor Advocate',
                    'content' => 'Saying fatherhood is not biological is easy until you spend 20 years paying school fees only to discover the child belongs to your landlord or pastor. Truth harms no innocent soul.'
                ]
            ]
        ],
        [
            'title' => 'Should public officials seeking healthcare abroad be immediately disqualified from holding office?',
            'description' => 'Citizens argue leaders will never invest in domestic teaching hospitals while public funds fly them to London and Dubai for routine checkups. Political insiders claim security threats and specialist medical confidentiality justify foreign care.',
            'category' => 'Politics & Policy',
            'region' => 'Africa & Middle East',
            'tags' => ['MedicalTourism', 'PublicHospitals', 'Accountability', 'Governance', 'HealthcareReform'],
            'perspectives' => [
                [
                    'archetype' => 'Public Health Doctor',
                    'choice' => 'YES',
                    'note' => 'If Nigerian hospitals are good enough for the citizens who pay taxes, they must be good enough for the politicians managing the budget. The moment their lives depend on local clinics, our healthcare system will be repaired in 6 months.'
                ],
                [
                    'archetype' => 'Policy Insider',
                    'choice' => 'NO',
                    'note' => 'National leaders handle sensitive intelligence that hostile actors could compromise in local facilities lacking high-grade countersurveillance. Furthermore, emergency specialized trauma surgery sometimes requires immediate foreign centers.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Policy Insider',
                    'archetype' => 'Student Leader',
                    'content' => 'Ordinary citizens die daily of preventable asthma and childbirth bleeding because clinics lack electricity and bandages. Leaders must feel the direct pain of the hospitals they refuse to fund.'
                ]
            ]
        ],
        [
            'title' => 'First date with an uninvited entourage of friends: is walking out without paying the bill justified?',
            'description' => 'A viral dispute on Nigerian social media pits dating etiquette against financial dignity. One camp argues inviting friends to order expensive platters on someone else\'s bill is extortion, while critics call walking out ungentlemanly.',
            'category' => 'Dating & Relationships',
            'region' => 'Africa & Middle East',
            'tags' => ['DatingEtiquette', 'FirstDateBills', 'LagosDating', 'Entitlement', 'ModernDating'],
            'perspectives' => [
                [
                    'archetype' => 'Financial Educator',
                    'choice' => 'YES',
                    'note' => 'Dating is an intentional mutual interaction, not an open buffet sponsorship for your hungry roommates. Walking out and settling only your bottle of water teaches predatory daters a lifelong lesson in basic respect.'
                ],
                [
                    'archetype' => 'Creative & Designer',
                    'choice' => 'NO',
                    'note' => 'Walking out creates a public scandal and shows emotional immaturity. An adult simply handles the food they ordered, pays for the date as agreed, and politely cuts communication afterward.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Creative & Designer',
                    'archetype' => 'Tech Youth & Freelancer',
                    'content' => 'There is no maturity in being a willing financial victim to a ₦180,000 bill you never authorized. Self-respect means refusing extortion.'
                ]
            ]
        ],
        [
            'title' => 'Abolishing bride price completely in African customary marriages: Agree or Disagree?',
            'description' => 'Modern couples argue that monetary bride price commodifies women and makes abusive in-laws feel entitled to treat wives like purchased property. Traditional elders insist bride price is sacred cultural honor and token appreciation between families.',
            'category' => 'Culture & Society',
            'region' => 'Africa & Middle East',
            'tags' => ['BridePrice', 'TraditionalWedding', 'GenderEquality', 'AfricanCulture', 'FamilyEthics'],
            'perspectives' => [
                [
                    'archetype' => 'Sociologist',
                    'choice' => 'YES',
                    'note' => 'Commercializing traditional wedding list requirements into hundreds of thousands of Naira makes women appear like bought chattel in the eyes of insecure men. Eradicating bride price ends marital ownership entitlement.'
                ],
                [
                    'archetype' => 'Traditional Chief',
                    'choice' => 'NO',
                    'note' => 'Bride price has never been a purchase price; it is a spiritual and cultural covenant of gratitude between two lineages. Scrapping it erodes ancient African identity and reduces sacred union to Western casual cohabitation.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Traditional Chief',
                    'archetype' => 'Family Lawyer',
                    'content' => 'When in-laws demand cash, yam tubers, wrappers, and live goats costing ₦1.5M, calling it a token appreciation is dishonesty. Custom must modernize or perish.'
                ]
            ]
        ],
        [
            'title' => 'Japa on a heavy student loan vs earning ₦2.5 Million monthly in Lagos: is leaving Nigeria automatically better?',
            'description' => 'The great middle-class dilemma: is abandoning a comfortable high-income executive job in Nigeria worth the grueling hustle, winter cold, and minimum-wage student survival abroad just to secure foreign citizenship?',
            'category' => 'Workplace & Career',
            'region' => 'Africa & Middle East',
            'tags' => ['JapaWave', 'Relocation', 'NigeriaEconomy', 'MiddleClass', 'BrainDrain'],
            'perspectives' => [
                [
                    'archetype' => 'Economist',
                    'choice' => 'NO',
                    'note' => '₦2.5 Million net monthly puts you in the top 1% of purchasing power in Nigeria. Leaving that to take a $40,000 tuition loan and work night shifts at a warehouse abroad is emotional self-sabotage driven by peer pressure.'
                ],
                [
                    'archetype' => 'Tech Youth & Freelancer',
                    'choice' => 'YES',
                    'note' => 'Your ₦2.5M salary can be halved in real dollar purchasing power within 12 months by a single central bank devaluation. Citizenship in a country with rule of law, functional hospitals, and steady power is an invaluable generational hedge.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Economist',
                    'archetype' => 'Labor Advocate',
                    'content' => 'Money in Nigeria cannot buy you good roads when you have an emergency at 2 AM or prevent armed kidnappers on interstate highways. Security has no price tag.'
                ]
            ]
        ]
    ];
}

// Generate an Issue using Gemini API or Curated Templates with Strict Deduplication
function generate_curated_debate($personas, $apiKey, $model = 'gemini-1.5-flash', PDO $pdo = null) {
    $fallbackTemplates = get_curated_fallback_debates();

    // Query existing active titles from SQLite to prevent repeating recent topics
    $existingTitles = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT title FROM issues WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 150");
            $existingTitles = $stmt->fetchAll(PDO::FETCH_COLUMN);
        } catch (Exception $e) {}
    }

    // If Gemini key is available, attempt real AI generation
    if (!empty($apiKey)) {
        // Pick 6 random diverse personas to feature in prompt
        shuffle($personas);
        $selectedPersonas = array_slice($personas, 0, 6);

        $personaContext = [];
        foreach ($selectedPersonas as $p) {
            $personaContext[] = "ID: {$p['id']} | Name: {$p['name']} | Role: {$p['role']} | Archetype: {$p['archetype']} | Tone: {$p['toneGuidelines']}";
        }
        $personaPromptText = implode("\n", $personaContext);

        $dedupPrompt = "";
        if (!empty($existingTitles)) {
            $dedupPrompt = "\n\nCRITICAL DEDUPLICATION RULE: The following topics have ALREADY been debated and posted. You MUST NOT generate any topic or question similar to any of these:\n- " . implode("\n- ", array_slice($existingTitles, 0, 45)) . "\n";
        }

        $prompt = "
You are an expert community debate curator for YesOrNo, a fast-paced public voting and deliberation app.
Create ONE direct, authentic, and rage-baiting binary question (strictly YES or NO) specifically crafted as a Nigerian for Nigerians.
{$dedupPrompt}
TOPIC ROTATION & NIGERIAN REALITIES:
1. Politics & Policy: Mandatory civil service retirement at 50 for youth jobs, stripping politicians seeking foreign healthcare of office, state police weaponization, scrapping minimum wage, banning non-voters from passports.
2. Economy & Finance: Floating the Naira (worst policy or necessary medicine?), fuel subsidy reinstatement, emergency food price caps on market traders, landlords demanding 2 years rent upfront, crypto banking integration.
3. Dating & Relationships: 50/50 rent splitting in marriage, first date food bills with an uninvited entourage, checking partner's phone without permission, dating broke men/women in Lagos, ₦5M wedding budgets vs court weddings.
4. Culture & Society: Abolishing bride price completely, spraying crisp Naira at Owambe parties, calling older relatives by first names, genotype AS marrying AS (wickedness or faith?), cutting off toxic family black tax.
5. Work, Career & Hustle: Japa vs ₦2.5M local salary, toxic weekend WhatsApp messages from bosses, remote USD tech jobs on local company time, unpaid weekend overtime, corporate entitlement.
6. Business & Commerce: POS ₦500 withdrawal extortion, dollarized rent, market traders hiking prices arbitrarily.

QUESTION FORMAT VARIETY (VARY YOUR STYLE!):
Do NOT always start with 'Should...'. Alternate across these punchy styles:
* Captivating True-Life Story / Dilemma Hook (Emotional & Viral):
  (DO NOT use prefix labels like 'CONFESSION:' or 'TRUE LIFE STORY:'. Start directly with the raw situation, e.g. 'I found out my fiancé has a secret 4-year-old child 2 weeks before our wedding: should I cancel?', 'I earn ₦2.8M in Lagos and refuse to fund my 30-year-old brother\\'s lifestyle: am I being selfish?', 'I secretly took a DNA test on our 2-year-old son behind my wife\\'s back: was I wrong to doubt her?')
  CRITICAL FOR SOCIAL SHARING: The first 8 to 12 words of the title and description MUST be a high-voltage, jaw-dropping hook that stops people from scrolling on Twitter/X, WhatsApp, or Facebook!
* Short & Sharp Direct Question (3 to 8 words):
  e.g. 'End NYSC now?', 'Abolish bride price completely?', 'Checking partner\\'s phone: justified?', 'Ban commercial bikes on expressways?'
* Contextual Statement Preamble + Question:
  e.g. 'Fuel subsidy is gone and transport tripled: should it be brought back?', 'Lagos rent is now payable quarterly: is this fair to landlords?'
* Direct Binary Polarity Hot-Take:
  e.g. 'A man earning ₦150k has no business dating in Lagos: agree?', '50/50 rent in marriage: Yes or No?'
* Provocative Civic Question:
  e.g. 'Should civil servants retire at 50 to create youth employment?', 'Should politicians seeking healthcare abroad be barred from public office?'
Every question must end with a single '?' and strictly elicit a YES or NO.

PROVOCATION, LANGUAGE & SARCASM INSTRUCTIONS:
- CRITICAL: NO BIG GRAMMAR, NO TECHNICAL ESSAY JARGON.
  - Strictly avoid phrases like 'from a practical standpoint', 'structural framework', 'mitigate friction', 'socioeconomic paradigm', 'macroeconomic implications', 'institutional accountability', 'concomitant'.
  - Sound like REAL PEOPLE on Nigerian Twitter/X, in a bus, salon, barber shop, or cafeteria. Simple, conversational English that any layperson gets in 2 seconds.
- MANDATORY SARCASM, DRY WIT & IRONY:
  - At least 2 of the 4 perspectives AND the rebuttal MUST contain sharp sarcasm, dry humor, or rhetorical irony!
  - Examples:
    * 'Ah yes, because salary doubles every time fuel goes up, right?'
    * 'So someone should work 30 days straight just to give the landlord everything and survive on photosynthesis?'
    * 'Let us be serious for once in this country. Are we joking or what?'
    * 'Next thing now they will tell us to pay tax before we breathe fresh air.'
    * 'You want 50/50 rent but when it is time for pregnancy you remember biology is not 50/50. Choose one struggle please.'
    * 'Make it make sense!'
- PERSPECTIVES & TAKES:
  - Takes must have CONFIDENT ARROGANCE on one side and FURIOUS, STREET-SMART INDIGNATION on the other side.
  - Make users itch to tap NO or YES out of pure conviction or outrage!
  - NEVER use formal titles (No 'Dr.', 'Prof.', 'Chief', etc.). Use strictly first and last names.
  - The takes should be short, punchy, relatable, and opinionated (2 to 3 sentences maximum, under 45 words each).
  - Ground arguments in tangible everyday realities: inflation, house rent, fuel costs, remote work, school fees, generator fuel, traffic, dating bills, or business.
- REBUTTALS MUST BE PUNCHY CALL-OUTS:
  - The rebuttal must directly mock, roast, or challenge the other persona's naive assumption with biting sarcasm and street-smart common sense!

Select 4 distinct personas from the list below to write the primary perspectives (2 for YES, 2 for NO), and 1 persona to post a direct threaded rebuttal to one of the comments.

Personas available:
{$personaPromptText}

Output strict JSON with this exact schema:
{
  \"title\": \"Clear, high-stakes binary question (short & sharp, statement+question, or direct hot-take)\",
  \"description\": \"2-3 punchy sentences giving a sharp take/perspective on the dilemma, explaining why this debate is burning right now with the bold YES conviction and the angry NO indignation.\",
  \"category\": \"Economy & Finance | Politics & Governance | Technology & Internet | Education | Infrastructure | Health & Medicine | Family & Home\",
  \"region\": \"Africa & Middle East\",
  \"tags\": [\"Tag1\", \"Tag2\", \"Tag3\", \"Tag4\"],
  \"perspectives\": [
    {
      \"personaId\": \"ID from list\",
      \"choice\": \"YES or NO\",
      \"note\": \"Authentic, opinionated perspective in simple conversational language with street-smart logic and dry sarcasm (2 to 3 short sentences, max 45 words).\"
    }
  ],
  \"rebuttals\": [
    {
      \"personaId\": \"ID of persona replying\",
      \"replyToPersonaId\": \"ID of persona being rebutted\",
      \"content\": \"Sharp, sarcastic counter-argument roasting their naive premise with street reality (1 to 2 punchy sentences).\"
    }
  ]
}
";

        $aiResult = call_gemini_api($prompt, $apiKey, $model);
        if ($aiResult && !empty($aiResult['title']) && !empty($aiResult['perspectives'])) {
            return [
                'source' => 'gemini_ai',
                'data' => $aiResult
            ];
        }
    }

    // Fallback: Pick a curated high-friction debate template that has NOT been posted yet
    $normalizedExisting = array_map(function($t) {
        return preg_replace('/[^a-z0-9]/', '', strtolower($t));
    }, $existingTitles);

    $availableTemplates = array_filter($fallbackTemplates, function($tpl) use ($normalizedExisting) {
        $norm = preg_replace('/[^a-z0-9]/', '', strtolower($tpl['title']));
        return !in_array($norm, $normalizedExisting);
    });

    if (empty($availableTemplates)) {
        $availableTemplates = $fallbackTemplates;
    }
    $template = $availableTemplates[array_rand($availableTemplates)];
    
    // Assign real matching personas from our 51-persona library
    $assignedPerspectives = [];
    $assignedPersonas = [];

    foreach ($template['perspectives'] as $tplPersp) {
        $matched = null;
        foreach ($personas as $p) {
            if ($p['archetype'] === $tplPersp['archetype'] && !in_array($p['id'], $assignedPersonas)) {
                $matched = $p;
                break;
            }
        }
        if (!$matched) {
            // Pick random unassigned persona
            foreach ($personas as $p) {
                if (!in_array($p['id'], $assignedPersonas)) {
                    $matched = $p;
                    break;
                }
            }
        }
        if ($matched) {
            $assignedPersonas[] = $matched['id'];
            $assignedPerspectives[] = [
                'personaId' => $matched['id'],
                'persona' => $matched,
                'choice' => $tplPersp['choice'],
                'note' => $tplPersp['note']
            ];
        }
    }

    $assignedRebuttals = [];
    if (!empty($template['rebuttals']) && count($assignedPerspectives) >= 2) {
        foreach ($template['rebuttals'] as $reb) {
            $replier = null;
            foreach ($personas as $p) {
                if ($p['archetype'] === $reb['archetype'] && !in_array($p['id'], $assignedPersonas)) {
                    $replier = $p;
                    break;
                }
            }
            if (!$replier && count($personas) > 0) {
                $replier = $personas[array_rand($personas)];
            }
            if ($replier) {
                $assignedRebuttals[] = [
                    'personaId' => $replier['id'],
                    'persona' => $replier,
                    'targetPersonaId' => $assignedPerspectives[0]['personaId'],
                    'content' => $reb['content']
                ];
            }
        }
    }

    return [
        'source' => 'curated_library',
        'data' => [
            'title' => $template['title'],
            'description' => $template['description'],
            'category' => $template['category'],
            'region' => $template['region'],
            'tags' => $template['tags'],
            'perspectives' => $assignedPerspectives,
            'rebuttals' => $assignedRebuttals
        ]
    ];
}

// Persist Curated Debate into SQLite Database with Strict Title Deduplication
function persist_curated_debate(PDO $pdo, $personas, $debateData, $settings) {
    if (empty($debateData) || empty($debateData['title'])) {
        return null;
    }

    $normalizedNew = preg_replace('/[^a-z0-9]/', '', strtolower($debateData['title']));

    // Strict deduplication check against existing active issues in database
    try {
        $checkStmt = $pdo->query("SELECT id, title FROM issues WHERE is_deleted = 0");
        $existing = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($existing as $row) {
            $normExisting = preg_replace('/[^a-z0-9]/', '', strtolower($row['title']));
            if ($normExisting === $normalizedNew) {
                error_log("Curation deduplication triggered: {$row['title']} already exists.");
                return [
                    'duplicate' => true,
                    'issueId' => $row['id'],
                    'title' => $row['title']
                ];
            }
        }
    } catch (Exception $e) {}

    $now = gmdate('Y-m-d\TH:i:s\Z');
    $issueId = 'issue-' . bin2hex(random_bytes(6));

    // Calculate natural vote counts (~85 to ~140 votes with ~54/46 to ~62/38 split)
    $minVotes = max(50, (int)($settings['minTargetVotes'] ?? 85));
    $maxVotes = max($minVotes + 10, (int)($settings['maxTargetVotes'] ?? 140));
    $totalVotes = rand($minVotes, $maxVotes);
    
    // Realistic split (between 44% and 62% for YES)
    $yesPercent = rand(44, 62) / 100.0;
    $yesCount = (int)round($totalVotes * $yesPercent);
    $noCount = $totalVotes - $yesCount;
    $likesCount = (int)round($totalVotes * (rand(15, 35) / 100.0));
    $favCount = (int)round($totalVotes * (rand(5, 15) / 100.0));
    $viewsCount = (int)round(($totalVotes * rand(38, 52) / 10.0) + ($likesCount * 3) + rand(25, 75));
    $impressionsCount = (int)round($viewsCount * rand(18, 25) / 10.0);

    // Choose Author Persona
    $authorPersona = $personas[array_rand($personas)];

    // Insert Issue
    $stmtIssue = $pdo->prepare("
        INSERT INTO issues (
            id, title, description, category, region, tags,
            author, creator_id, creator_email, is_anonymous_author,
            closing_date, duration_label, visibility,
            yes_count, no_count, likes_count, favorites_count,
            views_count, impressions_count,
            featured, created_at, updated_at
        ) VALUES (
            :id, :title, :description, :category, :region, :tags,
            :author, :creator_id, :creator_email, 0,
            NULL, 'Indefinite (Open Community Deliberation)', 'public',
            :yes_count, :no_count, :likes_count, :favorites_count,
            :views_count, :impressions_count,
            1, :created_at, :updated_at
        )
    ");

    $stmtIssue->execute([
        ':id' => $issueId,
        ':title' => $debateData['title'],
        ':description' => $debateData['description'],
        ':category' => $debateData['category'] ?? 'Politics & Governance',
        ':region' => $debateData['region'] ?? 'Africa & Middle East',
        ':tags' => json_encode($debateData['tags'] ?? ['Deliberation', 'Civic']),
        ':author' => $authorPersona['name'],
        ':creator_id' => $authorPersona['id'],
        ':creator_email' => $authorPersona['email'],
        ':yes_count' => $yesCount,
        ':no_count' => $noCount,
        ':likes_count' => $likesCount,
        ':favorites_count' => $favCount,
        ':views_count' => $viewsCount,
        ':impressions_count' => $impressionsCount,
        ':created_at' => $now,
        ':updated_at' => $now
    ]);

    // Insert Responses (Perspectives)
    $stmtResp = $pdo->prepare("
        INSERT INTO responses (
            id, issue_id, choice, author_name, author_email,
            author_role, is_anonymous, note, voice_note, likes_count,
            is_reported, created_at
        ) VALUES (
            :id, :issue_id, :choice, :author_name, :author_email,
            :author_role, 0, :note, NULL, :likes_count,
            0, :created_at
        )
    ");

    $responseIds = [];
    foreach ($debateData['perspectives'] as $p) {
        $pId = $p['personaId'] ?? '';
        $matchedPersona = null;
        if (!empty($p['persona'])) {
            $matchedPersona = $p['persona'];
        } else {
            foreach ($personas as $cand) {
                if ($cand['id'] === $pId) {
                    $matchedPersona = $cand;
                    break;
                }
            }
        }
        if (!$matchedPersona) {
            $matchedPersona = $personas[array_rand($personas)];
        }

        $subId = 'sub-' . bin2hex(random_bytes(6));
        $respLikes = rand(8, 38);

        $stmtResp->execute([
            ':id' => $subId,
            ':issue_id' => $issueId,
            ':choice' => strtoupper($p['choice']) === 'NO' ? 'NO' : 'YES',
            ':author_name' => $matchedPersona['name'],
            ':author_email' => $matchedPersona['email'],
            ':author_role' => $matchedPersona['role'],
            ':note' => $p['note'],
            ':likes_count' => $respLikes,
            ':created_at' => $now
        ]);

        $responseIds[$matchedPersona['id']] = $subId;
    }

    // Insert Rebuttals (Threaded Replies)
    $stmtReply = $pdo->prepare("
        INSERT INTO replies (
            id, submission_id, issue_id, author_name, author_email,
            author_role, is_anonymous, content, reply_to_name,
            likes_count, created_at
        ) VALUES (
            :id, :submission_id, :issue_id, :author_name, :author_email,
            :author_role, 0, :content, :reply_to_name,
            :likes_count, :created_at
        )
    ");

    if (!empty($debateData['rebuttals'])) {
        foreach ($debateData['rebuttals'] as $reb) {
            $replierPersona = null;
            if (!empty($reb['persona'])) {
                $replierPersona = $reb['persona'];
            } else {
                foreach ($personas as $cand) {
                    if ($cand['id'] === ($reb['personaId'] ?? '')) {
                        $replierPersona = $cand;
                        break;
                    }
                }
            }
            if (!$replierPersona) {
                $replierPersona = $personas[array_rand($personas)];
            }

            // Find target submission ID
            $targetSubId = null;
            $replyToName = null;
            if (!empty($reb['targetPersonaId']) && isset($responseIds[$reb['targetPersonaId']])) {
                $targetSubId = $responseIds[$reb['targetPersonaId']];
            } else if (!empty($responseIds)) {
                $targetSubId = reset($responseIds);
            }

            if ($targetSubId) {
                $replyId = 'rep-' . bin2hex(random_bytes(6));
                $stmtReply->execute([
                    ':id' => $replyId,
                    ':submission_id' => $targetSubId,
                    ':issue_id' => $issueId,
                    ':author_name' => $replierPersona['name'],
                    ':author_email' => $replierPersona['email'],
                    ':author_role' => $replierPersona['role'],
                    ':content' => $reb['content'],
                    ':reply_to_name' => $replyToName,
                    ':likes_count' => rand(4, 19),
                    ':created_at' => $now
                ]);
            }
        }
    }

    return [
        'issueId' => $issueId,
        'title' => $debateData['title'],
        'totalVotes' => $totalVotes,
        'yesCount' => $yesCount,
        'noCount' => $noCount,
        'perspectivesCount' => count($debateData['perspectives']),
        'rebuttalsCount' => count($debateData['rebuttals'] ?? [])
    ];
}

// -------------------------------------------------------------
// Incremental User Debate Incubation Engine
// Nurtures user-created debates with realistic personas & votes
// -------------------------------------------------------------

function build_curator_issue_slug($title, $id) {
    $slug = strtolower($title);
    $slug = preg_replace('/[^a-z0-9]+/i', '-', $slug);
    $slug = trim($slug, '-');
    $slug = substr($slug, 0, 70);
    $slug = rtrim($slug, '-');
    return $slug ? $slug . '-' . $id : $id;
}

function dispatch_incubation_notification($recipientEmail, $issueTitle, $issueSlug, $persona, $choice, $note) {
    // Automated simulation incubation must never dispatch external emails to avoid burning server mail quotas
    return false;
}

function generate_incubated_perspective($issue, $persona, $choice, $apiKey = '', $model = 'gemini-1.5-flash') {
    if (!empty($apiKey)) {
        $prompt = "You are {$persona['name']}, a {$persona['role']}. Bio: {$persona['bio']}.\n"
            . "Topic: \"{$issue['title']}\"\n"
            . "Context: \"{$issue['description']}\"\n"
            . "Your stance: {$choice} (You firmly support this side).\n\n"
            . "CRITICAL TONE & STYLE INSTRUCTIONS:\n"
            . "- NO BIG GRAMMAR OR TECHNICAL JARGON: Strictly avoid academic, essay, or corporate language (never say 'from a practical standpoint', 'operational overhead', 'systemic implications', 'concomitant', or 'As an AI/professional').\n"
            . "- SIMPLE LAYPERSON ENGLISH: Speak casually and directly like a real person commenting on Nigerian Twitter/X or arguing with friends at a bus stop or salon.\n"
            . "- SARCASM & DRY WIT: Use biting sarcasm, dry humor, or rhetorical irony (e.g., 'Are we being serious right now?', 'Ah yes, because...', 'Please abeg, let us stop pretending.', 'Make it make sense!').\n"
            . "- Keep it short and punchy: 1 to 3 sentences (maximum 40 words).\n"
            . "Return pure JSON: {\"note\": \"...\"}";

        $res = call_gemini_api($prompt, $apiKey, $model);
        if ($res && !empty($res['note'])) {
            return trim($res['note']);
        }
    }

    // Dynamic Curated Fallbacks (Plain English, Street-Smart, with Sarcasm & Wit)
    $yesTemplates = [
        "Let us be serious for once. If we keep pampering this problem, we will still be having this exact argument in 2035. End it now and let everybody adjust.",
        "Support 100%. The only people complaining are those enjoying the current confusion. When the benefits show, the same critics will claim they supported it from day one.",
        "Ah yes, because waiting another 10 years will magically fix things on its own, right? Make this move now. Common sense over sentiments please.",
        "Total YES. Look at what is happening on ground right now and tell me the status quo is working. Stop overthinking it and do the right thing.",
        "If you ask me, this is long overdue. People love to shout before a policy starts, but once order returns, nobody remembers the noise. Move forward.",
        "Support completely. How can anyone look at this reality and still argue for business as usual? Make it make sense abeg."
    ];

    $noTemplates = [
        "Are we being serious right now? In this same economy where people are struggling with fuel and food, you want to add another impossible headache on top?",
        "Capital NO please. Beautiful grammar on paper, but on the street it just means police and task force will find fresh excuse to harass ordinary citizens.",
        "Wonderful logic. You haven't fixed the basic foundation and you want to jump straight to the roof? Let us stop playing with people's livelihoods.",
        "Vote NO abeg. It sounds sweet in air-conditioned boardrooms, but anyone who actually enters market or buys things with their own money knows this will fail.",
        "So we should just wake up and pretend the reality on ground doesn't exist? Please let us stop copying foreign ideas that fail the simplest street test.",
        "Big NO. Next thing now they will tell us to apply for permit before we breathe fresh air. Let people breathe please!"
    ];

    $pool = ($choice === 'YES') ? $yesTemplates : $noTemplates;
    return $pool[array_rand($pool)];
}

function incubate_user_debates(PDO $pdo, array $personas, array $settings) {
    if (empty($settings['isEnabled'])) {
        return ['success' => false, 'reason' => 'Engine is paused'];
    }

    // Fetch candidate issues that have < 6 responses
    $stmt = $pdo->prepare("
        SELECT i.id, i.title, i.description, i.category, i.region, i.creator_email, i.author, i.created_at,
               (SELECT COUNT(*) FROM responses WHERE issue_id = i.id) as response_count,
               (SELECT MAX(created_at) FROM responses WHERE issue_id = i.id) as latest_response_at,
               (SELECT COUNT(*) FROM responses WHERE issue_id = i.id AND choice = 'YES') as yes_responses,
               (SELECT COUNT(*) FROM responses WHERE issue_id = i.id AND choice = 'NO') as no_responses
        FROM issues i
        WHERE (SELECT COUNT(*) FROM responses WHERE issue_id = i.id) < 6
        ORDER BY i.created_at DESC
        LIMIT 15
    ");
    $stmt->execute();
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($candidates)) {
        return ['success' => true, 'action' => 'none', 'message' => 'No active issues currently require incubation'];
    }

    $incubated = [];
    $nowTime = time();

    foreach ($candidates as $cand) {
        $respCount = (int)$cand['response_count'];

        // Determine reference time: issue creation or last response timestamp
        $refTime = $respCount === 0 
            ? strtotime($cand['created_at'])
            : strtotime($cand['latest_response_at'] ?: $cand['created_at']);

        // Cooldown schedule:
        // Response 0 -> 1: 120s (2m)
        // Response 1 -> 2: 240s (4m)
        // Response 2 -> 3: 360s (6m)
        // Response 3+:     480s (8m)
        $requiredCooldown = 480;
        if ($respCount === 0) {
            $requiredCooldown = 120;
        } else if ($respCount === 1) {
            $requiredCooldown = 240;
        } else if ($respCount === 2) {
            $requiredCooldown = 360;
        }

        if (($nowTime - $refTime) < $requiredCooldown) {
            continue; // Cooldown hasn't elapsed yet
        }

        // Ready for next incremental response
        $existStmt = $pdo->prepare("SELECT author_email FROM responses WHERE issue_id = :issue_id");
        $existStmt->execute([':issue_id' => $cand['id']]);
        $existingEmails = $existStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $existingEmails = array_map('strtolower', $existingEmails);

        if (!empty($cand['creator_email'])) {
            $existingEmails[] = strtolower($cand['creator_email']);
        }

        $availablePersonas = array_filter($personas, function($p) use ($existingEmails) {
            return !in_array(strtolower($p['email']), $existingEmails);
        });

        if (empty($availablePersonas)) {
            $availablePersonas = $personas;
        }

        // Select persona (prefer category match if available)
        $categoryLower = strtolower($cand['category'] ?? '');
        $categoryPersonas = array_filter($availablePersonas, function($p) use ($categoryLower) {
            $pRole = strtolower($p['role'] ?? '');
            $pBio = strtolower($p['bio'] ?? '');
            if (strpos($categoryLower, 'econ') !== false || strpos($categoryLower, 'fin') !== false) {
                return strpos($pRole, 'econom') !== false || strpos($pRole, 'finan') !== false || strpos($pBio, 'market') !== false;
            }
            if (strpos($categoryLower, 'tech') !== false) {
                return strpos($pRole, 'tech') !== false || strpos($pRole, 'engine') !== false || strpos($pBio, 'ai') !== false;
            }
            if (strpos($categoryLower, 'gov') !== false || strpos($categoryLower, 'polit') !== false) {
                return strpos($pRole, 'policy') !== false || strpos($pRole, 'civic') !== false || strpos($pRole, 'analyst') !== false;
            }
            return true;
        });

        $chosenPersona = !empty($categoryPersonas)
            ? $categoryPersonas[array_rand($categoryPersonas)]
            : $availablePersonas[array_rand($availablePersonas)];

        // Balance stance (YES vs NO)
        $yesResp = (int)$cand['yes_responses'];
        $noResp = (int)$cand['no_responses'];
        if ($yesResp > $noResp) {
            $stance = 'NO';
        } else if ($noResp > $yesResp) {
            $stance = 'YES';
        } else {
            $stance = (rand(0, 1) === 1) ? 'YES' : 'NO';
        }

        // Generate note
        $note = generate_incubated_perspective($cand, $chosenPersona, $stance, $settings['geminiApiKey'] ?? '', $settings['model'] ?? 'gemini-1.5-flash');

        $nowIso = gmdate('Y-m-d\TH:i:s\Z');
        $subId = 'sub-' . bin2hex(random_bytes(6));
        $respLikes = rand(3, 14);

        // Insert response
        $insResp = $pdo->prepare("
            INSERT INTO responses (
                id, issue_id, choice, author_name, author_email,
                author_role, is_anonymous, note, voice_note, likes_count,
                is_reported, created_at
            ) VALUES (
                :id, :issue_id, :choice, :author_name, :author_email,
                :author_role, 0, :note, NULL, :likes_count,
                0, :created_at
            )
        ");
        $insResp->execute([
            ':id' => $subId,
            ':issue_id' => $cand['id'],
            ':choice' => $stance,
            ':author_name' => $chosenPersona['name'],
            ':author_email' => $chosenPersona['email'],
            ':author_role' => $chosenPersona['role'],
            ':note' => $note,
            ':likes_count' => $respLikes,
            ':created_at' => $nowIso
        ]);

        // Drip 2 to 4 organic votes to the issue
        $addStanceVotes = rand(2, 4);
        $addOppositeVotes = rand(0, 1);
        $addYes = ($stance === 'YES') ? $addStanceVotes : $addOppositeVotes;
        $addNo = ($stance === 'NO') ? $addStanceVotes : $addOppositeVotes;

        $updateIssue = $pdo->prepare("
            UPDATE issues 
            SET yes_count = yes_count + :add_yes,
                no_count = no_count + :add_no,
                likes_count = likes_count + 1,
                updated_at = :now
            WHERE id = :id
        ");
        $updateIssue->execute([
            ':add_yes' => $addYes,
            ':add_no' => $addNo,
            ':now' => $nowIso,
            ':id' => $cand['id']
        ]);

        // Build slug for notifications
        $slug = build_curator_issue_slug($cand['title'], $cand['id']);

        // Dispatch author notification
        if (!empty($cand['creator_email'])) {
            dispatch_incubation_notification($cand['creator_email'], $cand['title'], $slug, $chosenPersona, $stance, $note);
        }

        $incubated[] = [
            'issueId' => $cand['id'],
            'issueTitle' => $cand['title'],
            'persona' => $chosenPersona['name'],
            'role' => $chosenPersona['role'],
            'stance' => $stance,
            'note' => $note,
            'votesAdded' => ['yes' => $addYes, 'no' => $addNo],
            'newTotalResponses' => $respCount + 1,
            'timestamp' => $nowIso
        ];

        // Process up to 1-2 per cycle to maintain paced progression
        if (count($incubated) >= 2) {
            break;
        }
    }

    return [
        'success' => true,
        'action' => 'incubate',
        'count' => count($incubated),
        'incubated' => $incubated
    ];
}

// -------------------------------------------------------------
// Router / Action Handlers
// -------------------------------------------------------------
$settings = get_curator_settings($settingsPath);
$personas = load_seed_personas($personasPath);
$pdo = get_curator_pdo($dbPath);

$action = isset($_GET['action']) ? trim($_GET['action']) : (isset($_POST['action']) ? trim($_POST['action']) : '');
$isCron = isset($_GET['cron']) && ($_GET['cron'] === '1' || $_GET['cron'] === 'true');

// Support GET ?action=status
if ($action === 'status' || ((isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'GET') && !$isCron && empty($action))) {
    $totalCurated = 0;
    $totalMembersInDb = 0;
    if ($pdo) {
        $res = $pdo->query("SELECT COUNT(*) FROM issues");
        if ($res) $totalCurated = (int)$res->fetchColumn();
        $profRes = $pdo->query("SELECT COUNT(*) FROM user_profiles");
        if ($profRes) $totalMembersInDb = (int)$profRes->fetchColumn();
    }

    echo json_encode([
        'success' => true,
        'status' => $settings['isEnabled'] ? 'ACTIVE' : 'PAUSED',
        'settings' => [
            'isEnabled' => (bool)$settings['isEnabled'],
            'hasApiKey' => !empty($settings['geminiApiKey']),
            'model' => $settings['model'] ?? 'gemini-1.5-flash',
            'intervalHours' => (int)($settings['intervalHours'] ?? 6),
            'lastRunAt' => $settings['lastRunAt'],
            'minTargetVotes' => (int)($settings['minTargetVotes'] ?? 85),
            'maxTargetVotes' => (int)($settings['maxTargetVotes'] ?? 140)
        ],
        'totalPersonasLoaded' => count($personas),
        'totalDatabaseMembers' => $totalMembersInDb,
        'totalIssues' => $totalCurated,
        'recentCurations' => $settings['recentCurations'] ?? []
    ]);
    exit;
}

// Master Kill Switch: Toggle Active / Paused
if ($action === 'toggle') {
    $current = !empty($settings['isEnabled']);
    $settings['isEnabled'] = !$current;
    save_curator_settings($settingsPath, $settings);

    echo json_encode([
        'success' => true,
        'isEnabled' => $settings['isEnabled'],
        'status' => $settings['isEnabled'] ? 'ACTIVE' : 'PAUSED',
        'message' => $settings['isEnabled'] 
            ? 'AI Autonomous Curation Engine has been RESUMED' 
            : 'AI Autonomous Curation Engine has been PAUSED by Admin'
    ]);
    exit;
}

// Save Settings (API Key, Intervals, Vote Ranges)
if ($action === 'save_settings') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true) ?: $_POST;

    if (isset($payload['isEnabled'])) $settings['isEnabled'] = (bool)$payload['isEnabled'];
    if (isset($payload['geminiApiKey'])) $settings['geminiApiKey'] = trim($payload['geminiApiKey']);
    if (isset($payload['intervalHours'])) $settings['intervalHours'] = max(1, (int)$payload['intervalHours']);
    if (isset($payload['minTargetVotes'])) $settings['minTargetVotes'] = max(20, (int)$payload['minTargetVotes']);
    if (isset($payload['maxTargetVotes'])) $settings['maxTargetVotes'] = max(30, (int)$payload['maxTargetVotes']);
    if (isset($payload['model'])) $settings['model'] = trim($payload['model']);

    save_curator_settings($settingsPath, $settings);

    echo json_encode([
        'success' => true,
        'settings' => [
            'isEnabled' => $settings['isEnabled'],
            'hasApiKey' => !empty($settings['geminiApiKey']),
            'intervalHours' => $settings['intervalHours'],
            'minTargetVotes' => $settings['minTargetVotes'],
            'maxTargetVotes' => $settings['maxTargetVotes']
        ],
        'message' => 'Curator settings updated successfully'
    ]);
    exit;
}

// Seed all 50+ personas into SQLite user_profiles
if ($action === 'seed_users') {
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'SQLite connection failed']);
        exit;
    }
    $seededCount = seed_personas_into_db($pdo, $personas);
    echo json_encode([
        'success' => true,
        'seededCount' => $seededCount,
        'message' => "Successfully synchronized {$seededCount} diverse intellectual personas into user_profiles table"
    ]);
    exit;
}

// Suggest Questions Grounded in Live Trends, News & Stories
if ($action === 'suggest_trends') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true) ?: [];

    $context = isset($_GET['context']) ? trim($_GET['context']) : (isset($payload['context']) ? trim($payload['context']) : '');
    $category = isset($_GET['category']) ? trim($_GET['category']) : (isset($payload['category']) ? trim($payload['category']) : '');
    $region = isset($_GET['region']) ? trim($_GET['region']) : (isset($payload['region']) ? trim($payload['region']) : 'Africa & Middle East');
    $customApiKey = isset($_GET['apiKey']) ? trim($_GET['apiKey']) : (isset($payload['apiKey']) ? trim($payload['apiKey']) : '');
    $cycle = isset($_GET['cycle']) ? (int)$_GET['cycle'] : (isset($payload['cycle']) ? (int)$payload['cycle'] : 1);
    $excludeTitles = isset($payload['excludeTitles']) && is_array($payload['excludeTitles']) 
        ? $payload['excludeTitles'] 
        : (isset($_GET['excludeTitles']) ? explode(',', $_GET['excludeTitles']) : []);

    $apiKey = !empty($customApiKey) ? $customApiKey : ($settings['geminiApiKey'] ?? '');
    $model = !empty($payload['model']) ? trim($payload['model']) : ($settings['model'] ?? 'gemini-1.5-flash');

    $result = generate_trend_question_suggestions($context, $category, $region, $apiKey, $model, $excludeTitles, $cycle);
    echo json_encode($result);
    exit;
}

// Incremental User Debate Incubation (Periodic Heartbeat / Webhook)
if ($action === 'incubate' || $action === 'incubate_heartbeat') {
    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database offline']);
        exit;
    }

    $incubationResult = incubate_user_debates($pdo, $personas, $settings);
    echo json_encode($incubationResult);
    exit;
}

// Generate New Issue & Debate Now (or via Cron)
if ($action === 'generate_issue' || $isCron) {
    // Check master kill switch
    if (!$settings['isEnabled'] && $action !== 'force_generate') {
        echo json_encode([
            'success' => false,
            'status' => 'PAUSED',
            'message' => 'Engine is currently PAUSED by Admin. Flip the switch in Admin Analytics to activate.'
        ]);
        exit;
    }

    if (!$pdo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database offline']);
        exit;
    }

    // Process mutex: prevent overlapping or race-condition cron triggers
    $lockFile = $dataDir . '/curator.lock';
    $fp = @fopen($lockFile, 'c+');
    if ($fp && !@flock($fp, LOCK_EX | LOCK_NB)) {
        echo json_encode([
            'success' => false,
            'status' => 'LOCKED',
            'message' => 'Another curation process is currently in progress.'
        ]);
        exit;
    }

    // Cooldown protection for automated cron runs (minimum interval between automated runs)
    if ($action !== 'force_generate' && !empty($settings['lastRunAt'])) {
        $elapsedSec = time() - strtotime($settings['lastRunAt']);
        $minIntervalHours = max(1, (int)($settings['intervalHours'] ?? 2));
        $minCooldownSec = ($minIntervalHours * 3600) - 300; // 5 min leeway
        if ($elapsedSec < $minCooldownSec) {
            echo json_encode([
                'success' => false,
                'status' => 'COOLDOWN',
                'message' => "Curation cooldown active. Last run was " . round($elapsedSec / 60) . " mins ago. Next run allowed in " . round(($minCooldownSec - $elapsedSec) / 60) . " mins."
            ]);
            if ($fp) { @flock($fp, LOCK_UN); @fclose($fp); }
            exit;
        }
    }

    // Also run incremental incubation on any waiting user debates during cron run
    $incubatedDebates = incubate_user_debates($pdo, $personas, $settings);

    // Generate debate with PDO passed for strict title deduplication against SQLite
    $result = generate_curated_debate($personas, $settings['geminiApiKey'] ?? '', $settings['model'] ?? 'gemini-1.5-flash', $pdo);
    $persisted = persist_curated_debate($pdo, $personas, $result['data'], $settings);

    // If duplicate was detected, retry once with a different template
    if (!$persisted || !empty($persisted['duplicate'])) {
        $result = generate_curated_debate($personas, '', $settings['model'] ?? 'gemini-1.5-flash', $pdo);
        $persisted = persist_curated_debate($pdo, $personas, $result['data'], $settings);
    }

    if (!$persisted || !empty($persisted['duplicate'])) {
        echo json_encode([
            'success' => false,
            'status' => 'DUPLICATE_PREVENTED',
            'message' => 'Topic generation skipped: unique candidate topic could not be resolved or already exists.'
        ]);
        if ($fp) { @flock($fp, LOCK_UN); @fclose($fp); }
        exit;
    }

    // Update settings last run & recent log
    $nowIso = gmdate('Y-m-d\TH:i:s\Z');
    $settings['lastRunAt'] = $nowIso;
    $recentItem = [
        'issueId' => $persisted['issueId'],
        'title' => $persisted['title'],
        'votes' => $persisted['totalVotes'],
        'perspectives' => $persisted['perspectivesCount'],
        'source' => $result['source'],
        'createdAt' => $nowIso
    ];
    $recentList = $settings['recentCurations'] ?? [];
    array_unshift($recentList, $recentItem);
    $settings['recentCurations'] = array_slice($recentList, 0, 15);
    save_curator_settings($settingsPath, $settings);

    if ($fp) {
        @flock($fp, LOCK_UN);
        @fclose($fp);
    }

    echo json_encode([
        'success' => true,
        'engine' => $result['source'],
        'issue' => $persisted,
        'incubated' => $incubatedDebates,
        'lastRunAt' => $nowIso,
        'message' => "Successfully generated and published: \"{$persisted['title']}\" with {$persisted['totalVotes']} initial votes."
    ]);
    exit;
}

// Unknown action fallback
echo json_encode([
    'success' => false,
    'error' => 'Unknown action requested',
    'availableActions' => ['status', 'toggle', 'save_settings', 'seed_users', 'generate_issue', 'incubate', 'incubate_heartbeat', 'suggest_trends']
]);
