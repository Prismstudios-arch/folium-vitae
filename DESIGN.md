# DESIGN.md — Visual Direction for Verdure

## Design Philosophy

**The plant photograph is the hero. Everything else is in service to it.**

Verdure competes on honesty, not polish. The design must feel trustworthy, specific, and grounded — like a naturalist's notebook or a botanist's reference guide, not a template. Avoid:
- Bright accent colors on every button
- Identical rounded cards with soft shadows everywhere
- Gradient washes as decoration
- ALL-CAPS eyebrow labels
- Fake urgency or manipulation (countdowns, nudges, "→" glued to buttons)

Instead:
- Deep, intentional color palette (four colors doing real work)
- Photography as content, not decoration
- Asymmetrical layouts that feel considered, not algorithmic
- Type scale with intention (weights, tracking, hierarchy)
- Motion that respects the user's attention
- Empty states and errors as opportunities to delight, not apologise

---

## Color Tokens

### Primary Palette (4 colors)

| Token | Hex | RGB | Use | Contrast Notes |
|---|---|---|---|---|
| `Color.leaf` | `#2D5842` | 45, 88, 66 | Primary brand, trust, save/success states, text on light | Deep sage green; sophisticated but warm |
| `Color.cream` | `#FDFBF8` | 253, 251, 248 | Backgrounds, cards, surfaces, light content | Off-white with yellow undertone (like aged botanical paper) |
| `Color.glass` | `#E8E5E0` | 232, 229, 224 | Borders, dividers, subtle separators, disabled states | Soft grey-brown; feels structural, not cold |
| `Color.soil` | `#8B7355` | 139, 115, 85 | Secondary text, captions, timestamps, metadata | Warm brown; feels grounded and specific |

### Semantic Colors

| Token | Light Value | Dark Value | Use |
|---|---|---|---|
| `Color.confident` | `#2D5842` (leaf) | `#A8D5BA` (light green) | High-confidence badge, "yes" states |
| `Color.probably` | `#B8860B` (goldenrod) | `#FFD700` (gold) | Medium-confidence band, "caution" states |
| `Color.notSure` | `#8B7355` (soil) | `#D4A574` (light tan) | Low-confidence band, "help needed" states |
| `Color.toxicity` | `#A0522D` (sienna) | `#CD9B7F` (light sienna) | Pet/child toxicity warnings (distinct, not panic red) |
| `Color.error` | `#C1412B` (rust red) | `#F4A9A3` (light coral) | Errors, failures, validation (warm, not bright) |
| `Color.success` | `#2D5842` (leaf) | `#A8D5BA` (light green) | Confirmations, saves, success (same as confident) |

### Neutral Palette (dark mode support)

**Light mode:**
- Text primary: `#1A1A1A` (near black, from leaf darkened)
- Text secondary: `#8B7355` (soil)
- Text disabled: `#C5BFB5` (lightened glass)
- Dividers: `#E8E5E0` (glass)
- Backgrounds: `#FDFBF8` (cream)

**Dark mode** (inverted in spirit, not automatic):
- Text primary: `#F5F3F0` (cream lightened)
- Text secondary: `#C8B89D` (soil lightened)
- Text disabled: `#7A7569` (glass darkened)
- Dividers: `#423A32` (glass inverted)
- Backgrounds: `#0F0D0A` (deep charcoal, slight green undertone)

**Photography looks fundamentally different on dark backgrounds.** In dark mode, increase contrast on plant photos (they're the hero); brighten greens slightly in dark backgrounds so the plant reads.

---

## Typography

### Typeface Roles

| Role | Font | Sizes | Weight Pairing | Purpose |
|---|---|---|---|---|
| **Display** | SF Pro Display | 34pt (large), 28pt (medium) | Semibold (600) | Screen headlines, prominent identifications |
| **UI** | SF Pro Rounded (headline, body) | 17pt, 16pt, 15pt | Regular (400), Medium (500), Semibold (600) | Controls, labels, navigation |
| **Body** | SF Pro Text | 16pt (primary), 14pt (secondary) | Regular (400), Medium (500) | Paragraph text, care advice, explanations |
| **Caption** | SF Pro Text | 12pt, 11pt | Regular (400), Medium (500) | Metadata, timestamps, source attribution |

### Type Scale (follow Apple's standards, but intentional)

```
Display Large:  34pt, Semibold (600), SF Pro Display, +1pt tracking
Display:        28pt, Semibold (600), SF Pro Display, +0.5pt tracking
Headline:       22pt, Semibold (600), SF Pro, 0pt tracking
Subheadline:    17pt, Semibold (600), SF Pro, 0pt tracking
Body Large:     17pt, Regular (400), SF Pro Text, 0pt tracking
Body:           16pt, Regular (400), SF Pro Text, +0.2pt tracking
Caption 1:      14pt, Medium (500), SF Pro Text, 0pt tracking
Caption 2:      12pt, Regular (400), SF Pro Text, 0.3pt tracking
```

**Dynamic Type:** All sizes respect the system Dynamic Type scale. Test to **Accessibility XXL** and fix layouts (don't cap scale). Increase line height by 1.2× at XL+ to maintain readability.

---

## Spacing & Layout

### Spacing Grid (8pt base)

```
Compact:   4pt  (between inline elements)
Tight:     8pt  (padding inside small components)
Default:  16pt  (standard margin, padding)
Loose:    24pt  (between sections)
Spacious: 32pt  (between major sections)
Extra:    48pt  (screen-edge breathing room, hero image margins)
```

### Layout Principles

- **Single column by default.** Photos should be full-width (minus safe area), not in cards.
- **Asymmetrical grids for interest.** My Plants grid: lead with a large hero card (full width), then 2 columns of medium cards. Breaks on iPhone SE (1 column).
- **Generous whitespace.** This isn't print; breathing room is a feature.
- **Safe area respected.** All interactive elements, text, and photos account for notch and Dynamic Island.

---

## Motion Vocabulary

Use two spring types everywhere, never a different animation per screen:

| Type | Damping | Stiffness | Use Case |
|---|---|---|---|
| `Motion.springStandard` | 0.7 | 0.8 | Default transitions, card pushes, discrete state changes |
| `Motion.springPlayful` | 0.8 | 0.6 | Bouncy feedback (capture confirmation, success), inviting moments |

**Rules:**
- Transitions: .3s ease-out (no springs for simple fades)
- Matched geometry effect: Photo carrying from capture into result (one orchestrated moment)
- Respect `reduceMotion`: all animations become instant if user has accessibility setting on
- Haptics as language (see below)

---

## Haptics

Use haptics as a consistent language. Sparse, meaningful:

| Moment | Haptic Type | Intensity | Meaning |
|---|---|---|---|
| **Capture shutter tap** | Light impact | 0.3 | "Shot captured" |
| **Focus/exposure lock** | Selection changed | 1.0 | "Locked" |
| **Confident result** | Success notif | 1.0 | "Yes!" |
| **Low-confidence result** | (none) | — | Don't buzz apologies |
| **Save to My Plants** | Light notif | 0.4 | "Saved" |
| **Destructive action (delete)** | Warning notif | 1.0 | "Careful" |
| **Daily quota exhausted** | (none) | — | Don't buzz bad news |

All haptics behind `isHapticFeedbackEnabled` flag (Settings).

---

## Component Inventory

### Buttons

**Primary CTA:** `Color.leaf` background, white text, 17pt semibold, 12pt rounded corners, 44pt min height, full-width default.

```
┌────────────────────────────┐
│   Save to My Plants        │  (Semibold, 17pt)
└────────────────────────────┘
```

**Secondary button:** `Color.glass` background, `Color.leaf` text, same size.

**Tertiary (text-only):** `Color.leaf` text, no background.

**Disabled state:** All buttons: `Color.glass` background, `Color.soil` text (60% opacity).

### Cards

**Result card:** No rounded corners. Full-width photo, soft `Color.glass` divider below. Confidence band inline. NO shadow (photography is enough).

**My Plants grid cell:** Photo full coverage, name label overlay at bottom with gradient fade. No card background, just spacing. Tap to detail.

### Badges

**Toxicity:** `Color.toxicity` background, white text, 8pt padding, 4pt rounded corners. Icon + label ("Toxic to cats").

**Confidence band:**
- Confident: Large `Color.leaf` badge, headline text
- Probably: Inline gold badge, subheadline
- Not sure: No badge; text "Best guesses" with alternatives as list

### Sections

**Care card:** No card styling. Divider between sections (`Color.glass`). Icons on left (consistent 24×24), text on right. Generous padding (16pt/24pt).

---

## Wireframes — ASCII, Scale & Hierarchy

### Screen 1: Scan View (capture mode)

```
┌─────────────────────────────────────────────────┐
│ ← Settings                                  🔥   │  (top safe area)
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│                                                 │
│        [Camera Preview – Plant Photo]           │  (full width)
│                        ◉ Guide overlay         │
│                    (not rigid frame)           │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│         ⚪  (focus/exposure tap zone)           │
│                                                 │
│  [Torch]  [Shutter]  [Photo Library]            │  (44pt buttons, 8pt spacing)
│                                                 │
└─────────────────────────────────────────────────┘
```

**Notes:**
- Full-bleed camera (no frames, guides suggest not rigid)
- Torch toggle (top right, icon only)
- Shutter large, centered (people tap it instinctively)
- Tap anywhere on preview to focus/expose (not labeled, discoverable)

---

### Screen 2: Result View (Confident band example)

```
┌─────────────────────────────────────────────────┐
│ ← Back                                  ⋯       │  (top safe area)
├─────────────────────────────────────────────────┤
│ [User's Plant Photo – full width, no card]     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  (divider)
│                                                 │
│  MONSTERA DELICIOSA                             │  (Display size, leaf green)
│  Swiss Cheese Plant  •  Araceae                 │  (Caption, soil grey)
│                                                 │
│  [🌿 Confident] ← badge on one line             │
│                                                 │
│  More options ▼                                 │  (text button, hidden until tap)
│                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  (divider)
│                                                 │
│ WHY WE THINK THIS                               │  (Subheadline)
│                                                 │
│ [Icon] Leaf shape: split, heart lobes           │  (small text)
│ [Icon] Fenestration: irregular perforations     │
│ [Icon] Growth habit: climbing vine              │
│                                                 │
│ [Ref photo side-by-side with user photo]       │  (50/50 if space)
│                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  (divider)
│                                                 │
│ CARE CARD SUMMARY                               │  (Subheadline, truncated)
│                                                 │
│ [Icons + details: light, water, toxicity]      │
│                                                 │
│ ⤷ [Full care card]  (link)                      │
│                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  (divider)
│                                                 │
│  [Save to My Plants]  (primary CTA, leaf)       │  (full width)
│  [Share]  (text button)                         │
│                                                 │
│  That's not right? → user enters correction     │  (text link)
│                                                 │
└─────────────────────────────────────────────────┘
```

**Alternative: "Not sure" band (low confidence):**

```
┌─────────────────────────────────────────────────┐
│ [User's Plant Photo]                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                 │
│ We're not sure about this one.                  │  (Honest, no headline ID)
│                                                 │
│ BEST GUESSES                                    │  (Subheadline)
│                                                 │
│ 1.  Ficus benjamina  (55% confident)            │  (list, ranked, % shown)
│ 2.  Ficus retusa     (42% confident)            │
│ 3.  Schefflera       (28% confident)            │
│                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                 │
│ HELP US GET BETTER                              │  (Subheadline)
│                                                 │
│ Add a close-up of the leaf? ─→  [Photo icon]   │  (coaching, low-key)
│ Add the whole plant? ─→  [Photo icon]          │
│ Add a flower or new leaf? ─→  [Photo icon]     │
│                                                 │
│ (Tapping each opens camera in add-image mode)  │
│                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                 │
│  [Save these guesses] (or skip for now)         │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### Screen 3: My Plants Grid

```
┌─────────────────────────────────────────────────┐
│ ← Home                         [Search]  [⋯]   │  (top safe area)
├─────────────────────────────────────────────────┤
│                                                 │
│  ╔═════════════════════════════════════════╗   │
│  ║                                         ║   │
│  ║  [Hero Photo – Monstera Deliciosa]      ║   │  (full width, 200pt tall)
│  ║          My Prize Monstera              ║   │  (name overlay, gradient fade)
│  ║                                         ║   │
│  ╚═════════════════════════════════════════╝   │
│                                                 │
│  ┌─────────────────────┐  ┌─────────────────┐  │
│  │                     │  │                 │  │
│  │ [Photo 2]           │  │  [Photo 3]      │  │  (2 col grid below hero)
│  │ Fiddle Leaf Fig     │  │  Pothos         │  │
│  │                     │  │                 │  │
│  └─────────────────────┘  └─────────────────┘  │
│                                                 │
│  ┌─────────────────────┐  ┌─────────────────┐  │
│  │                     │  │                 │  │
│  │ [Photo 4]           │  │  [Photo 5]      │  │
│  │ Prayer Plant        │  │  Succulents     │  │
│  │                     │  │                 │  │
│  └─────────────────────┘  └─────────────────┘  │
│                                                 │
│  [empty state: "No plants yet" with icon]     │  (if no plants)
│                                                 │
└─────────────────────────────────────────────────┘
```

**Notes:**
- Lead hero is asymmetrical (full-width first card, then 2-col grid)
- Photos are the hero, minimal chrome
- Tap cell → plant detail
- Swipe left → delete (with confirmation)
- Search/filter top right

---

## Design Critique: Avoiding Template Tells

**What I'm NOT doing:**

1. ~~Cream #F4F1EA backgrounds~~ → Using #FDFBF8 (warmer, more specific)
2. ~~Near-black + one acid accent~~ → Deep sage + warm palette (4 colors with purpose)
3. ~~Identical rounded cards everywhere~~ → Hero photo full-width, asymmetrical grid below, no cards
4. ~~ALL-CAPS eyebrow labels~~ → Using sentence case, specific labels ("Why we think this" not "IDENTIFYING TRAITS")
5. ~~Gradient washes~~ → Flat, intentional backgrounds; gradients only on photo overlays where they serve function
6. ~~"→" glued to buttons~~ → Verbs only ("Add a close-up", not "Add a close-up →")

**What makes this specific to Verdure:**

1. **Photography as content, not decoration** — Plant image is the entire story; UI is servant
2. **Honest confidence visualization** — "Not sure" is a designed screen, not a failure state
3. **Botanical grounding** — Soil brown, leaf green, cream like aged paper (not bright/digital)
4. **Precision over polish** — Timestamps, source dates, toxicity warnings, genus fallbacks (data-rich, not slick)
5. **Spare motion** — Two springs for everything, haptics as language (not gamified)

---

## Implementation Checklist (for eng review)

- [ ] Zero hex codes in views — all `Color.token` references
- [ ] Type scale enforced — all text uses defined sizes with proper weights/tracking
- [ ] Spacing grid respected — no magic numbers, all `Spacing.x` tokens
- [ ] Dark mode designed (not derived) — greens and backgrounds separate in dark mode
- [ ] Dynamic Type tested to XXL — layouts flexible, no clipping
- [ ] Haptics in sync with spring motions — both tables above guide implementation
- [ ] Photos decoded off-main-thread, downsampled at decode (120pt grid cells, not 12MP images)
- [ ] Accessibility color contrast ≥ 4.5:1 on all text
- [ ] Reduced motion respected — animations disabled if user presets it

---

## Next: Your Approval

I've grounded the design in botanical materials and the brand promise of honesty. The palette is specific (deep sage, warm cream, soil brown, soft glass grey) and won't look like every other plant app. The typography is intentional (weights, tracking adjusted), and the layouts are asymmetrical (hero photo, then considered grid) rather than template-stamped cards.

**Does this direction feel right, or do you want to steer it differently?**

Flag anything that doesn't sit right:
- Colors: feel too muted? Too specific? Need more drama?
- Typography: too much detail on weights/tracking, or not enough?
- Layouts: hero photo + grid works, or should everything be grid?
- Motion: two springs + haptics enough, or need something more visual?
- Anything that reads like a tell I missed?

Once you sign off, I'll start building Phase 1 Slice 1.
