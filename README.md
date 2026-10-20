# Dziennik treningowy SPKP

Prosta aplikacja webowa (mobile-first) do 12-tygodniowego planu treningowego. Front: Vite + React + TypeScript. Backend: PHP 8 + SQLite. Lokalnie do developmentu działa też API Node (`server/dev-api.mjs`).

## Wymagania

- Node.js 20+
- Na hostingu: PHP 8 + PDO SQLite (albo MySQL — obecnie SQLite)
- Lokalnie PHP nie jest wymagane

## Start lokalny

```bash
npm install
npm run dev
```

- Aplikacja: http://127.0.0.1:5173/
- API: http://127.0.0.1:8787/ (lokalnie JSON w `server/data/progress.json`; na hostingu PHP + SQLite)
- Hasło domyślne: `spkp` (zmień przez `SPKP_PASSWORD`)

```bash
npm test
npm run build
```

## Konfiguracja PHP (produkcja)

1. Skopiuj `api/config.example.php` → `api/config.php` na serwerze (nie commituj).
2. Wygeneruj hash hasła:

```bash
php -r "echo password_hash('twoje-haslo', PASSWORD_DEFAULT), PHP_EOL;"
```

3. Ustaw `sqlite_path` poza katalogiem publicznym, np. `../storage/progress.sqlite`.
4. Wrzuć zawartość `dist/` do katalogu WWW oraz folder `api/`.
5. Upewnij się, że `storage/` nie jest dostępne z sieci (jest `.htaccess`).

### Struktura na FTP (przykład)

```
public_html/
  index.html
  assets/
  api/
    index.php
    bootstrap.php
    config.php          ← tylko na serwerze
    .htaccess
  storage/              ← poza public, jeśli hoster pozwala
    progress.sqlite
```

Jeśli `storage` musi być obok `api`, zostaw `.htaccess` z `Require all denied`.

## GitHub Actions / sekrety

Repo: [patrykobniski/spkp-test](https://github.com/patrykobniski/spkp-test)  
Podgląd: https://ux.dev-jaaqob.pl/spkp-test/

Workflow po pushu na `main` (ten sam serwer FTP co parkapp / kontur-ux):

| Sekret | Wartość (jak w innych projektach UX) |
|---|---|
| `FTP_SERVER` | `ftp.dev-jaaqob.pl` |
| `FTP_USERNAME` | konto UX |
| `FTP_PASSWORD` | hasło FTP |

Katalog docelowy jest na stałe: `/spkp-test/` (jak `/parkapp/` w parkapp).

`config.php` i baza SQLite są wykluczone z deployu.

## Kopia zapasowa

- W aplikacji: **Ustawienia → Pobierz kopię wyników (JSON/CSV)**
- Na serwerze: skopiuj plik SQLite z `sqlite_path`

## PWA

Manifest jest w `public/manifest.webmanifest`. Na telefonie: „Dodaj do ekranu głównego”. Offline nie jest wymagany.
