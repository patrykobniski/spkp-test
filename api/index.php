<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$cfg = app_config();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';
// Obsłuż zarówno /api/... jak /spkp-test/api/...
if (preg_match('#/api(/.*)?$#', $path, $m)) {
    $path = $m[1] ?? '/';
} else {
    $path = '/';
}
$path = rtrim($path, '/') ?: '/';

try {
    if ($path === '/login' && $method === 'POST') {
        if (!rate_limit_ok(client_ip())) {
            json_out(429, ['error' => 'too_many_attempts']);
        }
        $body = read_json() ?? [];
        $password = (string)($body['password'] ?? '');
        if ($password === '' || !password_verify($password, (string)$cfg['password_hash'])) {
            json_out(401, ['error' => 'invalid_password']);
        }
        $token = bin2hex(random_bytes(32));
        $days = (int)($cfg['session_days'] ?? 90);
        $expires = time() + $days * 86400;
        db()->prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)')->execute([$token, $expires]);
        set_session_cookie($token, $days, (bool)($cfg['secure_cookie'] ?? true));
        json_out(200, ['ok' => true]);
    }

    if ($path === '/logout' && $method === 'POST') {
        $token = $_COOKIE['spkp_session'] ?? '';
        if ($token !== '') {
            db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$token]);
        }
        clear_session_cookie((bool)($cfg['secure_cookie'] ?? true));
        json_out(200, ['ok' => true]);
    }

    if ($path === '/me' && $method === 'GET') {
        require_auth();
        json_out(200, ['ok' => true]);
    }

    if ($path === '/progress' && $method === 'GET') {
        require_auth();
        $week = (int)($_GET['week'] ?? 0);
        $stmt = db()->prepare(
            'SELECT week, day_index, exercise_order, set_index, is_extra, done, reps, weight_kg, result_text, updated_at
             FROM set_logs WHERE week = ? ORDER BY day_index, exercise_order, set_index'
        );
        $stmt->execute([$week]);
        $sets = $stmt->fetchAll();
        foreach ($sets as &$s) {
            $s['is_extra'] = (int)$s['is_extra'];
            $s['done'] = (int)$s['done'];
            $s['week'] = (int)$s['week'];
            $s['day_index'] = (int)$s['day_index'];
            $s['exercise_order'] = (int)$s['exercise_order'];
            $s['set_index'] = (int)$s['set_index'];
            if ($s['weight_kg'] !== null) {
                $s['weight_kg'] = (float)$s['weight_kg'];
            }
        }
        unset($s);
        $n = db()->prepare('SELECT week, text, updated_at FROM week_notes WHERE week = ?');
        $n->execute([$week]);
        $note = $n->fetch() ?: null;
        if ($note) {
            $note['week'] = (int)$note['week'];
        }
        $maxRows = db()->query('SELECT key, value FROM max_values')->fetchAll();
        $maxes = new stdClass();
        foreach ($maxRows as $r) {
            $maxes->{$r['key']} = (float)$r['value'];
        }
        json_out(200, ['sets' => $sets, 'note' => $note, 'maxes' => $maxes]);
    }

    if ($path === '/set' && $method === 'PUT') {
        require_auth();
        $b = read_json() ?? [];
        $now = gmdate('c');
        $stmt = db()->prepare(
            'INSERT INTO set_logs
              (week, day_index, exercise_order, set_index, is_extra, done, reps, weight_kg, result_text, updated_at)
             VALUES
              (:week, :day_index, :exercise_order, :set_index, :is_extra, :done, :reps, :weight_kg, :result_text, :updated_at)
             ON CONFLICT(week, day_index, exercise_order, set_index) DO UPDATE SET
              is_extra=excluded.is_extra,
              done=excluded.done,
              reps=excluded.reps,
              weight_kg=excluded.weight_kg,
              result_text=excluded.result_text,
              updated_at=excluded.updated_at'
        );
        $stmt->execute([
            ':week' => (int)$b['week'],
            ':day_index' => (int)$b['day_index'],
            ':exercise_order' => (int)$b['exercise_order'],
            ':set_index' => (int)$b['set_index'],
            ':is_extra' => !empty($b['is_extra']) ? 1 : 0,
            ':done' => !empty($b['done']) ? 1 : 0,
            ':reps' => $b['reps'] ?? null,
            ':weight_kg' => $b['weight_kg'] ?? null,
            ':result_text' => $b['result_text'] ?? null,
            ':updated_at' => $now,
        ]);
        if (!empty($b['max_key']) && isset($b['max_value'])) {
            $m = db()->prepare(
                'INSERT INTO max_values (key, value, source, updated_at) VALUES (?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value, source=excluded.source, updated_at=excluded.updated_at'
            );
            $m->execute([
                (string)$b['max_key'],
                (float)$b['max_value'],
                $b['max_source'] ?? null,
                $now,
            ]);
        }
        json_out(200, ['ok' => true]);
    }

    if ($path === '/set' && $method === 'DELETE') {
        require_auth();
        $b = read_json() ?? [];
        db()->prepare(
            'DELETE FROM set_logs WHERE week=? AND day_index=? AND exercise_order=? AND set_index=?'
        )->execute([
            (int)$b['week'],
            (int)$b['day_index'],
            (int)$b['exercise_order'],
            (int)$b['set_index'],
        ]);
        json_out(200, ['ok' => true]);
    }

    if ($path === '/note' && $method === 'PUT') {
        require_auth();
        $b = read_json() ?? [];
        $now = gmdate('c');
        db()->prepare(
            'INSERT INTO week_notes (week, text, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(week) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at'
        )->execute([(int)$b['week'], (string)($b['text'] ?? ''), $now]);
        json_out(200, ['ok' => true]);
    }

    if ($path === '/export' && $method === 'GET') {
        require_auth();
        $format = $_GET['format'] ?? 'json';
        $sets = db()->query(
            'SELECT * FROM set_logs ORDER BY week, day_index, exercise_order, set_index'
        )->fetchAll();
        $notes = db()->query('SELECT * FROM week_notes ORDER BY week')->fetchAll();
        $maxes = db()->query('SELECT * FROM max_values')->fetchAll();
        if ($format === 'csv') {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="spkp-export.csv"');
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'week', 'day_index', 'exercise_order', 'set_index', 'is_extra', 'done',
                'reps', 'weight_kg', 'result_text', 'updated_at',
            ]);
            foreach ($sets as $s) {
                fputcsv($out, [
                    $s['week'], $s['day_index'], $s['exercise_order'], $s['set_index'],
                    $s['is_extra'], $s['done'], $s['reps'], $s['weight_kg'],
                    $s['result_text'], $s['updated_at'],
                ]);
            }
            fclose($out);
            exit;
        }
        json_out(200, ['sets' => $sets, 'notes' => $notes, 'maxes' => $maxes]);
    }

    json_out(404, ['error' => 'not_found']);
} catch (Throwable $e) {
    json_out(500, ['error' => 'server_error', 'message' => $e->getMessage()]);
}
