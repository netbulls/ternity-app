# Ternity — Theme System

> Defines all supported themes. Each theme is a complete set of design tokens.
> The default theme is **Ternity Dark**. Users can switch themes in app settings.

---

## Themes

| # | Theme | Type | Badge | Description |
|---|---|---|---|---|
| 1 | **Ternity Dark** | dark | default | Brand-native, immersive, focused |
| 2 | **Ternity Light** | light | essential | Clean and bright — daylight, offices, long sessions |
| 3 | **Midnight** | dark | — | Deep blue undertone — calmer, still focused |
| 4 | **Warm Sand** | light | — | Neutral warm — soft on eyes, earthy, premium |
| 5 | **Carbon** | dark | — | Industrial matte — no glow, all business |
| 6 | **High Contrast** | dark | a11y | Maximum readability — WCAG AAA, sharp borders |

---

## Design Tokens

Every theme must define all tokens below. No partial themes — each is self-contained.

### Token Categories

| Category | Tokens | Purpose |
|---|---|---|
| **Backgrounds** | `bg`, `surface`, `elevated`, `sidebar` | Page, cards, modals, sidebar |
| **Text** | `text`, `textSecondary`, `textMuted` | Primary, supporting, subtle |
| **Accent** | `accent`, `accentMuted`, `accentText` | Brand color, tinted backgrounds, text on accent |
| **Borders** | `border`, `borderSubtle`, `sidebarBorder` | Dividers, card edges, sidebar edge |
| **Navigation** | `navActive`, `navActiveText`, `navHover` | Sidebar/nav states |
| **Timer** | `timerBg`, `timerBorder` | Active timer bar |
| **Controls** | `stopBtn`, `stopBtnInner` | Stop button colors |
| **Labels** | `labelBg`, `labelText`, `labelBg2`, `labelText2` | Tag/chip colors (2 built-in styles) |
| **Stats** | `statBg` | Stat card backgrounds |
| **User** | `avatarBg`, `avatarText`, `userBg` | User avatar, user block |
| **Projects** | `projectDot1`, `projectDot2`, `projectDot3` | Project color indicators |

---

## 1. Ternity Dark (Default)

```
bg:             #0a0a0a
surface:        #111111
elevated:       #171717
sidebar:        #0e0e0e
sidebarBorder:  #1a1a1a
text:           #ffffff
textSecondary:  rgba(255,255,255,0.6)
textMuted:      rgba(255,255,255,0.3)
accent:         #00D4AA
accentMuted:    rgba(0,212,170,0.15)
accentText:     #0a0a0a
border:         #1e1e1e
borderSubtle:   #151515
navActive:      rgba(0,212,170,0.1)
navActiveText:  #00D4AA
navHover:       rgba(255,255,255,0.04)
timerBg:        rgba(0,212,170,0.08)
timerBorder:    rgba(0,212,170,0.2)
stopBtn:        #ff4757
stopBtnInner:   #ffffff
labelBg:        rgba(0,212,170,0.12)
labelText:      #00D4AA
labelBg2:       rgba(99,110,255,0.12)
labelText2:     #8B93FF
statBg:         #141414
avatarBg:       #00D4AA
avatarText:     #0a0a0a
userBg:         rgba(255,255,255,0.03)
projectDot1:    #00D4AA
projectDot2:    #8B93FF
projectDot3:    #FFB347
```

## 2. Ternity Light

```
bg:             #f6f7f9
surface:        #ffffff
elevated:       #ffffff
sidebar:        #ffffff
sidebarBorder:  #e8eaed
text:           #1a1a1a
textSecondary:  rgba(0,0,0,0.55)
textMuted:      rgba(0,0,0,0.3)
accent:         #00B893
accentMuted:    rgba(0,184,147,0.1)
accentText:     #ffffff
border:         #e8eaed
borderSubtle:   #f0f1f3
navActive:      rgba(0,184,147,0.08)
navActiveText:  #00B893
navHover:       rgba(0,0,0,0.03)
timerBg:        rgba(0,184,147,0.06)
timerBorder:    rgba(0,184,147,0.2)
stopBtn:        #ff4757
stopBtnInner:   #ffffff
labelBg:        rgba(0,184,147,0.1)
labelText:      #00896D
labelBg2:       rgba(99,110,255,0.08)
labelText2:     #5B63E0
statBg:         #ffffff
avatarBg:       #00B893
avatarText:     #ffffff
userBg:         rgba(0,0,0,0.03)
projectDot1:    #00B893
projectDot2:    #5B63E0
projectDot3:    #E8913A
```

## 3. Midnight

```
bg:             #0c1017
surface:        #121722
elevated:       #18202e
sidebar:        #0e131c
sidebarBorder:  #1c2333
text:           #e2e8f0
textSecondary:  rgba(226,232,240,0.6)
textMuted:      rgba(226,232,240,0.3)
accent:         #00D4AA
accentMuted:    rgba(0,212,170,0.12)
accentText:     #0c1017
border:         #1e2736
borderSubtle:   #161d2a
navActive:      rgba(0,212,170,0.1)
navActiveText:  #00D4AA
navHover:       rgba(255,255,255,0.04)
timerBg:        rgba(0,212,170,0.07)
timerBorder:    rgba(0,212,170,0.18)
stopBtn:        #ff4757
stopBtnInner:   #ffffff
labelBg:        rgba(0,212,170,0.1)
labelText:      #00D4AA
labelBg2:       rgba(120,130,255,0.1)
labelText2:     #9BA2FF
statBg:         #141b28
avatarBg:       #00D4AA
avatarText:     #0c1017
userBg:         rgba(255,255,255,0.03)
projectDot1:    #00D4AA
projectDot2:    #9BA2FF
projectDot3:    #FFBE76
```

## 4. Warm Sand

```
bg:             #f5f2ed
surface:        #faf8f5
elevated:       #ffffff
sidebar:        #faf8f5
sidebarBorder:  #e6e0d8
text:           #2c2620
textSecondary:  rgba(44,38,32,0.55)
textMuted:      rgba(44,38,32,0.3)
accent:         #00B893
accentMuted:    rgba(0,184,147,0.08)
accentText:     #ffffff
border:         #e6e0d8
borderSubtle:   #ede8e2
navActive:      rgba(0,184,147,0.08)
navActiveText:  #00896D
navHover:       rgba(0,0,0,0.03)
timerBg:        rgba(0,184,147,0.06)
timerBorder:    rgba(0,184,147,0.15)
stopBtn:        #e0503e
stopBtnInner:   #ffffff
labelBg:        rgba(0,184,147,0.08)
labelText:      #00896D
labelBg2:       rgba(120,100,200,0.08)
labelText2:     #6B5CA5
statBg:         #faf8f5
avatarBg:       #00B893
avatarText:     #ffffff
userBg:         rgba(0,0,0,0.03)
projectDot1:    #00B893
projectDot2:    #6B5CA5
projectDot3:    #D4883A
```

## 5. Carbon

```
bg:             #161616
surface:        #1c1c1c
elevated:       #242424
sidebar:        #1a1a1a
sidebarBorder:  #2a2a2a
text:           #e0e0e0
textSecondary:  rgba(224,224,224,0.6)
textMuted:      rgba(224,224,224,0.3)
accent:         #42D9A8
accentMuted:    rgba(66,217,168,0.12)
accentText:     #161616
border:         #2e2e2e
borderSubtle:   #222222
navActive:      rgba(66,217,168,0.1)
navActiveText:  #42D9A8
navHover:       rgba(255,255,255,0.04)
timerBg:        rgba(66,217,168,0.07)
timerBorder:    rgba(66,217,168,0.18)
stopBtn:        #DA4453
stopBtnInner:   #ffffff
labelBg:        rgba(66,217,168,0.1)
labelText:      #42D9A8
labelBg2:       rgba(130,140,255,0.1)
labelText2:     #A0A8FF
statBg:         #1e1e1e
avatarBg:       #42D9A8
avatarText:     #161616
userBg:         rgba(255,255,255,0.03)
projectDot1:    #42D9A8
projectDot2:    #A0A8FF
projectDot3:    #F0C060
```

## 6. High Contrast

```
bg:             #000000
surface:        #0a0a0a
elevated:       #1a1a1a
sidebar:        #050505
sidebarBorder:  #333333
text:           #ffffff
textSecondary:  rgba(255,255,255,0.8)
textMuted:      rgba(255,255,255,0.55)
accent:         #00FFD0
accentMuted:    rgba(0,255,208,0.15)
accentText:     #000000
border:         #444444
borderSubtle:   #2a2a2a
navActive:      rgba(0,255,208,0.15)
navActiveText:  #00FFD0
navHover:       rgba(255,255,255,0.08)
timerBg:        rgba(0,255,208,0.1)
timerBorder:    rgba(0,255,208,0.4)
stopBtn:        #ff4757
stopBtnInner:   #ffffff
labelBg:        rgba(0,255,208,0.15)
labelText:      #00FFD0
labelBg2:       rgba(140,150,255,0.15)
labelText2:     #B0B8FF
statBg:         #111111
avatarBg:       #00FFD0
avatarText:     #000000
userBg:         rgba(255,255,255,0.06)
projectDot1:    #00FFD0
projectDot2:    #B0B8FF
projectDot3:    #FFD060
```

---

## Implementation Notes

- Theme is stored as a user preference (persisted in DB, fallback to `ternity-dark`)
- All tokens are exposed as CSS custom properties: `--t-bg`, `--t-surface`, `--t-accent`, etc.
- Components MUST use tokens exclusively — no hardcoded colors
- The `type` field (dark/light) controls OS-level integration (scrollbar style, meta theme-color, etc.)
- Light themes use slightly desaturated accent (`#00B893` vs `#00D4AA`) for better contrast on white
