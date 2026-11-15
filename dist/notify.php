<?php
/**
 * YesOrNo - Admin Real-Time Event Notification Dispatcher
 * Sends instant email alerts to william.odiomonafe@gmail.com whenever
 * a user registers, posts an issue, sends a contact message, etc.
 * Supports: Direct SSL/TLS SMTP, Resend API, and Native Hostinger Sendmail
 */

// Allow CORS from any origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, Authorization');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$adminEmail = 'william.odiomonafe@gmail.com';
$siteUrl = 'https://yesorno.chillon.top';
$timestamp = date('Y-m-d H:i:s T');
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'Unknown';
$configFile = __DIR__ . '/data/email_config.json';

// Helper: Load Email Configuration
function load_email_config($filePath) {
    $defaults = [
        'transport' => 'auto', // 'auto', 'resend', 'smtp', or 'mail'
        'smtp_host' => 'smtp.hostinger.com',
        'smtp_port' => 465,
        'smtp_secure' => 'ssl', // 'ssl' or 'tls'
        'smtp_user' => '',
        'smtp_pass' => '',
        'smtp_from' => 'notifications@chillon.top',
        'smtp_from_name' => 'YesOrNo System',
        'resend_api_key' => ''
    ];
    if (file_exists($filePath)) {
        $raw = @file_get_contents($filePath);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return array_merge($defaults, $decoded);
        }
    }
    return $defaults;
}

$emailConfig = load_email_config($configFile);

// Support GET ?test=1 for instant verification via browser or curl
$isTest = isset($_GET['test']) && ($_GET['test'] === '1' || $_GET['test'] === 'true');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$isTest) {
    if (isset($_GET['config']) && $_GET['config'] === '1') {
        $safeConfig = $emailConfig;
        if (!empty($safeConfig['smtp_pass'])) {
            $safeConfig['smtp_pass'] = '••••••••';
        }
        if (!empty($safeConfig['resend_api_key'])) {
            $safeConfig['resend_api_key'] = substr($safeConfig['resend_api_key'], 0, 6) . '••••••••';
        }
        echo json_encode(['success' => true, 'config' => $safeConfig]);
        exit;
    }

    echo json_encode([
        'status' => 'online',
        'endpoint' => 'YesOrNo Notification Gateway',
        'adminEmail' => $adminEmail,
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

    // Handle Admin config update action
    if (isset($payload['action']) && $payload['action'] === 'save_email_config') {
        $incoming = isset($payload['config']) && is_array($payload['config']) ? $payload['config'] : [];
        if (!empty($incoming['smtp_pass']) && $incoming['smtp_pass'] === '••••••••') {
            $incoming['smtp_pass'] = $emailConfig['smtp_pass'];
        }
        if (!empty($incoming['resend_api_key']) && strpos($incoming['resend_api_key'], '••••') !== false) {
            $incoming['resend_api_key'] = $emailConfig['resend_api_key'];
        }
        $merged = array_merge($emailConfig, $incoming);
        @file_put_contents($configFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        echo json_encode(['success' => true, 'message' => 'Email gateway configuration saved successfully']);
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
        $badgeColor = '#3b82f6';
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
        
        // Traffic Acquisition Source Attribution
        if (!empty($data['acquisitionSource']) || !empty($data['channel'])) {
            $safeChannel = htmlspecialchars($data['acquisitionSource'] ?? $data['channel']);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Acquisition Channel:</td><td style='padding:8px 0;color:#10b981;font-weight:700;'>{$safeChannel}</td></tr>";
        }
        if (!empty($data['landingPath'])) {
            $safeLanding = htmlspecialchars($data['landingPath']);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Landing Page:</td><td style='padding:8px 0;color:#cbd5e1;'>{$safeLanding}</td></tr>";
        }
        if (!empty($data['referrer']) && $data['referrer'] !== 'direct') {
            $safeRef = htmlspecialchars($data['referrer']);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Original Referrer:</td><td style='padding:8px 0;color:#cbd5e1;'>{$safeRef}</td></tr>";
        }

        if (!empty($userRole)) {
            $safeRole = htmlspecialchars($userRole);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Assigned Role:</td><td style='padding:8px 0;color:#f8fafc;'>{$safeRole}</td></tr>";
        }
        if (!empty($data['region'])) {
            $safeRegion = htmlspecialchars($data['region']);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Region / Location:</td><td style='padding:8px 0;color:#f8fafc;'>{$safeRegion}</td></tr>";
        }
        if (!empty($data['interests'])) {
            $safeInterests = htmlspecialchars($data['interests']);
            $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Selected Interests:</td><td style='padding:8px 0;color:#38bdf8;'>{$safeInterests}</td></tr>";
        }
        break;

    case 'login':
        $badgeColor = '#3b82f6';
        $badgeText = 'USER LOGGED IN';
        $subject = "[YesOrNo Alert] 🔑 User Logged In: {$userName} ({$userEmail})";
        $headline = "A user just signed in to YesOrNo.";
        $method = isset($data['method']) ? htmlspecialchars($data['method']) : 'Email / Google';
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Login Method:</td><td style='padding:8px 0;color:#f8fafc;font-weight:600;'>{$method}</td></tr>";
        break;

    case 'create_issue':
        $badgeColor = '#8b5cf6';
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

    case 'contact_message':
        $badgeColor = '#0ea5e9';
        $badgeText = 'NEW CONTACT MESSAGE';
        $category = isset($data['category']) ? htmlspecialchars($data['category']) : 'General Inquiry';
        $subjectText = isset($data['subject']) && !empty($data['subject']) ? htmlspecialchars($data['subject']) : "Inquiry regarding {$category}";
        $messageText = isset($data['message']) ? htmlspecialchars($data['message']) : '';

        $subject = "[YesOrNo Contact] [{$category}] {$subjectText}";
        $headline = "A user just submitted a new message via the Contact Form!";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Category:</td><td style='padding:8px 0;color:#38bdf8;font-weight:700;font-size:14px;'>{$category}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;'>Subject:</td><td style='padding:8px 0;color:#f8fafc;font-weight:700;'>{$subjectText}</td></tr>";
        $extraHtml .= "<tr><td style='padding:8px 0;color:#94a3b8;font-weight:600;vertical-align:top;'>Message:</td><td style='padding:14px;background:#1e293b;border-radius:10px;color:#f1f5f9;line-height:1.6;font-size:13px;white-space:pre-wrap;'>{$messageText}</td></tr>";
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
        Sent from <a href='{$siteUrl}' style='color:#6366f1;text-decoration:none;'>yesorno.chillon.top</a> • You can manage activity alerts in your Profile Settings.
      </td>
    </tr>

  </table>
</body>
</html>
";

$targetRecipient = (!empty($data['recipientEmail']) && filter_var($data['recipientEmail'], FILTER_VALIDATE_EMAIL))
    ? trim($data['recipientEmail'])
    : $adminEmail;

$fromDomain = 'chillon.top';
$fromEmail = !empty($emailConfig['smtp_from']) ? $emailConfig['smtp_from'] : ('notifications@' . $fromDomain);

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/html; charset=UTF-8';
$headers[] = "From: YesOrNo System <{$fromEmail}>";
$headers[] = 'Reply-To: ' . (!empty($userEmail) && filter_var($userEmail, FILTER_VALIDATE_EMAIL) ? $userEmail : $fromEmail);
$headers[] = "Return-Path: <{$fromEmail}>";
$headers[] = 'X-Mailer: PHP/' . phpversion();
$headersStr = implode("\r\n", $headers);

// ============================================================================
// Transport 1: Resend API (HTTP REST)
// ============================================================================
function send_via_resend($to, $subj, $html, $apiKey, $fromEmail) {
    if (empty($apiKey)) return ['success' => false, 'error' => 'Missing Resend API Key'];
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'from' => 'YesOrNo <' . $fromEmail . '>',
        'to' => [$to],
        'subject' => $subj,
        'html' => $html
    ]));
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300) {
        return ['success' => true, 'response' => json_decode($res, true)];
    }
    return ['success' => false, 'error' => $curlErr ? $curlErr : "HTTP {$httpCode}: {$res}"];
}

// ============================================================================
// Transport 2: Direct RFC 5321 SSL/TLS SMTP Socket
// ============================================================================
function send_via_smtp($to, $subj, $html, $config) {
    $host = !empty($config['smtp_host']) ? trim($config['smtp_host']) : 'smtp.hostinger.com';
    $port = !empty($config['smtp_port']) ? (int)$config['smtp_port'] : 465;
    $secure = !empty($config['smtp_secure']) ? trim($config['smtp_secure']) : ($port === 465 ? 'ssl' : 'tls');
    $user = !empty($config['smtp_user']) ? trim($config['smtp_user']) : '';
    $pass = !empty($config['smtp_pass']) ? trim($config['smtp_pass']) : '';
    $from = !empty($config['smtp_from']) ? trim($config['smtp_from']) : $user;
    $fromName = !empty($config['smtp_from_name']) ? trim($config['smtp_from_name']) : 'YesOrNo System';

    if (empty($user) || empty($pass)) {
        return ['success' => false, 'error' => 'Missing SMTP username or password'];
    }

    $proto = ($secure === 'ssl') ? 'ssl://' : '';
    $socket = @fsockopen($proto . $host, $port, $errno, $errstr, 5);
    if (!$socket) {
        return ['success' => false, 'error' => "SMTP Connection failed to {$host}:{$port} - {$errstr} ({$errno})"];
    }

    $read = function() use ($socket) {
        $data = '';
        while ($str = fgets($socket, 515)) {
            $data .= $str;
            if (substr($str, 3, 1) === ' ') break;
        }
        return $data;
    };
    $write = function($cmd) use ($socket) {
        fputs($socket, $cmd . "\r\n");
    };

    $greeting = $read();
    if (substr($greeting, 0, 3) !== '220') {
        fclose($socket);
        return ['success' => false, 'error' => "SMTP Greeting failed: {$greeting}"];
    }

    $write("EHLO " . (gethostname() ?: 'yesorno.chillon.top'));
    $read();

    if ($secure === 'tls') {
        $write("STARTTLS");
        $tlsResp = $read();
        if (substr($tlsResp, 0, 3) !== '220') {
            fclose($socket);
            return ['success' => false, 'error' => "STARTTLS failed: {$tlsResp}"];
        }
        stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $write("EHLO " . (gethostname() ?: 'yesorno.chillon.top'));
        $read();
    }

    $write("AUTH LOGIN");
    $authAsk = $read();
    if (substr($authAsk, 0, 3) !== '334') {
        fclose($socket);
        return ['success' => false, 'error' => "AUTH LOGIN not accepted: {$authAsk}"];
    }

    $write(base64_encode($user));
    $read();
    $write(base64_encode($pass));
    $authResp = $read();
    if (substr($authResp, 0, 3) !== '235') {
        fclose($socket);
        return ['success' => false, 'error' => "SMTP Authentication failed: {$authResp}"];
    }

    $write("MAIL FROM: <{$from}>");
    $mfResp = $read();
    if (substr($mfResp, 0, 3) !== '250') {
        fclose($socket);
        return ['success' => false, 'error' => "MAIL FROM rejected: {$mfResp}"];
    }

    $write("RCPT TO: <{$to}>");
    $rcptResp = $read();
    if (substr($rcptResp, 0, 3) !== '250' && substr($rcptResp, 0, 3) !== '251') {
        fclose($socket);
        return ['success' => false, 'error' => "RCPT TO rejected: {$rcptResp}"];
    }

    $write("DATA");
    $dataResp = $read();
    if (substr($dataResp, 0, 3) !== '354') {
        fclose($socket);
        return ['success' => false, 'error' => "DATA rejected: {$dataResp}"];
    }

    $emailData = "MIME-Version: 1.0\r\n" .
                 "Content-Type: text/html; charset=UTF-8\r\n" .
                 "From: {$fromName} <{$from}>\r\n" .
                 "To: <{$to}>\r\n" .
                 "Subject: {$subj}\r\n" .
                 "Date: " . date('r') . "\r\n\r\n" .
                 $html . "\r\n.\r\n";

    $write($emailData);
    $sendResp = $read();
    $write("QUIT");
    fclose($socket);

    if (substr($sendResp, 0, 3) === '250') {
        return ['success' => true, 'response' => trim($sendResp)];
    }
    return ['success' => false, 'error' => "SMTP Delivery failed: {$sendResp}"];
}

// ============================================================================
// Multi-Transport Dispatch Helper Function
// ============================================================================
function dispatch_single_email($to, $subj, $html, $config, $fromEmail) {
    $mailSent = false;
    $activeTransport = 'none';
    $transportDetails = null;

    // 1. Try Resend if configured
    if (!$mailSent && !empty($config['resend_api_key'])) {
        $resendRes = send_via_resend($to, $subj, $html, $config['resend_api_key'], $fromEmail);
        if ($resendRes['success']) {
            $mailSent = true;
            $activeTransport = 'resend';
            $transportDetails = $resendRes;
        } else {
            $transportDetails = ['resend_error' => $resendRes['error']];
        }
    }

    // 2. Try SMTP if configured
    if (!$mailSent && !empty($config['smtp_user']) && !empty($config['smtp_pass'])) {
        $smtpRes = send_via_smtp($to, $subj, $html, $config);
        if ($smtpRes['success']) {
            $mailSent = true;
            $activeTransport = 'smtp';
            $transportDetails = $smtpRes;
        } else {
            $transportDetails = ['smtp_error' => $smtpRes['error']];
        }
    }

    // 3. Fallback to Hostinger PHP sendmail
    if (!$mailSent) {
        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            "From: YesOrNo <{$fromEmail}>",
            "Reply-To: {$fromEmail}",
            "Return-Path: <{$fromEmail}>",
            'X-Mailer: PHP/' . phpversion()
        ];
        $headersStr = implode("\r\n", $headers);

        $mailErrors = [];
        set_error_handler(function($errno, $errstr) use (&$mailErrors) {
            $mailErrors[] = "[{$errno}] {$errstr}";
            return true;
        });

        $mailSent = @mail($to, $subj, $html, $headersStr, "-f{$fromEmail}");
        restore_error_handler();

        if ($mailSent) {
            $activeTransport = 'php_mail';
        } else {
            // Attempt single direct proc_open pipe if mail() failed
            $sendmailBin = !empty(ini_get('sendmail_path')) ? explode(' ', trim(ini_get('sendmail_path')))[0] : '/usr/sbin/sendmail';
            $cmd = "{$sendmailBin} -t -i -f{$fromEmail}";
            $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
            $proc = @proc_open($cmd, $descriptors, $pipes);
            if (is_resource($proc)) {
                $rawEmail = "To: {$to}\r\n" . $headersStr . "\r\nSubject: {$subj}\r\n\r\n" . $html;
                fwrite($pipes[0], $rawEmail);
                fclose($pipes[0]);
                $hstdout = stream_get_contents($pipes[1]);
                fclose($pipes[1]);
                $hstderr = stream_get_contents($pipes[2]);
                fclose($pipes[2]);
                $hstatus = proc_close($proc);

                if ($hstatus === 0) {
                    $mailSent = true;
                    $activeTransport = 'sendmail_pipe';
                } else {
                    $activeTransport = 'sendmail_failed';
                    $transportDetails = [
                        'exitCode' => $hstatus,
                        'stderr' => trim($hstderr)
                    ];
                }
            }
        }
    }

    return [
        'sent' => $mailSent,
        'transport' => $activeTransport,
        'details' => $transportDetails
    ];
}

// Helper: Retrieve Trending Issues for Welcome Email
function get_welcome_trending_issues(array $providedIssues = []): array {
    if (!empty($providedIssues) && is_array($providedIssues)) {
        return array_slice($providedIssues, 0, 4);
    }
    $dbPath = __DIR__ . '/data/yesorno.sqlite';
    if (file_exists($dbPath)) {
        try {
            $pdo = new PDO("sqlite:" . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $stmt = $pdo->query("
                SELECT id, title, category, yes_count, no_count, views_count
                FROM issues
                WHERE is_deleted = 0
                ORDER BY (yes_count + no_count + coalesce(views_count, 0) + coalesce(likes_count, 0)) DESC
                LIMIT 4
            ");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) return $rows;
        } catch (Exception $e) {
            // Ignore
        }
    }
    return [
        [
            'id' => 'trending-1',
            'title' => 'Should couples have full access to each other\'s phones and banking apps?',
            'category' => 'Counselling',
            'yes_count' => 142,
            'no_count' => 198
        ],
        [
            'id' => 'trending-2',
            'title' => 'Is remote work more productive than compulsory 5-day office presence for Nigerian tech talent?',
            'category' => 'Workplace & Career',
            'yes_count' => 285,
            'no_count' => 43
        ],
        [
            'id' => 'trending-3',
            'title' => 'Should extended family financial support (Black Tax) have strict personal percentage caps?',
            'category' => 'Family & Home',
            'yes_count' => 312,
            'no_count' => 88
        ]
    ];
}

// Helper: Build User Welcome HTML Email
function build_user_welcome_email_html(string $userName, string $userEmail, array $issues, string $siteUrl): string {
    $safeName = htmlspecialchars($userName);
    $safeEmail = htmlspecialchars($userEmail);
    $issuesList = get_welcome_trending_issues($issues);

    $cardsHtml = "";
    foreach ($issuesList as $iss) {
        $id = htmlspecialchars($iss['id'] ?? 'explore');
        $title = htmlspecialchars($iss['title'] ?? 'Community Question');
        $category = htmlspecialchars($iss['category'] ?? 'Civic');
        $yes = (int)($iss['yesCount'] ?? ($iss['yes_count'] ?? 10));
        $no = (int)($iss['noCount'] ?? ($iss['no_count'] ?? 5));
        $total = $yes + $no;
        $yesPct = $total > 0 ? round(($yes / $total) * 100) : 50;
        $noPct = 100 - $yesPct;
        $issueUrl = "{$siteUrl}/#issue/{$id}";

        $cardsHtml .= "
        <div style='margin-bottom:14px;padding:16px 18px;background:#1e293b;border-radius:16px;border:1px solid #334155;'>
          <div style='margin-bottom:8px;'>
            <span style='font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(99,102,241,0.25);color:#a5b4fc;text-transform:uppercase;letter-spacing:0.5px;'>
              {$category}
            </span>
            <span style='float:right;font-size:11px;color:#94a3b8;font-weight:600;'>
              {$total} votes
            </span>
          </div>
          <a href='{$issueUrl}' style='display:block;font-size:14px;font-weight:700;color:#f8fafc;text-decoration:none;margin-bottom:12px;line-height:1.4;'>
            {$title}
          </a>
          <table width='100%' cellpadding='0' cellspacing='0'>
            <tr>
              <td style='vertical-align:middle;'>
                <div style='font-size:11px;color:#94a3b8;margin-bottom:4px;'>
                  <span style='color:#10b981;font-weight:700;'>YES {$yesPct}%</span>
                  <span style='color:#f43f5e;font-weight:700;margin-left:12px;'>NO {$noPct}%</span>
                </div>
                <div style='background:#334155;height:6px;border-radius:999px;overflow:hidden;'>
                  <table width='100%' height='6' cellpadding='0' cellspacing='0'>
                    <tr>
                      <td width='{$yesPct}%' style='background:#10b981;height:6px;'></td>
                      <td width='{$noPct}%' style='background:#f43f5e;height:6px;'></td>
                    </tr>
                  </table>
                </div>
              </td>
              <td style='width:105px;text-align:right;padding-left:14px;vertical-align:middle;'>
                <a href='{$issueUrl}' style='display:inline-block;padding:7px 14px;background:#10b981;color:#ffffff;font-size:11px;font-weight:800;border-radius:10px;text-decoration:none;'>
                  Vote Now →
                </a>
              </td>
            </tr>
          </table>
        </div>";
    }

    return "
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <title>Welcome to YesOrNo</title>
</head>
<body style='margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background-color:#090d16;padding:32px 12px;'>
    <tr>
      <td align='center'>
        <table width='100%' cellpadding='0' cellspacing='0' style='max-width:580px;background:#0f172a;border-radius:24px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);'>
          
          <!-- Gradient Header -->
          <tr>
            <td style='background:linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #0d9488 100%);padding:36px 32px 28px;text-align:center;'>
              <div style='display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.2);backdrop-filter:blur(8px);border-radius:999px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#ffffff;margin-bottom:12px;'>
                🎉 Welcome to the Community
              </div>
              <h1 style='margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;'>
                Welcome to YesOrNo, {$safeName}!
              </h1>
              <p style='margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.92);line-height:1.5;'>
                Your perspective matters. Deliberate, vote on real public dilemmas, and shape civic consensus.
              </p>
            </td>
          </tr>

          <!-- Intro Message -->
          <tr>
            <td style='padding:28px 32px 16px;'>
              <p style='margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;'>
                Thanks for joining <strong>YesOrNo</strong>! Whether it&apos;s relationship dilemmas, workplace ethics, national economy, or community consensus &mdash; this is the open platform where every vote and perspective counts.
              </p>
              
              <div style='padding:16px 20px;background:#1e293b;border-radius:16px;border-left:4px solid #10b981;margin-bottom:24px;'>
                <div style='font-size:13px;font-weight:700;color:#f8fafc;margin-bottom:4px;'>
                  ✨ How to participate in 3 easy steps:
                </div>
                <div style='font-size:12px;color:#94a3b8;line-height:1.6;'>
                  1. <strong>Vote YES or NO</strong> on open community dilemmas.<br>
                  2. <strong>Add your perspective or voice note</strong> to explain your reasoning.<br>
                  3. <strong>Watch live consensus form</strong> as people deliberate in real time.
                </div>
              </div>

              <!-- Hottest Questions Section Header -->
              <div style='margin-bottom:14px;'>
                <h3 style='margin:0;font-size:15px;font-weight:800;color:#ffffff;'>
                  🔥 Hot &amp; Trending Debates (Vote Now)
                </h3>
                <p style='margin:4px 0 0;font-size:12px;color:#94a3b8;'>
                  Here are some of the most debated questions currently active on the platform:
                </p>
              </div>
              
              <!-- Trending Issues Cards -->
              {$cardsHtml}

              <!-- Main CTA -->
              <div style='text-align:center;margin:32px 0 16px;'>
                <a href='{$siteUrl}' style='display:inline-block;padding:14px 32px;background:#6366f1;color:#ffffff;font-size:14px;font-weight:800;border-radius:16px;text-decoration:none;box-shadow:0 4px 16px rgba(99,102,241,0.45);'>
                  Explore All Questions &amp; Start Voting →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style='padding:20px 32px;background:#090d16;border-top:1px solid #1e293b;text-align:center;'>
              <p style='margin:0 0 6px;font-size:12px;color:#64748b;'>
                YesOrNo &bull; The Open Civic Deliberation &amp; Consensus Platform
              </p>
              <p style='margin:0;font-size:11px;color:#475569;'>
                Sent to {$safeEmail} because you created an account on YesOrNo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
}

// ============================================================================
// Multi-Transport Dispatch Execution
// ============================================================================

// 1. Dispatch Primary Notification (Admin Alert or custom trigger)
$primaryDispatch = dispatch_single_email($targetRecipient, $subject, $messageBody, $emailConfig, $fromEmail);
$mailSent = $primaryDispatch['sent'];
$activeTransport = $primaryDispatch['transport'];
$transportDetails = $primaryDispatch['details'];

// 2. Dispatch User Welcome Email on Registration
$welcomeSent = false;
$welcomeTransport = 'none';

$isRealUserEmail = !empty($userEmail) 
    && filter_var($userEmail, FILTER_VALIDATE_EMAIL)
    && strtolower($userEmail) !== strtolower($adminEmail)
    && strpos(strtolower($userEmail), '@yesorno.ng') === false;

if (($eventType === 'register' || $eventType === 'welcome') && $isRealUserEmail) {
    $welcomeSubj = "Welcome to YesOrNo, {$userName}! 👋 Here are trending questions to get started";
    $welcomeBody = build_user_welcome_email_html($userName, $userEmail, $data['trendingIssues'] ?? [], $siteUrl);
    $welcomeDispatch = dispatch_single_email($userEmail, $welcomeSubj, $welcomeBody, $emailConfig, $fromEmail);
    $welcomeSent = $welcomeDispatch['sent'];
    $welcomeTransport = $welcomeDispatch['transport'];
}

// Log to notifications.log on server for audit trail & permanent backup
$logEntry = json_encode([
    'timestamp' => $timestamp,
    'event' => $eventType,
    'user' => ['name' => $userName, 'email' => $userEmail, 'role' => $userRole],
    'data' => $data,
    'mailSent' => $mailSent,
    'transport' => $activeTransport,
    'transportDetails' => $transportDetails,
    'ip' => $ip
], JSON_UNESCAPED_SLASHES) . "\n";

@file_put_contents(__DIR__ . '/data/notifications.log', $logEntry, FILE_APPEND | LOCK_EX);

// Also mirror to legacy public root log for compatibility
@file_put_contents(__DIR__ . '/notifications.log', $logEntry, FILE_APPEND | LOCK_EX);

// Return JSON response
echo json_encode([
    'success' => true,
    'test_mode' => $isTest,
    'event' => $eventType,
    'mailSent' => $mailSent,
    'transport' => $activeTransport,
    'welcomeSent' => $welcomeSent,
    'welcomeTransport' => $welcomeTransport,
    'timestamp' => $timestamp,
    'targetRecipient' => $targetRecipient,
    'diagnostics' => $isTest ? [
        'targetRecipient' => $targetRecipient,
        'fromEmail' => $fromEmail,
        'activeTransport' => $activeTransport,
        'transportDetails' => $transportDetails,
        'mail_function_exists' => function_exists('mail'),
        'sendmail_path' => ini_get('sendmail_path')
    ] : null,
    'message' => $mailSent 
        ? "Notification email dispatched successfully via {$activeTransport} to {$targetRecipient}" 
        : "Notification recorded in audit log (mail transport pending server delivery)"
]);
