<?php
/**
 * YesOrNo - Dynamic Crawler Pre-Renderer & Social OpenGraph Router
 * 
 * Provides:
 * 1. Deep SQLite Issue Resolution (Title, Category, Region, Author, Description, Votes, Comments)
 * 2. Dynamic OpenGraph / Twitter Cards for social crawlers (X, WhatsApp, Telegram, LinkedIn, Facebook)
 * 3. Schema.org JSON-LD (Question, Answer, and DiscussionForumPosting) for Google Rich Snippets
 * 4. Semantic Pre-rendered HTML inside <div id="root"> so search crawlers (Googlebot, Bingbot)
 *    index 100% of the question text and arguments without waiting for client-side JavaScript.
 */

$indexFile = __DIR__ . '/index.html';
if (!file_exists($indexFile)) {
    $indexFile = __DIR__ . '/../index.html';
}
if (!file_exists($indexFile)) {
    http_response_code(404);
    exit('index.html not found');
}

$html = file_get_contents($indexFile);

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'yesorno.chillon.top';
$baseUrl = $protocol . '://' . $host;

$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$parsedUrl = parse_url($requestUri);
$path = isset($parsedUrl['path']) ? trim($parsedUrl['path'], '/') : '';

function build_issue_slug_router($title, $id) {
    $slug = strtolower($title);
    $slug = preg_replace('/[^a-z0-9]+/i', '-', $slug);
    $slug = trim($slug, '-');
    $slug = substr($slug, 0, 70);
    $slug = rtrim($slug, '-');
    return $slug ? $slug . '-' . $id : $id;
}

// 1. Identify Target Issue ID
$targetIssueId = null;
if (!empty($_GET['issue'])) {
    $targetIssueId = trim($_GET['issue']);
} else if ($path !== '' && $path !== 'index.html' && $path !== 'og-router.php') {
    // Matches e.g. "should-remote-workers-pay-more-issue-6cde3e06f68d" or "issue-6cde3e06f68d"
    if (preg_match('/(issue-[a-zA-Z0-9_-]+)$/', $path, $matches)) {
        $targetIssueId = $matches[1];
    }
}

// 2. Query SQLite for issue details
$issue = null;
$responses = [];
$dataDir = __DIR__ . '/data';
$dbPath = $dataDir . '/yesorno.sqlite';

if (file_exists($dbPath)) {
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_SILENT);

        if ($targetIssueId) {
            $stmt = $pdo->prepare("
                SELECT id, title, description, category, region, tags, author, creator_email,
                       yes_count, no_count, likes_count, created_at, updated_at
                FROM issues 
                WHERE id = :id AND is_deleted = 0
                LIMIT 1
            ");
            $stmt->execute([':id' => $targetIssueId]);
            $issue = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // If not found by ID, attempt lookup by matching slug
        if (!$issue && $path !== '' && $path !== 'index.html') {
            $allStmt = $pdo->query("
                SELECT id, title, description, category, region, tags, author, creator_email,
                       yes_count, no_count, likes_count, created_at, updated_at
                FROM issues
                WHERE is_deleted = 0
                LIMIT 200
            ");
            while ($row = $allStmt->fetch(PDO::FETCH_ASSOC)) {
                if (build_issue_slug_router($row['title'], $row['id']) === $path) {
                    $issue = $row;
                    $targetIssueId = $row['id'];
                    break;
                }
            }
        }

        // Fetch top responses/perspectives for this issue to give crawlers rich textual body content
        if ($issue && $targetIssueId) {
            $respStmt = $pdo->prepare("
                SELECT choice, author_name, note, likes_count, created_at
                FROM responses
                WHERE issue_id = :iid AND is_reported = 0 AND note IS NOT NULL AND TRIM(note) != ''
                ORDER BY likes_count DESC, created_at ASC
                LIMIT 8
            ");
            $respStmt->execute([':iid' => $targetIssueId]);
            $responses = $respStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    } catch (Exception $e) {
        $issue = null;
    }
}

// 3. Fallback or Derived Metadata if no DB record found
$titleParam = isset($_GET['q']) ? trim($_GET['q']) : '';
$descParam = isset($_GET['d']) ? trim($_GET['d']) : '';

if (!$issue && $titleParam === '' && $path !== '' && $path !== 'index.html') {
    $cleanSlug = preg_replace('/-issue-[a-zA-Z0-9_-]+$/', '', $path);
    if ($cleanSlug && $cleanSlug !== $path) {
        $words = str_replace('-', ' ', $cleanSlug);
        $titleParam = ucfirst(trim($words)) . '?';
    }
}

$pageTitle = 'YesOrNo | Vote YES or NO on Issues That Matter to You';
$pageDesc = 'It takes less than 1 min to make your voice heard and make an impact. Vote YES or NO on family, workplace, communal, religious, group, and policy decisions.';
$canonicalUrl = $baseUrl . '/' . $path;
$imageUrl = $baseUrl . '/og-image.png';
$jsonLd = '';
$preRenderedBody = '';

if ($issue) {
    $rawTitle = $issue['title'];
    $pageTitle = $rawTitle . ' | YesOrNo';
    $calcYes = (int)$issue['yes_count'];
    $calcNo = (int)$issue['no_count'];
    $totalVotes = $calcYes + $calcNo;
    $yesPct = $totalVotes > 0 ? (int)round(($calcYes / $totalVotes) * 100) : 50;
    $noPct = 100 - $yesPct;

    $category = $issue['category'] ?: 'Civic & Community';
    $region = $issue['region'] ?: 'Africa & Middle East';
    $author = $issue['author'] ?: 'Civic Member';
    $createdAt = $issue['created_at'] ?: date('c');
    $formattedDate = date('M j, Y', strtotime($createdAt));

    $rawDesc = !empty($issue['description']) ? trim($issue['description']) : "Vote YES ({$yesPct}%) or NO ({$noPct}%) on \"{$rawTitle}\" on YesOrNo.";
    $pageDesc = strlen($rawDesc) > 165 ? substr($rawDesc, 0, 162) . '...' : $rawDesc;
    $canonicalUrl = $baseUrl . '/' . build_issue_slug_router($issue['title'], $issue['id']);

    $safeTitle = htmlspecialchars($rawTitle, ENT_QUOTES, 'UTF-8');
    $safeDesc = htmlspecialchars($pageDesc, ENT_QUOTES, 'UTF-8');
    $safeCategory = htmlspecialchars($category, ENT_QUOTES, 'UTF-8');
    $safeRegion = htmlspecialchars($region, ENT_QUOTES, 'UTF-8');
    $safeAuthor = htmlspecialchars($author, ENT_QUOTES, 'UTF-8');

    // Schema.org Structured Data (JSON-LD) for Google Rich Results (Q&A / Poll / Discussion)
    $jsonLdData = [
        '@context' => 'https://schema.org',
        '@graph' => [
            [
                '@type' => 'Question',
                '@id' => $canonicalUrl . '#question',
                'name' => $rawTitle,
                'text' => $rawDesc,
                'dateCreated' => $createdAt,
                'author' => [
                    '@type' => 'Person',
                    'name' => $author
                ],
                'answerCount' => 2,
                'suggestedAnswer' => [
                    [
                        '@type' => 'Answer',
                        'text' => 'YES',
                        'upvoteCount' => $calcYes,
                        'url' => $canonicalUrl
                    ],
                    [
                        '@type' => 'Answer',
                        'text' => 'NO',
                        'upvoteCount' => $calcNo,
                        'url' => $canonicalUrl
                    ]
                ]
            ],
            [
                '@type' => 'DiscussionForumPosting',
                '@id' => $canonicalUrl . '#discussion',
                'headline' => $rawTitle,
                'articleBody' => $rawDesc,
                'datePublished' => $createdAt,
                'author' => [
                    '@type' => 'Person',
                    'name' => $author
                ],
                'interactionStatistic' => [
                    [
                        '@type' => 'InteractionCounter',
                        'interactionType' => 'https://schema.org/CommentAction',
                        'userInteractionCount' => count($responses)
                    ]
                ]
            ]
        ]
    ];
    $jsonLd = '<script type="application/ld+json">' . json_encode($jsonLdData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';

    // Build Crawler-Accessible Pre-rendered Semantic HTML inside <div id="root">
    $responsesHtml = '';
    foreach ($responses as $resp) {
        $rChoice = htmlspecialchars($resp['choice'], ENT_QUOTES, 'UTF-8');
        $rAuthor = htmlspecialchars($resp['author_name'] ?: 'Member', ENT_QUOTES, 'UTF-8');
        $rNote = htmlspecialchars($resp['note'], ENT_QUOTES, 'UTF-8');
        $rColor = $resp['choice'] === 'YES' ? '#059669' : '#e11d48';

        $responsesHtml .= "
        <div style=\"margin-bottom: 16px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;\">
          <div style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;\">
            <span style=\"font-weight: 700; font-size: 13px;\">{$rAuthor}</span>
            <span style=\"font-weight: 800; font-size: 11px; color: {$rColor}; text-transform: uppercase;\">Voted {$rChoice}</span>
          </div>
          <p style=\"margin: 0; font-size: 14px; color: #334155; line-height: 1.5;\">{$rNote}</p>
        </div>";
    }

    $preRenderedBody = "
      <article id=\"ssr-content\" style=\"max-width: 680px; margin: 40px auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">
        <header style=\"margin-bottom: 20px;\">
          <div style=\"font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; margin-bottom: 8px;\">{$safeCategory} • {$safeRegion}</div>
          <h1 style=\"font-size: 24px; font-weight: 800; line-height: 1.3; color: #0f172a; margin: 0 0 12px 0;\">{$safeTitle}</h1>
          <p style=\"font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 10px 0;\">{$safeDesc}</p>
          <div style=\"font-size: 12px; color: #64748b;\">Deliberation posted by <strong>{$safeAuthor}</strong> • {$formattedDate}</div>
        </header>

        <section style=\"margin: 20px 0; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;\">
          <h2 style=\"font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 0 0 10px 0;\">Public Consensus Standings ({$totalVotes} votes)</h2>
          <div style=\"display: flex; gap: 16px; font-weight: 700; font-size: 15px;\">
            <span style=\"color: #059669;\">YES {$yesPct}% ({$calcYes} votes)</span>
            <span style=\"color: #cbd5e1;\">|</span>
            <span style=\"color: #e11d48;\">NO {$noPct}% ({$calcNo} votes)</span>
          </div>
        </section>

        " . (!empty($responsesHtml) ? "
        <section style=\"margin-top: 24px;\">
          <h2 style=\"font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px;\">Verified Community Perspectives</h2>
          {$responsesHtml}
        </section>" : "") . "
      </article>
    ";
} else if ($titleParam !== '') {
    $pageTitle = htmlspecialchars($titleParam, ENT_QUOTES, 'UTF-8') . ' | YesOrNo';
    $pageDesc = htmlspecialchars(
        $descParam !== '' ? $descParam : 'Vote YES or NO on "' . $titleParam . '" on YesOrNo.',
        ENT_QUOTES,
        'UTF-8'
    );
}

// 4. Inject metadata into HTML
$safePageTitle = htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8');
$safePageDesc = htmlspecialchars($pageDesc, ENT_QUOTES, 'UTF-8');
$safeCanonical = htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8');
$safeImage = htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8');

// Title tags
$html = preg_replace('/<title>.*?<\/title>/is', '<title>' . $safePageTitle . '</title>', $html);
$html = preg_replace('/<meta\s+name="title"\s+content=".*?"\s*\/?>/i', '<meta name="title" content="' . $safePageTitle . '" />', $html);
$html = preg_replace('/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i', '<meta property="og:title" content="' . $safePageTitle . '" />', $html);
$html = preg_replace('/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i', '<meta name="twitter:title" content="' . $safePageTitle . '" />', $html);

// Description tags
$html = preg_replace('/<meta\s+name="description"\s+content=".*?"\s*\/?>/i', '<meta name="description" content="' . $safePageDesc . '" />', $html);
$html = preg_replace('/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i', '<meta property="og:description" content="' . $safePageDesc . '" />', $html);
$html = preg_replace('/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i', '<meta name="twitter:description" content="' . $safePageDesc . '" />', $html);

// Canonical & URL tags
$html = preg_replace('/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i', '<meta property="og:url" content="' . $safeCanonical . '" />', $html);

// Images
$html = preg_replace('/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i', '<meta property="og:image" content="' . $safeImage . '" />', $html);
$html = preg_replace('/<meta\s+property="og:image:secure_url"\s+content=".*?"\s*\/?>/i', '<meta property="og:image:secure_url" content="' . $safeImage . '" />', $html);
$html = preg_replace('/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i', '<meta name="twitter:image" content="' . $safeImage . '" />', $html);

// Inject canonical link and JSON-LD structured data right before </head>
$headInjections = "\n    <link rel=\"canonical\" href=\"{$safeCanonical}\" />\n";
if (!empty($jsonLd)) {
    $headInjections .= "    {$jsonLd}\n";
}
$html = str_replace('</head>', $headInjections . '  </head>', $html);

// Inject Pre-rendered Semantic HTML inside <div id="root"> for crawlers
if (!empty($preRenderedBody)) {
    $html = str_replace('<div id="root"></div>', '<div id="root">' . $preRenderedBody . '</div>', $html);
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: public, max-age=300, s-maxage=600'); // Short cache for dynamic updates
echo $html;
