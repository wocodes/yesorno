<?php
/**
 * YesOrNo - Admin Real-Time Event Notification Dispatcher
 * Sends instant email alerts to william.odiomonafe@gmail.com whenever
 * a user registers, logs in, posts an issue, comments, or shares an issue.
 */

// Allow CORS from any origin (so notifications work from both yesorno.chillon.top and local testing)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$adminEmail = 'william.odiomonafe@gmail.com';
$siteUrl = 'https://yesorno.chillon.top';
$timestamp = date('Y-m-d H:i:s T');
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'Unknown';

// Support GET ?test=1 for instant verification via browser or curl
$isTest = isset($_GET['test']) && ($_GET['test'] === '1' || $_GET['test'] === 'true');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$isTest) {
    echo json_encode([
        'status' => 'online',
        'endpoint' => 'YesOrNo Notification Gateway',
        'recipient' => $adminEmail,
        'instructions' => 'Send POST JSON payload with { event, user, data } or visit ?test=1 to dispatch a test email.'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && !$isTest) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

if ($isTest) {
    $payload = [
        'event' => 'test',
        'user' => [
            'name' => 'William Odiomonafe (Admin)',
            'email' => $adminEmail,
            'role' => 'Platform Owner'
        ],
        'data' => [
            'method' => 'Direct Test Trigger',
            'server' => php_uname('s') . ' ' . php_uname('r'),
            'phpVersion' => phpversion()
        ]
    ];
} else {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }
}

$eventType = isset($payload['event']) ? trim($payload['event']) : 'generic';
$user = isset($payload['user']) && is_array($payload['user']) ? $payload['user'] : [];
$data = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : [];

$userName = isset($user['name']) && !empty($user['name']) ? $user['name'] : 'Guest / Anonymous';
$userEmail = isset($user['email']) && !empty($user['email']) ? $user['email'] : 'Not provided';
$userRole = isset($user['role']) && !empty($user['role']) ? $user['role'] : 'Community Member';

// Determine Event Title, Badge, and Accent Color
$badgeColor = '#6366f1'; // Indigo default
$badgeText = strtoupper($eventType);
$subject = "[YesOrNo Alert] Notification: {$eventType}";
$headline = "Platform Activity Detected";
$extraHtml = "";

switch ($eventType) {
    case 'test':
        $badgeColor = '#3b82f6'; // Blue
        $badgeText = 'TEST ALERT VERIFICATION';
        $subject = "[YesOrNo Alert] ✅ Test Email: Your Notification Gateway is Working!";
        $headline = "This is a test notification confirming email delivery to william.odiomonafe@gmail.com.";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Server Engine:</td><td style='padding:8px 0;color:#38bdf8;font-weight:600;'>" . (isset($data['server']) ? htmlspecialchars($data['server']) : 'PHP Server') . "</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>PHP Version:</td><td style='padding:8px 0;color:#f8fafc;'>" . (isset($data['phpVersion']) ? htmlspecialchars($data['phpVersion']) : phpversion()) . "</td></tr>";
        break;

    case 'register':
        $badgeColor = '#10b981'; // Emerald
        $badgeText = 'NEW USER REGISTRATION';
        $subject = "[YesOrNo Alert] 👤 New User Registered: {$userName} ({$userEmail})";
        $headline = "A new user has registered on YesOrNo!";
        $method = isset($data['method']) ? htmlspecialchars($data['method']) : 'Standard / Google Sign-Up';
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Registration Method:</td><td style='padding:8px 0;color:#f8fafc;font-weight:600;'>{$method}</td></tr>";
        if (!empty($userRole)) {
            $safeRole = htmlspecialchars($userRole);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Assigned Role:</td><td style='padding:8px 0;color:#f8fafc;'>{$safeRole}</td></tr>";
        }
        break;

    case 'login':
        $badgeColor = '#3b82f6'; // Blue
        $badgeText = 'USER LOGGED IN';
        $subject = "[YesOrNo Alert] 🔑 User Logged In: {$userName} ({$userEmail})";
        $headline = "A user just signed in to YesOrNo.";
        $method = isset($data['method']) ? htmlspecialchars($data['method']) : 'Email / Google';
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Login Method:</td><td style='padding:8px 0;color:#f8fafc;font-weight:600;'>{$method}</td></tr>";
        break;

    case 'create_issue':
        $badgeColor = '#8b5cf6'; // Violet
        $badgeText = 'NEW ISSUE POSTED';
        $issueTitle = isset($data['title']) ? htmlspecialchars($data['title']) : 'Untitled Issue';
        $category = isset($data['category']) ? htmlspecialchars($data['category']) : 'General';
        $desc = isset($data['description']) && !empty($data['description']) ? htmlspecialchars($data['description']) : 'None';
        $duration = isset($data['duration']) ? htmlspecialchars($data['duration']) : 'Active';
        $visibility = isset($data['visibility']) ? htmlspecialchars($data['visibility']) : 'public';
        $issueUrl = isset($data['url']) ? $data['url'] : $siteUrl;

        $subject = "[YesOrNo Alert] 📝 New Issue Posted: \"{$issueTitle}\"";
        $headline = "A new time-bound issue has been posted for voting!";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Issue Question:</td><td style='padding:8px 0;color:#f8fafc;font-size:16px;font-weight:700;'>{$issueTitle}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Category:</td><td style='padding:8px 0;color:#c084fc;font-weight:600;'>{$category}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Description:</td><td style='padding:8px 0;color:#cbd5e1;line-height:1.5;'>{$desc}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Voting Window:</td><td style='padding:8px 0;color:#f8fafc;'>{$duration} (Visibility: {$visibility})</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Issue Link:</td><td style='padding:8px 0;'><a href='{$issueUrl}' style='color:#38bdf8;text-decoration:none;font-weight:600;'>Open Live Issue →</a></td></tr>";
        break;

    case 'comment':
        $badgeColor = '#f59e0b'; // Amber
        $badgeText = 'NEW PERSPECTIVE / COMMENT';
        $issueTitle = isset($data['issueTitle']) ? htmlspecialchars($data['issueTitle']) : 'Issue';
        $choice = isset($data['choice']) ? htmlspecialchars($data['choice']) : 'VOTE';
        $note = isset($data['note']) && !empty($data['note']) ? htmlspecialchars($data['note']) : '(No written text)';
        $hasVoice = isset($data['hasVoice']) && $data['hasVoice'] ? '🎙️ Yes (Voice Note Attached)' : 'No';
        $issueUrl = isset($data['url']) ? $data['url'] : $siteUrl;

        $choiceColor = $choice === 'YES' ? '#10b981' : ($choice === 'NO' ? '#f43f5e' : '#f59e0b');

        $subject = "[YesOrNo Alert] 💬 New Comment on: \"{$issueTitle}\"";
        $headline = "A new perspective/comment was just added to an issue!";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Issue:</td><td style='padding:8px 0;color:#f8fafc;font-weight:700;'>{$issueTitle}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Vote Stance:</td><td style='padding:8px 0;color:{$choiceColor};font-weight:800;font-size:15px;'>{$choice}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Perspective / Note:</td><td style='padding:10px;background:#1e293b;border-radius:8px;color:#f1f5f9;line-height:1.5;'>{$note}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Audio Note:</td><td style='padding:8px 0;color:#cbd5e1;'>{$hasVoice}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Issue Link:</td><td style='padding:8px 0;'><a href='{$issueUrl}' style='color:#38bdf8;text-decoration:none;font-weight:600;'>View Issue Thread →</a></td></tr>";
        break;

    case 'share':
        $badgeColor = '#06b6d4'; // Cyan
        $badgeText = 'ISSUE SHARED';
        $issueTitle = isset($data['issueTitle']) ? htmlspecialchars($data['issueTitle']) : 'Issue';
        $platform = isset($data['platform']) ? htmlspecialchars($data['platform']) : 'Direct Link / Social';
        $issueUrl = isset($data['url']) ? $data['url'] : $siteUrl;

        $subject = "[YesOrNo Alert] 🚀 Issue Shared to {$platform}: \"{$issueTitle}\"";
        $headline = "An issue is being shared to social media!";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Issue Shared:</td><td style='padding:8px 0;color:#f8fafc;font-weight:700;'>{$issueTitle}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Platform / Channel:</td><td style='padding:8px 0;color:#38bdf8;font-weight:700;'>{$platform}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Share Link:</td><td style='padding:8px 0;'><a href='{$issueUrl}' style='color:#38bdf8;text-decoration:none;font-weight:600;'>{$issueUrl}</a></td></tr>";
        break;
}

// Build Clean HTML Email Body
$safeUserName = htmlspecialchars($userName);
$safeUserEmail = htmlspecialchars($userEmail);

$messageBody = "
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <title>{$subject}</title>
</head>
<body style='margin:0;padding:24px;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;color:#e2e8f0;'>
  <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:580px;margin:0 auto;background:#0f172a;border-radius:20px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);'>
    
    <!-- Top Header -->
    <tr>
      <td style='padding:24px 28px;background:linear-gradient(135deg, #090d16 0%, #1e1b4b 100%);border-bottom:1px solid rgba(255,255,255,0.08);'>
        <table width='100%' cellpadding='0' cellspacing='0'>
          <tr>
            <td>
              <span style='display:inline-block;padding:4px 10px;background:{$badgeColor}22;border:1px solid {$badgeColor}55;color:{$badgeColor};font-size:11px;font-weight:800;letter-spacing:0.5px;border-radius:999px;'>
                {$badgeText}
              </span>
              <h1 style='margin:10px 0 4px 0;color:#ffffff;font-size:20px;font-weight:800;'>YesOrNo Alert</h1>
              <p style='margin:0;color:#94a3b8;font-size:13px;'>{$headline}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Content Table -->
    <tr>
      <td style='padding:24px 28px;'>
        <table width='100%' cellpadding='0' cellspacing='0' style='font-size:13px;'>
          
          <!-- User Details -->
          <tr>
            <td style='padding:8px 0;color:#94a3b8;font-weight:600;width:140px;'>Triggered By:</td>
            <td style='padding:8px 0;color:#f8fafc;font-weight:700;'>{$safeUserName}</td>
          </tr>
          <tr>
            <td style='padding:8px 0;color:#94a3b8;font-weight:600;'>User Email:</td>
            <td style='padding:8px 0;color:#cbd5e1;'><a href='mailto:{$safeUserEmail}' style='color:#38bdf8;text-decoration:none;'>{$safeUserEmail}</a></td>
          </tr>

          <!-- Extra Event Details -->
          {$extraHtml}

          <!-- Timestamp & IP -->
          <tr>
            <td style='padding:8px 0;color:#64748b;font-size:12px;font-weight:600;border-top:1px solid #1e293b;margin-top:10px;'>Timestamp:</td>
            <td style='padding:8px 0;color:#64748b;font-size:12px;border-top:1px solid #1e293b;margin-top:10px;'>{$timestamp}</td>
          </tr>
        </table>

        <!-- CTA Button -->
        <div style='margin-top:24px;text-align:center;'>
          <a href='{$siteUrl}/#analytics' style='display:inline-block;padding:12px 24px;background:#6366f1;color:#ffffff;font-weight:700;font-size:13px;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(99,102,241,0.4);'>
            Open Admin Analytics →
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style='padding:16px 28px;background:#090d16;border-top:1px solid #1e293b;text-align:center;font-size:11px;color:#64748b;'>
        Sent automatically to <strong style='color:#94a3b8;'>{$adminEmail}</strong> from <a href='{$siteUrl}' style='color:#6366f1;text-decoration:none;'>yesorno.chillon.top</a>
      </td>
    </tr>

  </table>
</body>
</html>
";

// Email Headers
$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/html; charset=UTF-8';
$headers[] = 'From: YesOrNo System <notifications@yesorno.chillon.top>';
$headers[] = 'Reply-To: ' . (!empty($userEmail) && filter_var($userEmail, FILTER_VALIDATE_EMAIL) ? $userEmail : 'notifications@yesorno.chillon.top');
$headers[] = 'X-Mailer: PHP/' . phpversion();

$headersStr = implode("\r\n", $headers);

// Dispatch Email
$mailSent = @mail($adminEmail, $subject, $messageBody, $headersStr);

// Log to notifications.log on server for audit trail & permanent backup
$logEntry = json_encode([
    'timestamp' => $timestamp,
    'event' => $eventType,
    'user' => ['name' => $userName, 'email' => $userEmail, 'role' => $userRole],
    'data' => $data,
    'mailSent' => $mailSent,
    'ip' => $ip
], JSON_UNESCAPED_SLASHES) . "\n";

@file_put_contents(__DIR__ . '/notifications.log', $logEntry, FILE_APPEND | LOCK_EX);

// Return JSON response
echo json_encode([
    'success' => true,
    'test_mode' => $isTest,
    'event' => $eventType,
    'recipient' => $adminEmail,
    'mailSent' => $mailSent,
    'timestamp' => $timestamp,
    'message' => $isTest 
        ? ($mailSent ? 'Test email dispatched to ' . $adminEmail : 'Test event recorded. If mail server queue is delayed, check notifications.log.')
        : 'Notification processed'
]);
