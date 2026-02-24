# Desktop App — User Preferences Integration

Prompt document for implementing user preferences in the Ternity desktop app. Framework-agnostic — applies to Electron, Tauri, Flutter, or any other desktop stack. Covers the API contract, data model, caching strategy, theme/scale application, and the timer switch confirmation flow.

---

## 1. API Contract

Base URL: `https://api.ternity.xyz` (prod) / `https://dev.api.ternity.xyz` (dev)

All requests require `Authorization: Bearer <jwt>` header. Preferences are always for the **real authenticated user**, not an impersonated user — the server resolves this automatically via `request.auth.realUserId ?? request.auth.userId`.

### GET /api/user/preferences

Returns the full preferences object with server-side defaults filled in for any missing keys.

**Response (200):**
```json
{
  "theme": "ternity-dark",
  "scale": 1.1,
  "confirmTimerSwitch": true,
  "defaultProjectId": null
}
```

### PATCH /api/user/preferences

Partial update — send only the keys you want to change. Returns the full merged preferences object.

**Request body** (any subset of keys):
```json
{
  "theme": "midnight"
}
```

**Response (200):**
```json
{
  "theme": "midnight",
  "scale": 1.1,
  "confirmTimerSwitch": true,
  "defaultProjectId": null
}
```

---

## 2. Data Model

### JSON Schema

```json
{
  "theme":              { "type": "string",           "default": "ternity-dark" },
  "scale":              { "type": "number",           "default": 1.1 },
  "confirmTimerSwitch": { "type": "boolean",          "default": true },
  "defaultProjectId":   { "type": ["string", "null"], "default": null }
}
```

The shared TypeScript package (`@ternity/shared`) defines this as a Zod schema. For non-TS stacks (e.g., Flutter/Dart), re-implement validation from the JSON schema above.

### Preference Fields

| Key | Type | Default | What it controls |
|---|---|---|---|
| `theme` | `string` (ThemeId) | `"ternity-dark"` | Active color theme |
| `scale` | `number` | `1.1` | UI scale factor (0.9 / 1.1 / 1.2) |
| `confirmTimerSwitch` | `boolean` | `true` | Show confirmation dialog when switching timers |
| `defaultProjectId` | `string \| null` | `null` | Pre-selected project for new timers/entries |

### Available Themes

```json
[
  { "id": "ternity-dark",   "name": "Ternity Dark",   "type": "dark",  "badge": "default" },
  { "id": "ternity-light",  "name": "Ternity Light",  "type": "light", "badge": "essential" },
  { "id": "midnight",       "name": "Midnight",        "type": "dark",  "badge": null },
  { "id": "warm-sand",      "name": "Warm Sand",       "type": "light", "badge": null },
  { "id": "carbon",         "name": "Carbon",          "type": "dark",  "badge": null },
  { "id": "high-contrast",  "name": "High Contrast",   "type": "dark",  "badge": "a11y" }
]
```

The `type` field (`"dark"` or `"light"`) determines the base color scheme. Use it to control:
- **Web-based renderers** (Electron, Tauri): Tailwind dark mode class + `data-theme` attribute
- **Native UI** (Flutter, native frames): system dark/light mode, `ThemeData.brightness`, native titlebar style
- **OS integration**: tray icon variant, native dialogs, system theme hints

### Available Scales

```json
[
  { "label": "Compact",     "value": 0.9 },
  { "label": "Default",     "value": 1.1 },
  { "label": "Comfortable", "value": 1.2 }
]
```

Scale is a multiplier. The baseline is `1.1` (not `1.0`). Closed set — only these three values are valid.

---

## 3. Lifecycle Flow

### Startup

```
1. Read preferences from local persistent cache
   → Apply theme + scale immediately (prevents flash of wrong theme)

2. After auth completes → GET /api/user/preferences
   → Server values override local cache
   → Update local cache
   → Re-apply theme + scale if they changed
   → Set "hasSynced" flag to true
```

### On Preference Change (user action)

```
1. Update in-memory state immediately (instant UI response)
2. Write to local persistent cache immediately
3. Apply visual side effects (theme, scale)
4. Debounced PATCH to server (300ms trailing)
   → Multiple rapid changes collapse into one request
   → Accumulate changed keys, send as single partial PATCH
   → Fire-and-forget — local state is already correct
```

### Debounce

The desktop app must debounce PATCH calls. Without this, clicking through 6 themes fires 6 HTTP requests. With a 300ms trailing debounce, the user browses freely and only the final selection is sent.

**Pseudocode (language-agnostic):**
```
pendingPatch = {}
patchTimer = null

function schedulePatch(changedFields):
    if not hasSyncedFromServer:
        return  // CRITICAL: never push before initial GET

    merge changedFields into pendingPatch
    cancel patchTimer
    patchTimer = setTimeout(300ms):
        toSend = pendingPatch
        pendingPatch = {}
        httpPatch("/api/user/preferences", toSend)
            .catch(() => {})  // silent failure
```

**Critical guard — `hasSyncedFromServer`:** Never push preferences to the server before the initial `GET` completes. Otherwise stale local defaults could overwrite the user's actual server-side preferences. Set this flag to `true` only after the first successful `GET /api/user/preferences`.

---

## 4. Local Persistent Cache

Store preferences as a single JSON object in the platform's persistent storage:

| Stack | Storage mechanism |
|---|---|
| Electron | `electron-store`, or `localStorage` in renderer |
| Tauri | `tauri-plugin-store` |
| Flutter | `shared_preferences` or `hive` |
| Generic | JSON file in app data directory |

```json
{
  "theme": "ternity-dark",
  "scale": 1.1,
  "confirmTimerSwitch": true,
  "defaultProjectId": null
}
```

**Multi-window note:** If the app has multiple windows (main window + tray popup), preferences must be shared. Options:
- Store in the main/backend process, expose via IPC/events
- Use a file-based store that both windows read from
- Use the web app's `localStorage` if both windows share the same origin

The web app uses `localStorage` key `"ternity-preferences"`. If your desktop app embeds the web app in a webview, the web app will manage its own localStorage — you may need to bridge between native storage and webview storage.

---

## 5. Applying Theme & Scale

### Theme — Web-Based Renderers (Electron, Tauri)

Two things must happen when the theme changes:

1. **Set `data-theme` attribute** on `<html>`:
   ```
   document.documentElement.setAttribute('data-theme', 'midnight');
   ```
   This switches all CSS custom properties defined in `themes.css`.

2. **Toggle `dark` class** based on the theme's `type` field:
   ```
   document.documentElement.classList.toggle('dark', type === 'dark');
   ```
   This controls Tailwind's dark mode and shadcn component variants.

### Theme — Native Renderers (Flutter)

Map the theme `id` to your native theme system:
- Use `type` (`"dark"` / `"light"`) to set `ThemeData.brightness`
- Map each theme `id` to a `ColorScheme` with the corresponding palette from `themes.css`
- Set the system UI overlay style (status bar, navigation bar) based on `type`

### Theme — Native OS Elements (all frameworks)

Regardless of renderer, native OS elements need to respect the theme:
- **Window titlebar / frame**: set to dark or light based on `type`
- **Tray icon**: use light variant for dark themes, dark variant for light themes
- **Native dialogs**: follow the `type` preference

### Scale — Web-Based Renderers

Set the CSS custom property on `<html>`:
```
document.documentElement.style.setProperty('--t-scale', '0.9');
```

The formula used throughout the web app:
```css
font-size: calc(13px * var(--t-scale, 1.1) / 1.1);
```

So `1.1` = baseline (100%), `0.9` = compact (~82%), `1.2` = comfortable (~109%).

For tray popups at fixed pixel sizes, you may also want to apply scale as a zoom factor on the webview.

### Scale — Native Renderers (Flutter)

Apply as a global text scale factor:
```dart
MediaQuery(
  data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale / 1.1)),
  child: child,
)
```

Or define scaled values in your theme: `baseFontSize * (scale / 1.1)`.

---

## 6. Timer Switch Confirmation Flow

This is the most behaviorally nuanced preference. The desktop app must replicate this exactly.

### What it controls

When a user starts a new timer while another timer is already running, the `confirmTimerSwitch` preference determines whether a confirmation dialog appears.

### Decision flow

```
User clicks "play" on an entry
  └─ Is another timer currently running?
       ├─ No → start the timer immediately
       └─ Yes → read confirmTimerSwitch from local cache
            ├─ false → switch immediately (stop old, start new) with no dialog
            └─ true → show Switch Timer dialog
                        ├─ User clicks "Cancel" → nothing happens
                        └─ User clicks "Switch"
                             ├─ "Don't ask again" unchecked → switch timers
                             └─ "Don't ask again" checked → switch timers
                                  AND set confirmTimerSwitch = false
                                  (persists to local cache + server)
```

### Reading the preference at decision time

The preference must be read **synchronously from the local cache** at the moment the user clicks play — not from async state that may be stale. Pseudocode:

```
function handlePlayClick(entryId):
    if currentTimer.isRunning AND currentTimer.entryId != entryId:
        if readFromCache("confirmTimerSwitch") == true:
            showSwitchDialog(entryId)
            return
    startTimer(entryId)
```

### "Don't ask again" — persisting from a callback

When the user checks "Don't ask again" and confirms, three things must happen:

1. **Write to local cache immediately** — so the very next play-click reads `false`
2. **Update in-memory/reactive state** — so the Settings UI reflects the change without a reload
3. **Push to server** — so the preference syncs across devices (via the debounced PATCH)

The web app uses a sync helper + event bridge for this. In the desktop app, use whatever mechanism bridges imperative callbacks to your reactive state layer:

| Stack | Mechanism |
|---|---|
| Electron | IPC to main process, or `CustomEvent` in renderer |
| Tauri | Tauri event system (`emit` / `listen`) |
| Flutter | Update provider/notifier directly, or use an event bus |

### Why this matters for the tray / mini player

The tray popup is the primary desktop interaction surface. Users will frequently click play on entries from the tray. The switch confirmation must work there, not just in the main window. Ensure:

- The tray window can **read** `confirmTimerSwitch` synchronously from the shared cache
- The tray window can **write** `confirmTimerSwitch = false` when "don't ask again" is selected
- The change **propagates** to the main window's state (if open) and to the server

---

## 7. Impersonation Note

Preferences always belong to the **real (admin) user**, not the impersonated target. The API handles this server-side — it uses `request.auth.realUserId ?? request.auth.userId` to determine whose preferences to read/write.

The desktop app doesn't need special handling for this as long as it sends the standard auth headers. The server does the right thing.

---

## 8. Error Handling

Preferences are a **best-effort sync**. The local cache is the source of truth for UX — the server is for cross-device persistence.

- `GET` fails on startup → use local cache (or defaults if no cache exists)
- `PATCH` fails after a change → ignore silently (local state is already updated)
- No network connectivity → everything works offline from local cache, syncs on reconnect

Never block the UI or show errors for preference sync failures.

---

## 9. Future Preferences

New preferences will be added to the schema with defaults. The `GET` endpoint always returns a complete object even if the database JSONB is missing keys (server-side defaults fill the gaps). The desktop app should:

- Handle **unknown keys** gracefully (ignore them — forward compatibility)
- Handle **missing keys** by falling back to defaults from the schema
- Never reject or error on unexpected shape — just use what's valid and default the rest
