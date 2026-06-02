# Raport ze znalezisk z testów mutacyjnych — `apps/api`

> Data pierwszego pełnego runu: **2026-06-02**, 19 minut, 5617 mutantów, 38 plików.
> Wynik baseline: **72.24% total / 86.67% covered**.

Ten raport opisuje **co realnie znaleźliśmy**, gdy puściliśmy testy mutacyjne na cały backend. Nie jest to lista TODO — to **diagnoza stanu siatki testowej**: gdzie testy są ostre, gdzie są luźne, gdzie ich w ogóle nie ma, i co z tego wynika.

## Czym jest mutacja, w jednym akapicie

Stryker celowo psuje kod źródłowy w setkach miejsc (zamienia `>` na `>=`, podmienia string na pusty, usuwa blok `if`) i za każdym razem uruchamia testy. Jeśli testy po zepsuciu kodu przeszły, znaczy że nie sprawdzały tego, czego się spodziewałeś. Pojedyncza zmiana to **mutant**. Statystycznie raportujemy dwie liczby:
- **Total** karze za nieprzetestowane linie (mutant „no coverage" liczy się jako niezabity).
- **Covered** liczy tylko tam, gdzie testy faktycznie się wykonały — to **właściwa miara jakości testów**.

Pełne wytłumaczenie konceptu jest w `docs/production-readiness-progress.md`, sekcja flow.

## Headline — co wyszło z pierwszego pełnego runu

Per kategoria pliku:

| Obszar | Total | Covered | Komentarz |
|---|---|---|---|
| `sync/transform/` | 93.64% | 93.64% | Charakteryzacja transformacji świetna, kilka plików 100% |
| `routes/entries.ts` | 84.49% | **98.15%** | Największy plik tras, testy prawie idealne |
| `routes/jira.ts` | 28.80% | **90.82%** | Niski total bo branch ekstrakcji tokenów nie pokryty, ale invarianty z S2 (escapowanie JQL) trzymają jakość gdzie są |
| `plugins/` | 81.49% | 86.09% | `error-simulation` i `viewer-mode` po 100% |
| `routes/leave.ts` | 73.29% | 86.61% | Solidnie |
| `lib/error-handler.ts` | 47.06% | **44.44%** | **Realna luka jakościowa — opisana niżej, naprawiona** |
| `routes/me.ts` | 6.78% | **44.44%** | **Realna luka pokrycia — ścieżka Logto nietknięta** |
| `services/notification-content.ts` | 62.22% | 63.16% | Mieszanka 4 realnych bugów + 45 mutantów równoważnych |
| `services/email.ts`, `sms.ts` | 0% | 0% | Brak testów — decyzja architektoniczna |

## Znaleziska — realne bugi (lub bliskie-bugowi luki testowe)

### 1. `lib/error-handler.ts` — kontrakt response body nieasertowany + ukryta pułapka logiczna

**Co znaleziono:** 9 ocalałych mutantów. **38 testów uderzało w ścieżkę walidacji Zod**, ale **żaden nie asertował treści ciała odpowiedzi błędu**. Tylko `expect(status).toBe(400)`. Z tego:

**Pięć mutantów display-szyldów** (pola `error`, `code`, treść logu, struktura body). To nie są bugi same w sobie — to **brak kontraktu**. Jeśli ktoś jutro przepisze handler i zacznie zwracać `{message: "..."}` zamiast `{error: "..."}`, frontend się rozsypie, a żaden test nie wywali.

**Cztery mutanty na linii 26–27** — w tym **jeden realny, ukryty bug logiczny**:

```ts
error: error.message ?? 'Internal server error',
```

Mutant zamienia `??` na `&&`. Pozornie kosmetyka, w praktyce:

| Wartość `error.message` | Oryginał (`??`) | Mutant (`&&`) |
|---|---|---|
| `'coś'` | `'coś'` | `'Internal server error'` |
| `''` (pusty) | `''` | `''` |
| `undefined` | `'Internal server error'` | **`undefined`** |

W produkcji ktoś rzuca `throw new Error()` bez argumentu (przypadek bardzo realny, np. w `catch`-u który zapomina przekazać oryginalny error). **Oryginał** zwraca normalny komunikat fallback. **Mutant** zwraca pusty obiekt: `{error: undefined, code: undefined}`. Frontend pokazuje „undefined" albo pustkę. **Żaden istniejący test by tego nie złapał.**

Identyczna luka dla `error.code ?? 'INTERNAL_ERROR'`.

**Co zrobiliśmy:** dodaliśmy `lib/error-handler.test.ts` — 3 testy, które:
1. Asertują pełną strukturę body dla `ZodError`.
2. Rzucają `new Error()` z `.message = undefined` i asertują że dostajemy fallback `'Internal server error'`.
3. Rzucają `Error` z `.statusCode`, `.message`, `.code` i asertują że są forwardowane.

**Wynik:** error-handler **44.44% → 88.89% covered**. Z 9 survivorów zostały 2 — obie to mutacje na `request.log.warn(...)` (treść logu), świadomie pominięte, bo to obserwabilność a nie zachowanie.

### 2. `services/notification-content.ts` — dzień tygodnia w cotygodniowym mailu

**Co znaleziono:** 49 ocalałych mutantów. Z tego **4 to realne bugi**, reszta to equivalent mutants (opisane niżej).

Cztery realne dotyczą tej linii (linie 85 i 88 pliku):

```ts
preheader: `Your weekly summary (${day === 'monday' ? 'Monday' : 'Friday'} delivery).`,
meta: `Delivery day: ${day === 'monday' ? 'Monday' : 'Friday'}`,
```

Mutanty: `===` → `!==`, ternary zawsze do `'Monday'`, ternary zawsze do `'Friday'`. Wszystkie przeżyły, bo **istniejące testy asertowały tylko `subject`** (`'[Ternity] Weekly hours report'`), ale nigdy nie sprawdzały, czy preheader i meta odzwierciedlają wybraną przez użytkownika konfigurację dnia.

**Konkretny user-visible scenariusz:** użytkownik konfiguruje dostawę raportu na piątek. Piątek rano dostaje mail. Preheader (widoczny od razu na liście maili w Gmailu): „Your weekly summary (**Monday** delivery)". Wsparcie dostaje zgłoszenie „chyba dostałem cudzy raport / chyba bug w aplikacji". Realny incydent obsługowy.

**Co zrobiliśmy:** dwa testy w `notification-content.test.ts`, jeden dla `day: 'monday'`, jeden dla `day: 'friday'`. Asertują że `html` i `text` zawierają **właściwą** nazwę dnia i **nie zawierają** tej drugiej.

**Wynik:** notification-content **63.16% → 68.42% covered**. Skok mały bo pozostałe 45 mutantów to equivalent — wytłumaczone niżej.

### 3. `routes/me.ts` — cała ścieżka Logto nietestowana (NIE NAPRAWIONE w tej rundzie)

**Co znaleziono:** plik ma **6.78% total / 44.44% covered**. Pięć ocalałych mutantów na linii 11 (warunek wejścia w blok Logto) + **50 mutantów „no coverage"** w środku tego bloku.

Diagnoza: blok pod `if (process.env.AUTH_MODE === 'logto' && logtoEndpoint)` odświeża awatar użytkownika z Logto (pobiera token managementu, robi fetch do Logto API, aktualizuje DB). W trybie testowym używamy `stub`, więc do tego bloku nigdy nie wchodzimy. Wszystkie testy `/api/me` testują tylko ścieżkę stub.

Konsekwencja: gdyby ktoś jutro rozwalił logikę odświeżania awatara (np. źle skonstruował URL Logto, dał złe nagłówki, źle wyparsował response), testy nic by nie powiedziały. Bug objawiłby się dopiero u prawdziwego użytkownika Logto w produkcji.

**Dlaczego nie naprawiamy teraz:** to wymaga infrastruktury testowej:
- przełączenie `AUTH_MODE` na `'logto'` na czas testu,
- mock globalnego `fetch`,
- mock `getManagementToken` z `auth.ts`,
- przygotowanie fixture'ów odpowiedzi Logto API.

To godzina-dwie pracy, osobna decyzja. Recommendation: **najwyższy priorytet w kolejnej rundzie**, większy niż dobijanie pojedynczych survivorów w innych plikach.

### 4. `services/email.ts`, `services/sms.ts` — zerowe pokrycie (świadoma decyzja)

Te dwa pliki to **wrappery na zewnętrzne API** (Resend dla emaili, Twilio dla SMS). 0% mutation score, ale to **nie jest luka jakościowa** — to **decyzja architektoniczna**.

Testujemy te wrappery **pośrednio** poprzez `notification-content.ts` (z mockowanym Resend/Twilio na poziomie wywołania). Bezpośrednie testy wrapperów dałyby niewielką dodatkową wartość — testowałyby głównie poprawność konstrukcji obiektu requestu do bibliotek zewnętrznych, czego i tak nie da się zweryfikować bez prawdziwego API.

**Recommendation:** zostawić bez zmian. Jeśli kiedyś zaczną się bugi typu „SMS przyszedł z złym formatem numeru", dopiero wtedy pokryć ten konkretny aspekt.

## Co świadomie zostawiamy — mutanty równoważne

To są mutanty, które **nie zmieniają obserwowalnego zachowania programu**. „Naprawienie" ich wymagałoby testów-tautologii.

### `reports.ts` (14 survivorów)
Wszystkie to mutacje stringów display w deklaracji szablonów PDF, np.:
```ts
{ id: 'classic-corporate', name: 'Classic Corporate' → "", description: '...' → "" }
```
Test typu `expect(template.name).toBe('Classic Corporate')` to dosłownie kopia ze źródła w teście. Nie chroni przed niczym poza brakiem dyscypliny przy zmianie nazwy szablonu (a to akurat warto móc zmieniać bez wywalania testów).

### `notification-content.ts` (~45 survivorów)
Mutacje treści powiadomień email/SMS:
- `subject: '[Ternity] Forgot to stop timer' → ""`
- `body: 'Your timer still appears to be running...' → ""`
- `ctaLabel: 'Stop timer in Ternity' → ""`

To są **content marketingowy**. Pinowanie ich w testach to wiązanie sobie rąk przy aktualizacjach treści. **Jeden wyjątek** byłby zasadny: lock na prefiks `'[Ternity]'` w każdym subject (kontrakt z marketingiem, że wszystkie maile Ternity są rozpoznawalne). Ale to **decyzja produktowa**, nie techniczna — i można ją łatwo egzekwować jednym małym testem osobno, bez wbijania się w mutację per linia.

### `lib/error-handler.ts` (2 pozostałe survivory)
Mutacje treści logu — zamiana `{issues: error.issues}` na `{}` i `'Request validation failed'` na `""`. To **observability, nie zachowanie**. Brak testów na zawartość logów jest standardową decyzją — testowanie tego wymaga log-spies i ogromnej infrastruktury, a wartość niska.

## Lekcje z procesu mutacji (do zapisania na przyszłość)

Trzy rzeczy, które warto pamiętać przy przyszłej pracy:

**1. `parse()` w `describe`-scope to ukryty anti-pattern.**
Jeśli setup poza `it()` rzuci wyjątek (np. bo zmutowany schemat się nie sparsował), Vitest raportuje to jako „file failed", ale liczba `Tests passed` zostaje. Stryker patrzy tylko na passed/failed i uznaje mutanta za przeżyłego. **Zawsze parsować w środku `it()`.**

Konsekwencja: faza 2 mutacji na `shared` początkowo dawała mylące wyniki — survivory były artefaktem złej struktury testów, nie luką w jakości. Refaktor `notification-settings.test.ts` na parse-w-it() podniósł score z 60% na 100%.

**2. CLI `--mutate <glob>` zastępuje cały zestaw glob-ów.**
Wykluczenia w `stryker.config.json` (np. `!src/**/*.test.ts`) nie są stosowane gdy używasz flagi. Konsekwencja: pliki testowe zostają zmutowane. Konfig JSON to **konfig jedyny prawdziwy**.

**3. Strażniki skanujące źródła kolidują z instrumentacją Strykera.**
Test który czyta pliki źródłowe z dysku (jak nasz `body-validation.guard`) dostaje w sandboxie Strykera kod **opakowany** w `globalThis.__activeMutant__ === N ? mutated : original`. To zawiera surowe odwołania do `request.body`, które guard widzi jako naruszenia. **Pomijać guard-testy w sandboxie Strykera** (sprawdziliśmy: `process.cwd().includes('.stryker-tmp')`).

## Stan końcowy

Co zrobione w tej rundzie:
- 5 nowych testów (3 dla error-handler, 2 dla notification-content)
- 9 realnych mutantów zabitych, w tym jeden ukryty bug logiczny (`?? → &&`)
- `error-handler.ts` 44.44% → **88.89% covered**
- `notification-content.ts` 4 realne bugi z dnia tygodnia załatane

Co zostawiamy świadomie:
- ~60 mutantów równoważnych (display strings) — zostają jako survivory, opisane wyżej
- 2 mutanty na logach — observability, nie zachowanie

Co wymaga osobnej decyzji:
- **`routes/me.ts` ścieżka Logto** — największa luka pokrycia, wymaga infrastruktury mocków. Następny krok.
- Wrappery `email.ts`/`sms.ts` — decyzja architektoniczna, prawdopodobnie zostają bez bezpośrednich testów.

## Co to wszystko mówi szerzej

Mutation testing po raz pierwszy realnie się odpłaciło tu na trzech wymiarach:

**Znalazło prawdziwy ukryty bug logiczny.** `??` vs `&&` na fallbacku `error.message` — to nie była luka w kodzie (kod jest poprawny), ale **luka w teście**, która pozwoliłaby na cichy regression. To ten typ znaleziska, którego żadna inna technika (linting, type-checking, code review) nie wyłapie.

**Odróżniło realne braki od mutantów równoważnych.** Liczba 49 survivorów w `notification-content.ts` na pierwszy rzut oka wygląda alarmująco. Po przeglądzie: 4 realne (naprawione), 45 to display content (zostawione świadomie). Mutacja **wymusza tę dyscyplinę** — patrzysz na każdy survivor i odpowiadasz „bug w teście, czy mutant równoważny". Tej refleksji nie ma w zwykłym pisaniu testów.

**Pokazała gdzie jest realna luka pokrycia.** `me.ts` 6.78% wygląda jak katastrofa, ale po analizie: jeden konkretny blok side-effectu (refresh awatara Logto) nie ma żadnego testu. To **jedno zadanie**, nie pięćdziesiąt.

**Czego mutation testing nie zrobi:** nie powie czy kod robi to, co miał robić od strony biznesowej. Tylko pinuje aktualne zachowanie. Jeśli oryginalnie napisałeś bug i pinujesz go testami — mutacja **nie pomoże**. Pomoże dopiero **przegląd survivorów przez człowieka, który zna intencję**. Bo to przy tym przeglądzie zauważyliśmy, że `??` vs `&&` to nie kosmetyka.
