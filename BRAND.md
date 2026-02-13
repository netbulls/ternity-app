# Ternity — Brand Guidelines

> Single source of truth for the Ternity visual identity.
> All projects in the Ternity ecosystem should reference this file.

---

## 1. Brand Concept

**Name:** Ternity
**Tagline concept:** Tasks falling through time — getting things done.

The logo is a **Sand Dots Hourglass** — an hourglass outline with organic, varied-size dots tumbling inside. The dots represent tasks of different priorities and sizes flowing through time.

---

## 2. Logo

### 2.1 Symbol (Icon)

The standalone hourglass mark. Use when space is tight (favicons, app icons, avatars).

**SVG source of truth:** `assets/logo.svg`

```
viewBox: 0 0 100 120
Outline: M18 5 L82 5 L62 48 L82 95 L18 95 L38 48Z
         stroke-width: 5, stroke-linejoin: round, fill: none
Dots:
  cx=50  cy=32  r=6
  cx=49  cy=52  r=7.5
  cx=54  cy=67  r=5.5
  cx=44  cy=77  r=7
  cx=56  cy=83  r=6
```

### 2.2 Wordmark

"TERNITY" rendered as SVG paths from **Oxanium SemiBold (600)**. No font dependency — all glyphs are embedded as `<path>` elements.

**SVG source of truth:** `assets/wordmark.svg`

### 2.3 Logo Combo (Symbol + Wordmark)

Horizontal lockup — symbol on the left, wordmark on the right. This is the **primary brand mark** for headers, splash screens, and marketing.

**SVG source of truth:** `assets/logo-combo.svg`

**Proportions (do not alter):**
- Symbol: 100 x 120 units
- Gap between symbol and wordmark: 18 units
- Wordmark scaled to 80% of symbol height (58.4/73), centered on hourglass waist
- Total lockup: 444 x 120 units

---

## 3. Logo Variants

All variants use identical geometry. Only the fill/stroke colors change.

### Symbol Only (`assets/logo*.svg`)

| File | Colors | Use on |
|---|---|---|
| `logo.svg` | Electric Teal `#00D4AA` | Dark or light backgrounds (primary) |
| `logo-white.svg` | White `#ffffff` | Dark backgrounds only |
| `logo-dark.svg` | Charcoal `#1A1A1A` | Light backgrounds only |

### Wordmark Only (`assets/wordmark*.svg`)

| File | Color | Use on |
|---|---|---|
| `wordmark.svg` | Electric Teal `#00D4AA` | Dark or light backgrounds |
| `wordmark-white.svg` | White `#ffffff` | Dark backgrounds only |
| `wordmark-dark.svg` | Charcoal `#1A1A1A` | Light backgrounds only |

### Logo Combo (`assets/logo-combo*.svg`)

| File | Icon | Text | Use on |
|---|---|---|---|
| `logo-combo.svg` | Teal `#00D4AA` | White `#ffffff` | **Primary — dark backgrounds** |
| `logo-combo-teal.svg` | Teal `#00D4AA` | Teal `#00D4AA` | Dark backgrounds (monochrome) |
| `logo-combo-white.svg` | White `#ffffff` | White `#ffffff` | Dark/colored backgrounds |
| `logo-combo-dark.svg` | Charcoal `#1A1A1A` | Charcoal `#1A1A1A` | Light backgrounds |

### Which variant to use

| Context | Variant |
|---|---|
| Website header on dark background | `logo-combo.svg` (teal icon + white text) |
| Website header on light background | `logo-combo-dark.svg` |
| Favicon / app icon | `logo.svg` (symbol only) |
| Social media avatar | `logo.svg` or `logo-white.svg` |
| Email signature | `logo-combo.svg` or `logo-combo-dark.svg` |
| Print on white paper | `logo-combo-dark.svg` |
| Print on dark material | `logo-combo-white.svg` |
| Watermark / overlay on photos | `logo-combo-white.svg` at reduced opacity |

---

## 4. Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|---|---|---|---|
| **Electric Teal** | `#00D4AA` | 0, 212, 170 | Primary brand, icon, accents, CTAs |
| **White** | `#ffffff` | 255, 255, 255 | Text, headings, wordmark |
| **Deep Charcoal** | `#0a0a0a` | 10, 10, 10 | Primary background |

### Secondary / UI Colors

| Name | Hex | Usage |
|---|---|---|
| Charcoal | `#1A1A1A` | Logo dark variant, cards, surfaces |
| Muted Text | `rgba(255,255,255,0.5)` | Secondary text on dark backgrounds |
| Subtle Text | `rgba(255,255,255,0.25)` | Captions, labels |
| Divider | `#141414` | Borders, section dividers |

### Teal Glow Effects (for hero/emphasis)

```css
/* Soft glow */
filter: drop-shadow(0 0 30px rgba(0, 212, 170, 0.5));

/* Intense glow */
filter: drop-shadow(0 0 55px rgba(0, 212, 170, 0.8));

/* Pulsing animation */
@keyframes pulse {
  0%, 100% { filter: drop-shadow(0 0 30px rgba(0, 212, 170, 0.5)); }
  50%      { filter: drop-shadow(0 0 55px rgba(0, 212, 170, 0.8)); }
}
```

---

## 5. Typography

### Brand Font

**Oxanium** — a rounded, futuristic typeface that balances approachability with professionalism.

| Property | Value |
|---|---|
| Family | `Oxanium` |
| Source | [Google Fonts](https://fonts.google.com/specimen/Oxanium) |
| Weight | 600 (SemiBold) for brand use |
| Style | Normal |

### Text Styling Rules

| Context | Weight | Letter-spacing | Transform | Size guidance |
|---|---|---|---|---|
| Wordmark / logo | 600 | 5px | uppercase | Per lockup ratio |
| Page headings (H1) | 700 | 2–4px | uppercase | 36–60px |
| Section headings (H2) | 600 | 2px | uppercase | 24–36px |
| Body text | 400 | 0 | none | 16–18px |
| Captions / labels | 400 | 1–2px | uppercase | 10–12px |

### Font Loading (Web)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@400;600;700&display=swap" rel="stylesheet">
```

```css
font-family: 'Oxanium', sans-serif;
```

### Fallback Stack

```css
font-family: 'Oxanium', 'Chakra Petch', 'Rajdhani', system-ui, sans-serif;
```

---

## 6. Logo Usage Rules

### Minimum Sizes

| Format | Minimum width |
|---|---|
| Symbol only | 16px |
| Logo combo | 120px |
| Wordmark only | 80px |

### Clear Space

Maintain a clear zone around the logo equal to the height of one dot (the largest dot, r=7.5 in symbol units). No other elements, text, or imagery should intrude into this zone.

For the combo lockup, the clear space applies to the entire bounding box.

### Do NOT

- Rotate or skew the logo
- Change the proportions between symbol and wordmark
- Rearrange the dots or change their sizes
- Place the teal logo on a teal or green background
- Add outlines, borders, or extra effects to the logo
- Use the white variant on light backgrounds
- Use the dark variant on dark backgrounds
- Recreate the wordmark in a different font — always use the SVG paths
- Animate individual dots separately from the hourglass
- Crop the hourglass outline

---

## 7. Imagery Style

The brand uses a dark, atmospheric aesthetic with variety across these styles:

- **Cinematic photography** — moody lighting, shallow depth of field
- **Surreal / conceptual** — dreamlike scenes with time motifs
- **Macro / detail** — extreme close-ups of time-related textures
- **Abstract / generative** — particle flows, liquid forms, bioluminescence
- **Architectural** — impossible geometry, dramatic perspectives

**Color treatment for images:**
- Lean into teal (`#00D4AA`) and warm amber as accent colors
- Dark, desaturated backgrounds
- High contrast, cinematic grading

---

## 8. File Reference

All brand assets live in `assets/` relative to this project root.

```
assets/
├── logo.svg              # Symbol — teal (primary)
├── logo-white.svg        # Symbol — white
├── logo-dark.svg         # Symbol — dark
├── wordmark.svg          # Wordmark — teal
├── wordmark-white.svg    # Wordmark — white
├── wordmark-dark.svg     # Wordmark — dark
├── logo-combo.svg        # Combo — teal icon + white text (PRIMARY)
├── logo-combo-teal.svg   # Combo — all teal
├── logo-combo-white.svg  # Combo — all white
└── logo-combo-dark.svg   # Combo — all dark
```

---

## 9. Quick Reference for Developers

```css
/* Brand colors */
--color-brand: #00D4AA;
--color-text: #ffffff;
--color-bg: #0a0a0a;
--color-surface: #1A1A1A;
--color-divider: #141414;
--color-text-muted: rgba(255, 255, 255, 0.5);
--color-text-subtle: rgba(255, 255, 255, 0.25);

/* Font */
--font-family: 'Oxanium', sans-serif;
--font-weight-normal: 400;
--font-weight-semi: 600;
--font-weight-bold: 700;
```
