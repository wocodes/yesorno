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

// Call Gemini API with Google Search Grounding for Live News & Trend Research
function call_gemini_with_search($prompt, $apiKey, $model = 'gemini-1.5-flash') {
    if (empty($apiKey)) return null;

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

    // Primary attempt: Gemini with Google Search tool enabled
    $payloadWithSearch = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 35);
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

    // Secondary fallback: Gemini standard generation without search tool
    $payloadStandard = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.8,
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

    return null;
}

// Curated Context-Aware Trend Fallbacks with Dynamic Angle Cycling & Deduplication
function get_trend_fallback_suggestions($context = '', $category = '', $excludeTitles = [], $cycle = 1) {
    $contextLower = strtolower($context);

    // 1. Context matches Lagos / Governorship / State Governance / Elections
    if (strpos($contextLower, 'lagos') !== false || strpos($contextLower, 'governor') !== false || strpos($contextLower, 'debate') !== false || strpos($contextLower, 'election') !== false) {
        $pool = [
            [
                'title' => 'Should Lagos State hold binding citizen referendums before implementing any new highway or bridge tolling?',
                'description' => 'Commuter unions and civic activists argue that arbitrary toll hikes on captive daily transit corridors impose unreasonable economic burdens on working citizens. Urban infrastructure planners maintain that private concession tolls are the only sustainable mechanism to fund major expressways without draining state revenue.',
                'category' => 'Politics & Policy',
                'tags' => ['LagosGovernance', 'TollGates', 'GovernorshipDebate', 'CommuterRights', 'PublicInfrastructure'],
                'trendContext' => 'Grounded in public debates from the Lagos gubernatorial town hall over commuter tolls, concession transparency, and state transport funding.'
            ],
            [
                'title' => 'Should state governors have direct constitutional command over state police forces rather than federal commissioners?',
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

// Generate Trend Questions using Gemini + Live Google Search Grounding
function generate_trend_question_suggestions($context = '', $category = '', $region = 'Africa & Middle East', $apiKey = '', $model = 'gemini-1.5-flash', $excludeTitles = [], $cycle = 1) {
    $context = trim($context);
    $category = trim($category);

    if (!empty($apiKey)) {
        $excludePrompt = '';
        if (!empty($excludeTitles) && is_array($excludeTitles)) {
            $excludePrompt = "\nIMPORTANT DIVERSITY RULE: Provide COMPLETELY FRESH, alternative debate angles. DO NOT repeat, duplicate, or closely rephrase any of these previous questions:\n"
                . implode("\n", array_map(function($t) { return "- \"{$t}\""; }, $excludeTitles))
                . "\nExplore contrasting sub-topics, different affected stakeholders, or unexpected policy/ethical angles.\n";
        }

        $prompt = "You are an elite investigative journalist, viral poll designer, and civic debate moderator for YesOrNo (a public deliberation platform).\n"
            . "Generation Cycle: #{$cycle}\n\n"
            . "Task:\n"
            . (!empty($context) 
                ? "Research and ground your questions in the latest real-time trends, news stories, and public debates regarding: \"{$context}\".\n"
                : "Research the top trending news stories, viral civic discussions, policy disputes, and cultural dilemmas in Nigeria, Africa, and global tech/politics today.\n")
            . (!empty($category) ? "Target Category: {$category}\n" : "")
            . "Target Region: {$region}\n"
            . $excludePrompt . "\n"
            . "Identify the core point of controversy, tension, or policy dilemma where thoughtful citizens, experts, and community members are divided roughly 50/50.\n\n"
            . "Generate 2 to 3 distinct polarizing YES/NO debate question suggestions based on these current trends and facts.\n\n"
            . "For each suggestion, provide:\n"
            . "1. \"title\": A sharp, provocative, culturally authentic YES/NO question (under 16 words) starting with 'Should...', 'Is it wrong to...', 'Would you...', or 'Must...'. It must end with a single '?'.\n"
            . "2. \"description\": 2 to 3 punchy sentences explaining the core dilemma:\n"
            . "   - Sentence 1: Why the YES camp passionately defends their position with real-world arguments.\n"
            . "   - Sentence 2: Why the NO camp firmly objects or warns of negative fallout.\n"
            . "   - Sentence 3: The broader stakes for the community, economy, or citizens.\n"
            . "3. \"category\": Best fitting category from: ['Politics & Policy', 'Economy & Finance', 'Workplace & Career', 'Business', 'Environment & Climate', 'Education & Campus', 'Community & Neighborhood', 'Family & Home', 'Entertainment', 'Counselling', 'Gender', 'Religious & Faith'].\n"
            . "4. \"tags\": 3 to 5 relevant hashtags or keywords (e.g. ['LagosState', 'Tolls', 'CommuterRights']).\n"
            . "5. \"trendContext\": A 1-2 sentence summary of the recent news, event, or trend that sparked this debate.\n\n"
            . "Return pure JSON matching this exact structure:\n"
            . "[\n"
            . "  {\n"
            . "    \"title\": \"...\",\n"
            . "    \"description\": \"...\",\n"
            . "    \"category\": \"...\",\n"
            . "    \"tags\": [\"...\"],\n"
            . "    \"trendContext\": \"...\"\n"
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
                'suggestions' => $suggestions
            ];
        }
    }

    // Dynamic Curated Context Fallback with angle cycling and deduplication
    $fallbackList = get_trend_fallback_suggestions($context, $category, $excludeTitles, $cycle);
    return [
        'success' => true,
        'source' => 'curated_trend_engine',
        'grounded' => false,
        'context' => $context,
        'cycle' => $cycle,
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
                    'note' => 'If someone is living in the country, using local infrastructure, buying goods in local markets, and benefiting from domestic security, they have to pay their fair share. Civil servants earning modest salaries have PAYE deducted at source every month. Tax equity has to apply across the board.'
                ],
                [
                    'archetype' => 'Tech Youth & Freelancer',
                    'choice' => 'NO',
                    'note' => 'We buy our own solar inverters, fuel our own generators, pay for private Starlink internet, and use private healthcare because public services are non-existent. The foreign exchange we bring in directly helps the local economy when we spend it. Taxing us extra for working hard remotely makes zero sense.'
                ],
                [
                    'archetype' => 'Economist',
                    'choice' => 'NO',
                    'note' => 'Targeting remote knowledge workers is counter-productive. In a country struggling with dollar liquidity and brain drain, you want to incentivize skilled talent to stay inside the country and spend their foreign currency locally, not push them to relocate to Rwanda or the UK.'
                ],
                [
                    'archetype' => 'Policy Insider',
                    'choice' => 'YES',
                    'note' => 'Nobody is saying tax people to death, but having a massive informal dollar economy that files zero returns while roads and hospitals decay is unsustainable. There has to be a simple, flat presumptive tax that brings remote earners into the tax net properly.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Tech Youth & Freelancer',
                    'archetype' => 'Labor Advocate',
                    'content' => 'Everyone buys generator fuel and pays for private clinics, including junior factory workers. The solution to poor public services is demanding accountability from politicians, not having higher earners opt out of taxes completely.'
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
                    'note' => 'Starting married life with an empty bank account or wedding debts just to feed 400 people party jollof rice is pure financial self-sabotage. That same ₦3M could pay for two years of house rent or serve as an emergency fund when the first baby arrives.'
                ],
                [
                    'archetype' => 'Hospitality & Small Business',
                    'choice' => 'NO',
                    'note' => 'Weddings are cultural milestones that bring extended families together and create lifelong memories. You only do it once. Money spent wisely on celebrating with parents, elders, and friends has emotional and social value that spreadsheets cannot capture.'
                ],
                [
                    'archetype' => 'Sociologist',
                    'choice' => 'NO',
                    'note' => 'In our culture, a wedding is not an individual affair; it is a community celebration that connects two families and builds social safety nets. The problem is not the ceremony itself, but peer pressure and ostentatious competition on social media.'
                ],
                [
                    'archetype' => 'Student Leader',
                    'choice' => 'YES',
                    'note' => 'Let us be honest with ourselves: half the people at big weddings are there for free food and souvenirs. Those same guests will not send you ₦10,000 when rent is due next year. Keep it small, sign court papers, and protect your peace.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Hospitality & Small Business',
                    'archetype' => 'Artisan & Business Owner',
                    'content' => 'Celebration is good, but when young couples start marriage taking high-interest loans for hall rentals and aso-ebi, the stress breaks marriages before the first anniversary. Wisdom comes before party.'
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
                    'note' => 'Every single weekend, emergency wards admit young people with shattered limbs and severe head injuries from highway collisions with trucks. 100cc motorbikes and heavy articulated trailers physically do not belong on the same high-speed lanes.'
                ],
                [
                    'archetype' => 'Labor Advocate',
                    'choice' => 'NO',
                    'note' => 'Before government bans Okada on expressways, where are the alternative buses? Millions of commuters wake up before dawn every day. If you ban them without functional trains or cheap public buses, you are just punishing ordinary working-class citizens.'
                ],
                [
                    'archetype' => 'Urban Planner',
                    'choice' => 'YES',
                    'note' => 'Expressways are designed for rapid multi-lane throughput. When motorbikes weave between lanes and drive against traffic, the entire corridor slows down and accident rates spike. We need dedicated bus rapid transit lanes, not informal highway chaos.'
                ],
                [
                    'archetype' => 'Grassroots Trader',
                    'choice' => 'NO',
                    'note' => 'Market women carrying heavy loads of goods depend on Keke to get to markets early. When bans happen, police start seizing vehicles and taking bribes, while transport fares double for everyday passengers. It hurts the poor the most.'
                ]
            ],
            'rebuttals' => [
                [
                    'replyToArchetype' => 'Urban Planner',
                    'archetype' => 'Logistics Operator',
                    'content' => 'High-capacity buses sound nice on paper, but who will finance the 2,000 new buses needed by tomorrow morning? Banning transport options before building alternatives always fails.'
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
You are an expert community debate curator for YesOrNo, a fast-paced public voting and deliberation app.
Create ONE provocative, time-bound binary question (strictly YES or NO).

PROVOCATION & SPICE INSTRUCTIONS:
- Alternately generate EITHER:
  1. A fiery, confidently annoying, rage-baiting social/lifestyle hot-take (dating standards, hustle-culture snobbery, remote work privilege, wedding budgets, sleep guilt, money etiquette).
  2. A high-friction civic or economic friction question (taxes, transport bans, currency pegging, AI bans).
- Use an authentic, natural, semi-formal to informal conversational tone. Think like sharp, opinionated Nigerians arguing passionately on X / Twitter, WhatsApp group chats, or a Lagos cafe.
- Takes must have CONFIDENT ARROGANCE on one side and FURIOUS, STREET-SMART INDIGNATION on the other side.
- Make users itch to tap NO or YES out of pure conviction or outrage!
- NEVER use formal titles (No 'Dr.', 'Prof.', 'Chief', etc.). Use strictly first and last names.
- Avoid robotic corporate AI phrasing (no 'In conclusion', 'It is important to remember', 'On the other hand').
- The takes should be punchy, relatable, and opinionated (2 to 4 sentences).
- Ground arguments in tangible everyday realities: inflation, house rent, fuel costs, remote work, school fees, power, traffic, relationships, or business.

Select 4 distinct personas from the list below to write the primary perspectives (2 for YES, 2 for NO), and 1 persona to post a direct threaded rebuttal to one of the comments.

Personas available:
{$personaPromptText}

Output strict JSON with this exact schema:
{
  \"title\": \"Clear, high-stakes binary question (e.g. 'Should remote workers earning in USD pay higher local taxes?')\",
  \"description\": \"2-3 sentences of sharp context explaining why this debate is burning right now.\",
  \"category\": \"Economy & Finance | Politics & Governance | Technology & Internet | Education | Infrastructure | Health & Medicine | Family & Home\",
  \"region\": \"Africa & Middle East\",
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
        ':region' => $debateData['region'] ?? 'Africa & Middle East',
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
    if (empty($recipientEmail) || !filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) return false;
    
    $payload = [
        'event' => 'author_comment',
        'user' => [
            'name' => $persona['name'],
            'email' => $persona['email'],
            'role' => $persona['role']
        ],
        'data' => [
            'recipientEmail' => $recipientEmail,
            'issueTitle' => $issueTitle,
            'choice' => $choice,
            'note' => $note,
            'url' => 'https://yesorno.chillon.top/' . $issueSlug
        ]
    ];

    $ch = curl_init('https://yesorno.chillon.top/notify.php');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 4);
    @curl_exec($ch);
    @curl_close($ch);
    return true;
}

function generate_incubated_perspective($issue, $persona, $choice, $apiKey = '', $model = 'gemini-1.5-flash') {
    if (!empty($apiKey)) {
        $prompt = "You are {$persona['name']}, a {$persona['role']}. Bio: {$persona['bio']}.\n"
            . "Provide a realistic, concise 2 to 3 sentence community perspective (maximum 50 words) on this deliberation question:\n"
            . "Question: \"{$issue['title']}\"\n"
            . "Context: \"{$issue['description']}\"\n"
            . "Your stance: {$choice} (You must clearly support this viewpoint).\n\n"
            . "Guidelines:\n"
            . "- Speak conversationally as a real person living in {$persona['region']}.\n"
            . "- Never say 'As an AI' or 'As a {$persona['role']}'.\n"
            . "- Give a crisp, practical argument.\n"
            . "Return pure JSON: {\"note\": \"...\"}";

        $res = call_gemini_api($prompt, $apiKey, $model);
        if ($res && !empty($res['note'])) {
            return trim($res['note']);
        }
    }

    // Dynamic Curated Fallbacks
    $yesTemplates = [
        "From a practical standpoint, this is long overdue. When you look at the ripple effects on local productivity and accountability, the potential upside clearly outweighs the initial friction.",
        "I lean Yes on this. We've seen similar frameworks succeed when clear guardrails are put in place from day one. It's about setting the standard early rather than reacting later.",
        "Support this direction. The current status quo simply isn't sustainable for the broader public interest. Taking decisive action now saves us bigger headaches down the road.",
        "Agree with this move. Transparent standards and predictable execution are what build lasting community confidence. It's definitely time to test it in practice.",
        "This makes strategic sense. If we delay addressing this, the systemic cost of inaction will multiply. A measured rollout is the right call."
    ];

    $noTemplates = [
        "I'm skeptical of this approach. While the intention might be sound, the operational overhead and unintended bottlenecks could end up hurting the very people it aims to help.",
        "Vote No. Before introducing blanket measures like this, we need far stronger data and consultation. Rushing this without robust infrastructure will create more problems than it solves.",
        "Respectfully disagree with the proposal. The core issue isn't lack of new rules, but inconsistent enforcement of existing structures. Let's fix the fundamentals first.",
        "Not convinced this is the right priority right now. In practice, similar initiatives have ended up concentrating friction rather than opening up opportunity. Better to hold off.",
        "I have reservations. Without clearer accountability and funding mechanisms, this risks becoming another well-intentioned policy that stalls out in execution."
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

    // Also run incremental incubation on any waiting user debates during cron run
    $incubatedDebates = incubate_user_debates($pdo, $personas, $settings);

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
