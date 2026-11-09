<?php
/**
 * YesOrNo - Dynamic XML Sitemap Generator for Web Crawlers (Googlebot, Bingbot, etc.)
 * Serves real-time XML sitemap of all public issues and debates directly from SQLite.
 */

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=1800, s-maxage=3600'); // Cache for 30 mins

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'yesorno.chillon.top';
$baseUrl = $protocol . '://' . $host;

$dataDir = __DIR__ . '/data';
$dbPath = $dataDir . '/yesorno.sqlite';

$issues = [];
if (file_exists($dbPath)) {
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_SILENT);
        $stmt = $pdo->query("
            SELECT id, title, created_at, updated_at 
            FROM issues 
            WHERE is_deleted = 0 AND visibility = 'public' 
            ORDER BY created_at DESC 
            LIMIT 5000
        ");
        if ($stmt) {
            $issues = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
    } catch (Exception $e) {
        $issues = [];
    }
}

function build_issue_slug_xml($title, $id) {
    $slug = strtolower($title);
    $slug = preg_replace('/[^a-z0-9]+/i', '-', $slug);
    $slug = trim($slug, '-');
    $slug = substr($slug, 0, 70);
    $slug = rtrim($slug, '-');
    return $slug ? $slug . '-' . $id : $id;
}

function format_iso8601($dateStr) {
    if (empty($dateStr)) return date('c');
    $time = strtotime($dateStr);
    return $time ? date('c', $time) : date('c');
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <!-- Core Static Views -->
  <url>
    <loc><?= htmlspecialchars($baseUrl . '/', ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= date('c') ?></lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc><?= htmlspecialchars($baseUrl . '/discovery', ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= date('c') ?></lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc><?= htmlspecialchars($baseUrl . '/trending', ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= date('c') ?></lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Dynamic Issue Topics -->
<?php foreach ($issues as $iss): ?>
  <?php
    $slug = build_issue_slug_xml($iss['title'], $iss['id']);
    $loc = $baseUrl . '/' . $slug;
    $mod = format_iso8601($iss['updated_at'] ?: $iss['created_at']);
  ?>
  <url>
    <loc><?= htmlspecialchars($loc, ENT_XML1, 'UTF-8') ?></loc>
    <lastmod><?= $mod ?></lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
<?php endforeach; ?>
</urlset>
