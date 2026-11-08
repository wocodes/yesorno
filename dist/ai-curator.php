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

// Curated Fallback Debate Templates (Natural Nigerian Context, Semi-Formal/Informal Tone)
function get_curated_fallback_debates() {
    return [
        [
            'title' => 'Should remote workers earning in foreign currency (USD/GBP) pay higher domestic income taxes?',
            'description' => 'With the rise of international remote tech workers and freelancers earning in strong currencies amidst local currency volatility, some argue for a specialized progressive tax bracket. Tech professionals argue they already provide their own power, internet, and security.',
            'category' => 'Economy & Finance',
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
            'region' => 'West Africa',
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
  \"region\": \"West Africa\",
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
