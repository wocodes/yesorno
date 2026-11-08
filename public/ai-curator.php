<?php
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
        'intervalHours' => 6,
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
            'email' => $p['email'],
            'role' => $p['role'],
            'bio' => $p['bio'],
            'region' => $p['region'] ?? 'West Africa',
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

// Curated Fallback Debate Templates (Used when no Gemini key or during offline testing)
function get_curated_fallback_debates() {
    return [
        [
            'title' => 'Should African central banks peg domestic currencies to a regional commodity basket rather than the US Dollar?',
            'description' => 'With recurrent foreign exchange crises, currency devaluations, and soaring import inflation across emerging markets, monetary reformers argue that anchoring domestic currency reserves to export commodities (gold, lithium, oil, cocoa) would restore sovereign monetary stability. Opponents argue this would trigger severe capital flight and liquidity rationing.',
            'category' => 'Economy & Finance',
            'region' => 'West Africa',
            'tags' => ['Monetary Policy', 'Currency', 'Central Banking', 'AfCFTA', 'Inflation'],
            'perspectives' => [
                [
                    'archetype' => 'Development Economist',
                    'choice' => 'YES',
                    'note' => 'Dollar hegemony exposes our domestic economies to US Federal Reserve rate shocks we have zero control over. When the Fed hikes rates, capital flees Lagos, Accra, and Nairobi overnight. Backing reserves with tangible export commodities provides an intrinsic floor that speculators cannot short into oblivion.'
                ],
                [
                    'archetype' => 'Market Strategist',
                    'choice' => 'NO',
                    'note' => 'Commodity prices are notoriously volatile and pro-cyclical. If global oil or cocoa prices crash by 40%, your currency supply contracts automatically, triggering immediate domestic banking insolvency. You cannot settle pharmaceutical or jet fuel imports in raw lithium ore; global trade runs on liquid dollars.'
                ],
                [
                    'archetype' => 'Political Analyst',
                    'choice' => 'YES',
                    'note' => 'This is fundamentally a question of sovereign leverage. The current architecture leaves African treasuries perpetually begging for IMF bridge loans with conditionalities that crush local public services. A multi-sovereign commodity reserve pact forces foreign trading partners to transact on our terms.'
                ],
                [
                    'archetype' => 'Merchant Veteran',
                    'choice' => 'NO',
                    'note' => 'As traders who import goods every month, theory sounds sweet in air-conditioned conference halls, but market reality is brutal. If our banks cannot issue international letters of credit accepted in Shanghai and Dubai, port containers will sit stranded for months while demurrage charges bankrupt small businesses.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Development Economist',
                    'archetype' => 'Fiscal Analyst',
                    'content' => 'You are assuming fiscal discipline that history does not support. If politicians control a physical commodity board, within 18 months you will see forward-sale corruption and off-balance-sheet debt pledging the gold before it even leaves the ground.'
                ]
            ]
        ],
        [
            'title' => 'Should universities permanently ban generative AI tools in undergraduate coursework and examinations?',
            'description' => 'Academic boards are divided on whether AI code assistants and LLM essay generators undermine critical cognitive formation or represent essential workplace tools that students must master. Several faculties propose reverting to strictly handwritten examinations in proctored halls.',
            'category' => 'Education',
            'region' => 'Global',
            'tags' => ['Artificial Intelligence', 'Higher Education', 'EdTech', 'Examinations', 'Youth'],
            'perspectives' => [
                [
                    'archetype' => 'Educationist',
                    'choice' => 'YES',
                    'note' => 'When undergraduate students rely on automated synthesizers from year one, they bypass the painful but essential cognitive struggle of formulating a thesis, reconciling contradictory primary sources, and debugging logic. You cannot build intellectual muscle by having a machine lift the weights for you.'
                ],
                [
                    'archetype' => 'Tech Youth & Remote Freelancer',
                    'choice' => 'NO',
                    'note' => 'Banning AI in universities is like telling accounting majors in 1995 that using Microsoft Excel is cheating. In the global remote market, employers do not pay for typing speed; they pay for architectural clarity and rapid delivery. Teach students to audit AI outputs, not handicap them.'
                ],
                [
                    'archetype' => 'Historian',
                    'choice' => 'YES',
                    'note' => 'We saw this exact debate with the arrival of pocket calculators and search engines, but generative language models represent a fundamentally different rupture: the outsourcing of reasoning itself. If students cannot construct a 10-page historical argument unassisted, civil society loses its analytical cadre.'
                ],
                [
                    'archetype' => 'Student Leader',
                    'choice' => 'NO',
                    'note' => 'Handwritten 3-hour memorization marathons test stamina and penmanship, not actual mastery. If a student can prompt an AI to produce an A-grade essay, the problem is with the archaic assignment prompt, not the student leveraging 21st-century tools.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Educationist',
                    'archetype' => 'Systems Technologist',
                    'content' => 'Proctored handwritten exams do not stop students from using AI; they merely ensure students learn nothing about verifying hallucinations or security vulnerabilities before graduating into the workforce.'
                ]
            ]
        ],
        [
            'title' => 'Should national governments mandate verified biometric ID registration for all social media accounts to eliminate bots and disinformation?',
            'description' => 'In response to coordinated state-backed propaganda networks, hate speech, and automated bot swarms influencing elections, legislators are debating mandatory biometric verification for social media accounts. Digital rights advocates warn this will criminalize whistleblowers and silence political dissent.',
            'category' => 'Politics & Governance',
            'region' => 'West Africa',
            'tags' => ['Digital Privacy', 'Free Speech', 'Cybersecurity', 'Civil Rights', 'Elections'],
            'perspectives' => [
                [
                    'archetype' => 'Civil Liberties Advocate',
                    'choice' => 'NO',
                    'note' => 'Anonymity is not a crime; it is the single greatest shield protecting investigative whistleblowers, dissidents under authoritarian regimes, and marginalized citizens speaking truth to power. Handing state security agencies a master registry linking every tweet to a citizen\'s home address is an authoritarian blueprint.'
                ],
                [
                    'archetype' => 'Policy Auditor',
                    'choice' => 'YES',
                    'note' => 'The digital public square has been completely weaponized by paid bot factories and anonymous smear merchants who terrorize citizens and incite ethnic violence with total impunity. Rights without accountability lead directly to civic breakdown.'
                ],
                [
                    'archetype' => 'Investigative Journalist',
                    'choice' => 'NO',
                    'note' => 'Every single leak that exposed grand corruption in our ministries originated from anonymous digital tips. If our sources know their biometric ID is logged by telecom operators compliant with the executive branch, investigative journalism effectively dies overnight.'
                ],
                [
                    'archetype' => 'Legal & Constitutional Scholar',
                    'choice' => 'YES',
                    'note' => 'Freedom of speech has never included a constitutional right to algorithmic fraud or impersonation. If offline print publishers and broadcasters are legally liable for defamation and incitement, digital platform users cannot demand total blanket immunity while destroying reputations.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Policy Auditor',
                    'archetype' => 'Telecom Strategist',
                    'content' => 'Centralized biometric databases in emerging markets suffer constant security breaches. Within six months, that verified database will be sold on dark web forums for $10 in crypto.'
                ]
            ]
        ],
        [
            'title' => 'Should African cities ban commercial motorcycle and tricycle transit (Okada/Keke) from major arterial highways?',
            'description' => 'Megacity transport authorities argue that two-wheel and three-wheel commercial transit contributes disproportionately to fatal highway accidents, lane anarchy, and criminal escape corridors. Commuter unions counter that the formal mass transit network cannot handle even 30% of daily commuter demand.',
            'category' => 'Infrastructure',
            'region' => 'West Africa',
            'tags' => ['Urban Planning', 'Transportation', 'Labor', 'Megacities', 'Public Safety'],
            'perspectives' => [
                [
                    'archetype' => 'Urban Planner',
                    'choice' => 'YES',
                    'note' => 'High-speed multi-lane expressways and 100cc two-wheelers are physically incompatible. The trauma ward data from general hospitals is horrifying. Modern cities require structured Bus Rapid Transit (BRT) and light rail corridors, not informal highway free-for-alls.'
                ],
                [
                    'archetype' => 'Labor Advocate',
                    'choice' => 'NO',
                    'note' => 'Before you ban the poor man\'s bread, where is the alternative transport? Millions of working-class families rely on these operators to navigate unpaved interior roads and beat 4-hour highway standstills. A ban without functional public trains is economic sabotage of informal workers.'
                ],
                [
                    'archetype' => 'Frontline Medical Practitioner',
                    'choice' => 'YES',
                    'note' => 'Every weekend our surgical trauma unit admits young breadwinners with shattered femurs and catastrophic cranial trauma from highway collisions with articulated trucks. These are completely preventable tragedies that cost our healthcare system billions in unrecoverable emergency care.'
                ],
                [
                    'archetype' => 'Grassroots Community Leader',
                    'choice' => 'NO',
                    'note' => 'When civil servants make policies from air-conditioned offices, they forget that market women carrying heavy sacks of peppers have to wake up by 4:00 AM. Banning tricycles without adding hundreds of cheap government buses just forces our mothers to walk miles in the dark.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Urban Planner',
                    'archetype' => 'Supply Chain Specialist',
                    'content' => 'BRT systems take 5 to 8 years to finance and construct. What happens to the 400,000 daily commuters tomorrow morning when the highway police start seizing bikes?'
                ]
            ]
        ]
    ];
}

// Generate an Issue using Gemini API or Curated Templates
function generate_curated_debate($personas, $apiKey, $model = 'gemini-1.5-flash') {
    $fallbackTemplates = get_curated_fallback_debates();

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

        $prompt = "
You are an expert civic debate curator and political/economic editor for YesOrNo, a high-caliber public deliberation platform.
Create ONE provocative, time-bound civic/economic/tech/cultural binary debate issue (strictly YES or NO).

The question MUST have strong, defensible arguments on both sides. AVOID generic corporate AI phrasing, platitudes, or unopinionated middle-ground summaries.
Make the takes sharp, realistic, and written with genuine human conviction.

Select 4 distinct personas from the list below to write the primary perspectives (2 for YES, 2 for NO), and 1 persona to post a direct threaded rebuttal to one of the comments.

Personas available:
{$personaPromptText}

Output strict JSON with this exact schema:
{
  \"title\": \"Clear, high-stakes binary question (e.g. 'Should African governments mandate...?')\",
  \"description\": \"2-3 sentences of sharp context explaining why this debate is burning right now.\",
  \"category\": \"Economy & Finance | Politics & Governance | Technology & Internet | Education | Infrastructure | Health & Medicine\",
  \"region\": \"West Africa | East Africa | Southern Africa | Pan-African | Global\",
  \"tags\": [\"Tag1\", \"Tag2\", \"Tag3\", \"Tag4\"],
  \"perspectives\": [
    {
      \"personaId\": \"ID from list\",
      \"choice\": \"YES or NO\",
      \"note\": \"Authentic, opinionated perspective matching their role and tone guidelines (2 to 4 sentences).\"
    }
  ],
  \"rebuttals\": [
    {
      \"personaId\": \"ID of persona replying\",
      \"replyToPersonaId\": \"ID of persona being rebutted\",
      \"content\": \"Sharp, direct counter-argument challenging their premise.\"
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

    // Fallback: Pick a curated high-friction debate template
    $template = $fallbackTemplates[array_rand($fallbackTemplates)];
    
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

// Persist Curated Debate into SQLite Database
function persist_curated_debate(PDO $pdo, $personas, $debateData, $settings) {
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

    // Choose Author Persona
    $authorPersona = $personas[array_rand($personas)];

    // Insert Issue
    $stmtIssue = $pdo->prepare("
        INSERT INTO issues (
            id, title, description, category, region, tags,
            author, creator_id, creator_email, is_anonymous_author,
            closing_date, duration_label, visibility,
            yes_count, no_count, likes_count, favorites_count,
            featured, created_at, updated_at
        ) VALUES (
            :id, :title, :description, :category, :region, :tags,
            :author, :creator_id, :creator_email, 0,
            NULL, 'Indefinite (Open Community Deliberation)', 'public',
            :yes_count, :no_count, :likes_count, :favorites_count,
            1, :created_at, :updated_at
        )
    ");

    $stmtIssue->execute([
        ':id' => $issueId,
        ':title' => $debateData['title'],
        ':description' => $debateData['description'],
        ':category' => $debateData['category'] ?? 'Politics & Governance',
        ':region' => $debateData['region'] ?? 'West Africa',
        ':tags' => json_encode($debateData['tags'] ?? ['Deliberation', 'Civic']),
        ':author' => $authorPersona['name'],
        ':creator_id' => $authorPersona['id'],
        ':creator_email' => $authorPersona['email'],
        ':yes_count' => $yesCount,
        ':no_count' => $noCount,
        ':likes_count' => $likesCount,
        ':favorites_count' => $favCount,
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
// Router / Action Handlers
// -------------------------------------------------------------
$settings = get_curator_settings($settingsPath);
$personas = load_seed_personas($personasPath);
$pdo = get_curator_pdo($dbPath);

$action = isset($_GET['action']) ? trim($_GET['action']) : (isset($_POST['action']) ? trim($_POST['action']) : '');
$isCron = isset($_GET['cron']) && ($_GET['cron'] === '1' || $_GET['cron'] === 'true');

// Support GET ?action=status
if ($action === 'status' || ($_SERVER['REQUEST_METHOD'] === 'GET' && !$isCron && empty($action))) {
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

    // Generate debate
    $result = generate_curated_debate($personas, $settings['geminiApiKey'] ?? '', $settings['model'] ?? 'gemini-1.5-flash');
    $persisted = persist_curated_debate($pdo, $personas, $result['data'], $settings);

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

    echo json_encode([
        'success' => true,
        'engine' => $result['source'],
        'issue' => $persisted,
        'lastRunAt' => $nowIso,
        'message' => "Successfully generated and published: \"{$persisted['title']}\" with {$persisted['totalVotes']} initial votes."
    ]);
    exit;
}

// Unknown action fallback
echo json_encode([
    'success' => false,
    'error' => 'Unknown action requested',
    'availableActions' => ['status', 'toggle', 'save_settings', 'seed_users', 'generate_issue']
]);
