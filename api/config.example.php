<?php
/**
 * Skopiuj jako config.php na serwerze (nie w repo).
 * Hash: php -r "echo password_hash('haslo', PASSWORD_DEFAULT);"
 */
return [
    'password_hash' => '$2y$10$REPLACE_ME',
    'sqlite_path' => __DIR__ . '/../storage/progress.sqlite',
    'secure_cookie' => true,
    'cookie_path' => '/spkp-test/',
    'session_days' => 90,
];
