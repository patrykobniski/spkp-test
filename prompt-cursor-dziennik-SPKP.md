# Prompt dla Cursora: Dziennik treningowy SPKP

Wklej wszystko poniżej do Cursora (tryb Agent). Obok wrzuć do repozytorium plik `plan-spkp.json` (dane planu) jako `data/plan-spkp.json`.

---

## Cel

Zbuduj prostą aplikację webową do prowadzenia 12-tygodniowego planu treningowego na telefonie, podczas treningu na siłowni. Użytkownik jest jeden (ja). Aplikacja pokazuje, co mam dziś zrobić, ćwiczenie po ćwiczeniu, serię po serii, i zapisuje moje wyniki na serwerze, żeby nic nie przepadło po zamknięciu przeglądarki ani po zmianie telefonu.

Najważniejsze: **prosto, czytelnie, obsługa jedną ręką, duże elementy dotykowe**. Ma być od razu jasne, co robię teraz, ile serii, ile powtórzeń i jaki ciężar.

Język interfejsu: polski.

## Dane

Plan jest w pliku `data/plan-spkp.json` (nie wymyślaj własnych ćwiczeń i nie zmieniaj treści). Struktura:

- `startDate` (poniedziałek 2026-10-19), `weeks[12]`
- każdy tydzień: `week`, `flags` (np. testy w tym tygodniu), `days[5]` (pon–pt; sobota i niedziela wolne)
- każdy dzień: `dayIndex` (0=pon), `dayName`, `title`, `notes[]` (rozgrzewka i zasady dnia), `warmupVideo`, `exercises[]`
- każde ćwiczenie: `order`, `name`, `videos[] {label,url}` (YouTube), `hasWeight` (czy pokazywać pole kg), `singleResult` (bieg, basen, test: jedno pole „wynik" zamiast serii), `plannedSets[]` (tekst celu każdej serii, np. „15 powt.", „5 × 47,5 kg", „3+2", „30 s"), `hints[]` (dodatkowe wskazówki, np. „Jeśli uda się 20x, dołóż ciężar")

Liczba serii = długość `plannedSets`. Wczytaj plik przy starcie (seed) i trzymaj w repo jako źródło prawdy dla planu. W bazie zapisuj **tylko moje wyniki**, nie cały plan.

Uwagi o danych:
- „3+2", „1x+2x" w podciąganiu i pompkach to zapis trenera: pogrubione = powtórzenia, „+2" = dodatkowe negatywy (same opuszczanie). Pokazuj cel dokładnie tak, jak jest w pliku, w jednej linii, bez własnych interpretacji.
- W dniach „MAX" (pompki, podciąganie) wpisuję wynik, który w kolejnych tygodniach jest bazą M, N, O (cele typu „M−4", „N+2"). **Automatyzacja:** gdy cel zawiera M, N albo O, przelicz go na konkretną liczbę na podstawie mojego wyniku z odpowiedniego dnia MAX i pokaż np. „M−4 = 13". Wiersze z celem „MAX (M)", „MAX (N)", „MAX (O)" oznaczają, że to wynik, który wpisuję jako M/N/O. Jeśli wyniku jeszcze nie ma, pokaż samo „M−4" i dyskretną informację „wpisz MAX, żeby policzyć".
  - Pompki: M = MAX z „Dzień 9", N = MAX z „Dzień 18", O = MAX z „Dzień 27" (numer dnia jest w polu `plannedSets`/`hints` tych wierszy; sprawdź w pliku, które wiersze to MAX).
  - Podciąganie: M = sesja 14, N = sesja 26, O = sesja 36.
  - Jeśli reguła jest niejasna w danych, zapytaj mnie zamiast zgadywać.

## Ekrany

1. **Dziś** (ekran startowy). Automatycznie otwiera dzisiejszy dzień według daty (start 19.10.2026, 12 tygodni). W weekend pokazuje „Dziś wolne" i skrót do następnego poniedziałku. Pod spodem lista ćwiczeń dnia.
2. **Ćwiczenie** (karta na liście lub osobny ekran, wybierz to, co jest wygodniejsze). Nazwa, ikona ▶ z linkiem do filmu (otwiera się w nowej karcie), wskazówki. Każda seria to osobny wiersz:
   - duży checkbox „zrobione",
   - cel serii z planu (np. „Cel: 15 powt." lub „Cel: 5 × 47,5 kg"),
   - pole „powtórzenia" i, gdy `hasWeight`, pole „kg" (klawiatura numeryczna),
   - jeśli nie zrobiłem tyle, ile trzeba, wpisuję mniej i seria nadal może być odhaczona,
   - przycisk „+ seria" (dodatkowa seria ponad plan) i „✕" przy dodatkowych seriach,
   - przycisk „Wszystkie ✓".
   Dla `singleResult` jedno pole „wynik" (np. dystans testu 12 min w metrach, czas 200 m) i jeden checkbox.
3. **Tydzień**: przełączanie tygodni strzałkami i dni Pn–Pt z oznaczeniem postępu (ile serii zrobione).
4. **Historia ćwiczenia**: pod nazwą ćwiczenia mała linia „Tydz. 2: 15/15/12 · 40 kg" z poprzedniego razu tego samego ćwiczenia w tym samym dniu tygodnia. Przy podpowiedzi ciężaru podstaw ostatnio użyty ciężar jako placeholder.
5. **Notatki tygodnia**: jedno pole tekstowe na tydzień.
6. **Ustawienia**: wylogowanie, „Pobierz kopię wyników (JSON)", „Pobierz kopię (CSV)".

Dodatkowe funkcje:
- **Minutnik przerwy**: pływający przycisk. Automatycznie startuje na 90 s po odhaczeniu serii. Presety 45/90/120/180 s i Stop. Sygnał dźwiękowy i wibracja po końcu (jeśli przeglądarka pozwala).
- **Blokada wygaszania ekranu** (Wake Lock API) podczas treningu, z obsługą braku wsparcia.
- Zmiany zapisują się **automatycznie** (debounce około 600 ms, bez przycisku „Zapisz"). Widoczny, spokojny status: „Zapisano" albo „Nie zapisano, ponawiam". Przy błędzie sieci kolejka ponowień, żeby nic nie przepadło.
- Jasny i ciemny motyw według ustawień telefonu.
- Dostępność: kontrast, wszystkie kontrolki minimum 44×44 px, etykiety `aria-label`.

## Wygląd

Prosto i sportowo, jedna kolumna, maksymalnie 640 px szerokości, mobile-first. Spokojna paleta (granat jako akcent, zielony dla „zrobione"), czytelna typografia (np. Barlow / Barlow Condensed lub system-ui). Żadnych zbędnych ozdobników. Najważniejsze elementy (cel serii, pola, checkbox) mają być największe.

## Technologia i hosting (założenia, zweryfikuj)

Hosting to **serwer z FTP** + repozytorium na **GitHubie**. Nie zakładaj, że mogę uruchomić Node.js na serwerze. Zaproponuj i zaimplementuj najprostszy wariant, który działa na typowym hostingu współdzielonym:

- **Front**: statyczna aplikacja (Vite + React + TypeScript albo vanilla TS), build do folderu `dist/`, który wrzucam przez FTP.
- **Backend**: pojedynczy plik/folder **PHP 8** z lekkim API JSON i bazą **SQLite** (PDO) lub MySQL, jeśli SQLite niedostępne. Baza poza katalogiem publicznym albo zabezpieczona `.htaccess`.
- Jeśli moje założenie o PHP jest złe, **zapytaj mnie, zanim zaczniesz**, i zaproponuj alternatywę (np. Supabase + statyczny front na GitHub Pages).
- **GitHub Actions**: workflow, który po pushu na `main` buduje front i wgrywa pliki przez FTP/SFTP (sekrety `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_DIR` w GitHub Secrets). Plik bazy i `config.php` z hasłem **nie mogą** być nadpisywane ani trafiać do repo.

### Logowanie

Jeden użytkownik, jedno hasło. Hasło trzymane jako hash (`password_hash`) w `config.php` poza repo (w repo tylko `config.example.php`). Po zalogowaniu bezpieczne ciasteczko sesji (HttpOnly, Secure, SameSite=Lax) ważne 90 dni, żeby nie wpisywać hasła na każdej siłowni. Ogranicz próby logowania (rate limit). Wszystkie endpointy API poza loginem wymagają sesji. Zabezpiecz przed CSRF (token lub SameSite + nagłówek własny).

### Model danych (propozycja)

Tabela `set_logs`: `id`, `week`, `day_index`, `exercise_order`, `set_index`, `is_extra` (0/1), `done` (0/1), `reps` (tekst lub liczba), `weight_kg` (liczba, nullable), `result_text` (dla `singleResult`), `updated_at`. Klucz unikalny `(week, day_index, exercise_order, set_index)`.
Tabela `week_notes`: `week`, `text`, `updated_at`.
Tabela `max_values`: `key` (M/N/O + typ pompki/podciągania), `value`, `source` (dzień/sesja), `updated_at`. Możesz też wyliczać z `set_logs`.

API (przykład): `POST /api/login`, `POST /api/logout`, `GET /api/progress?week=3` (wszystkie wyniki tygodnia), `PUT /api/set` (upsert jednej serii), `DELETE /api/set`, `PUT /api/note`, `GET /api/export?format=json|csv`. Upsert idempotentny, ostatni zapis wygrywa.

## Zasady jakości

- Nie zmieniaj treści planu ani liczby serii. Plan jest narzucony przez trenera, aplikacja ma go tylko wiernie wyświetlać i liczyć M/N/O.
- Aplikacja ma działać na telefonie w przeglądarce (iOS Safari, Android Chrome). Dodaj manifest PWA, żeby dało się dodać ikonę do ekranu głównego (offline nie jest wymagany).
- Napisz krótki `README.md` po polsku: instalacja, konfiguracja `config.php`, ustawienie sekretów GitHub, pierwsze wdrożenie przez FTP, kopia zapasowa bazy.
- Dodaj proste testy dla logiki przeliczania M/N/O, wyznaczania dzisiejszego dnia (włącznie z weekendem i datami przed startem i po końcu planu) i liczenia postępu.
- Na koniec uruchom aplikację lokalnie, przejdź przykładowy trening (odhacz serie, zmień powtórzenia, dodaj serię, przeładuj stronę) i potwierdź, że dane zostały zapisane.

## Zanim zaczniesz

Przejrzyj `data/plan-spkp.json`, wypisz wątpliwości (szczególnie reguły M/N/O i dni MAX) i zadaj mi maksymalnie kilka konkretnych pytań. Potem zbuduj całość.
