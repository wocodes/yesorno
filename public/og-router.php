<?php
/**
 * Dynamic OpenGraph / WhatsApp / Social Preview Router for YesOrNo SPA
 * Serves index.html with issue-specific <title>, og:title, and og:description
 * when a shared issue URL is requested (e.g. /{slug-of-the-issue-question}-{id-of-the-issue}).
 */
$indexFile = __DIR__ . '/index.html';
if (!file_exists($indexFile)) {
  http_response_code(404);
  exit('Not found');
}

$html = file_get_contents($indexFile);

$requestUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$parsedUrl = parse_url($requestUri);
$path = isset($parsedUrl['path']) ? trim($parsedUrl['path'], '/') : '';

// Extract query params (?q= and ?d=) if passed, or derive the issue question directly from the URL slug
$titleParam = isset($_GET['q']) ? trim($_GET['q']) : '';
$descParam = isset($_GET['d']) ? trim($_GET['d']) : '';

if ($titleParam === '' && $path !== '' && $path !== 'index.html' && $path !== 'og-router.php') {
  // Strip trailing -issue-<timestamp> or -issue-<num> to reconstruct the human-readable question from the slug
  $cleanSlug = preg_replace('/-issue-[a-zA-Z0-9-]+$/', '', $path);
  if ($cleanSlug && $cleanSlug !== $path) {
    $words = str_replace('-', ' ', $cleanSlug);
    $titleParam = ucfirst(trim($words)) . '?';
  }
}

if ($titleParam !== '') {
  $safeTitle = htmlspecialchars($titleParam, ENT_QUOTES, 'UTF-8');
  $safeDesc = htmlspecialchars(
    $descParam !== ''
      ? $descParam
      : 'Vote YES or NO on "' . $titleParam . '" on YesOrNo.',
    ENT_QUOTES,
    'UTF-8'
  );
  $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'yesorno.chillon.top';
  $canonicalUrl = htmlspecialchars($protocol . '://' . $host . '/' . $path, ENT_QUOTES, 'UTF-8');

  // Replace default <title>, meta title, og:title, twitter:title
  $html = preg_replace(
    '/<title>.*?<\/title>/is',
    '<title>' . $safeTitle . ' | YesOrNo</title>',
    $html
  );
  $html = preg_replace(
    '/<meta\s+name="title"\s+content=".*?"\s*\/?>/i',
    '<meta name="title" content="' . $safeTitle . '" />',
    $html
  );
  $html = preg_replace(
    '/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i',
    '<meta property="og:title" content="' . $safeTitle . '" />',
    $html
  );
  $html = preg_replace(
    '/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i',
    '<meta name="twitter:title" content="' . $safeTitle . '" />',
    $html
  );

  // Replace default meta description, og:description, twitter:description
  $html = preg_replace(
    '/<meta\s+name="description"\s+content=".*?"\s*\/?>/i',
    '<meta name="description" content="' . $safeDesc . '" />',
    $html
  );
  $html = preg_replace(
    '/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i',
    '<meta property="og:description" content="' . $safeDesc . '" />',
    $html
  );
  $html = preg_replace(
    '/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i',
    '<meta name="twitter:description" content="' . $safeDesc . '" />',
    $html
  );

  // Replace og:url
  $html = preg_replace(
    '/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i',
    '<meta property="og:url" content="' . $canonicalUrl . '" />',
    $html
  );
}

header('Content-Type: text/html; charset=UTF-8');
echo $html;

