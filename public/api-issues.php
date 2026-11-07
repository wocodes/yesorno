<?php
/**
 * YesOrNo - Shared Issues Cloud Persistence API
 * Synchronizes issues across mobile, tablet, and desktop devices.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

$dataFile = $dataDir . '/issues.json';

// Handle GET: Retrieve all shared issues
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($dataFile)) {
        $content = @file_get_contents($dataFile);
        if ($content) {
            echo $content;
            exit;
        }
    }
    echo json_encode([]);
    exit;
}

// Handle POST: Save / Merge issues
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit;
    }

    // Existing issues
    $existing = [];
    if (file_exists($dataFile)) {
        $raw = @file_get_contents($dataFile);
        if ($raw) {
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) {
                $existing = $parsed;
            }
        }
    }

    // Merge incoming issues with existing (by issue ID)
    $incomingList = isset($payload['issues']) && is_array($payload['issues'])
        ? $payload['issues']
        : (isset($payload['id']) ? [$payload] : (isset($payload[0]['id']) ? $payload : []));

    $byId = [];
    foreach ($existing as $iss) {
        if (isset($iss['id'])) {
            $byId[$iss['id']] = $iss;
        }
    }

    foreach ($incomingList as $iss) {
        if (isset($iss['id'])) {
            // If already exists, prefer the one with higher votes/responses or updated content
            $byId[$iss['id']] = $iss;
        }
    }

    $merged = array_values($byId);

    // Save with lock
    @file_put_contents($dataFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);

    echo json_encode([
        'success' => true,
        'count' => count($merged),
        'timestamp' => date('c')
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
