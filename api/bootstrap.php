<?php
declare(strict_types=1);

function app_config(): array
{
    static $cfg;
    if ($cfg !== null) {
        return $cfg;
    }
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'missing_config']);
        exit;
    }
    $cfg = require $path;
    return $cfg;
}

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $cfg = app_config();
    $path = $cfg['sqlite_path'];
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL;');
    $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS set_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  exercise_order INTEGER NOT NULL,
  set_index INTEGER NOT NULL,
  is_extra INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  reps TEXT,
  weight_kg REAL,
  result_text TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(week, day_index, exercise_order, set_index)
);
CREATE TABLE IF NOT EXISTS week_notes (
  week INTEGER PRIMARY KEY,
  text TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS max_values (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL,
  source TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
SQL);
    return $pdo;
}

function json_out(int $status, $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json(): ?array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function cookie_path(): string
{
    $cfg = app_config();
    return (string)($cfg['cookie_path'] ?? '/spkp-test/');
}

function set_session_cookie(string $token, int $days, bool $secure): void
{
    $maxAge = $days * 24 * 60 * 60;
    setcookie('spkp_session', $token, [
        'expires' => time() + $maxAge,
        'path' => cookie_path(),
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(bool $secure): void
{
    setcookie('spkp_session', '', [
        'expires' => time() - 3600,
        'path' => cookie_path(),
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function require_auth(): void
{
    $cfg = app_config();
    $token = $_COOKIE['spkp_session'] ?? '';
    if ($token === '') {
        json_out(401, ['error' => 'unauthorized']);
    }
    $stmt = db()->prepare('SELECT expires_at FROM sessions WHERE token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row || (int)$row['expires_at'] < time()) {
        if ($row) {
            db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$token]);
        }
        json_out(401, ['error' => 'unauthorized']);
    }
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
        $hdr = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
        if ($hdr !== 'dziennik-spkp') {
            json_out(403, ['error' => 'forbidden']);
        }
    }
}

function rate_limit_ok(string $ip): bool
{
    $pdo = db();
    $now = time();
    $stmt = $pdo->prepare('SELECT * FROM login_attempts WHERE ip = ?');
    $stmt->execute([$ip]);
    $row = $stmt->fetch();
    if (!$row) {
        $pdo->prepare('INSERT INTO login_attempts (ip, count, window_start) VALUES (?, 1, ?)')
            ->execute([$ip, $now]);
        return true;
    }
    if ($now - (int)$row['window_start'] > 15 * 60) {
        $pdo->prepare('UPDATE login_attempts SET count = 1, window_start = ? WHERE ip = ?')
            ->execute([$now, $ip]);
        return true;
    }
    if ((int)$row['count'] >= 20) {
        return false;
    }
    $pdo->prepare('UPDATE login_attempts SET count = count + 1 WHERE ip = ?')->execute([$ip]);
    return true;
}
