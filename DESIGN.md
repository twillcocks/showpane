# Showpane Design System

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-hero-from` | `#2C5278` | Gradient start (headers, hero backgrounds) |
| `--color-hero-to` | `#5A8BB5` | Gradient end |
| `--color-accent` | `#E8590C` | CTAs, active states, badges |
| `--color-surface` | `#FAFAF8` | Page backgrounds (warm off-white) |
| `--color-surface-warm` | `#FFF8F3` | Portal card backgrounds, content areas |
| `--color-text-dark` | `#1A1A1A` | Primary text |
| `--color-text-light` | `#F5F5F3` | Text on dark backgrounds |
| `--color-muted` | `#64748B` | Secondary text, descriptions |
| `--color-terminal` | `#111827` | Terminal/code boxes, dark UI elements |
| `--color-border` | `#E5E7EB` | Card borders (gray-200) |

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Headings (marketing) | Instrument Serif | 400 | 2xl-4xl, italic for nav logo |
| Body (marketing) | Instrument Sans | 400 | base-lg |
| Headings (app/portal) | Inter | 600 | lg-2xl |
| Body (app/portal) | Inter | 400 | sm-base |
| Code/terminal | Geist Mono / SF Mono fallback | 400 | xs-sm |
| ASCII art | SF Mono / Fira Code / monospace | 400 | responsive via clamp() |

## Spacing

- Card padding: `p-5 sm:p-6`
- Section padding: `py-24 px-6`
- Card gap: `gap-3` to `gap-8` depending on context
- Border radius: `rounded-lg` (cards), `rounded-2xl` (large cards), `rounded-xl` (terminal boxes)
- Max content width: `max-w-4xl` (marketing), `max-w-lg` (welcome page)

## Components

### Terminal Box
Dark background (`#111827`), white text, monospace font, `rounded-lg` or `rounded-xl`, subtle `border border-white/10`. Used for `$ npx showpane` commands and code snippets.

### Step Card
White or warm cream background, `rounded-lg` border, numbered circle (`w-7 h-7 rounded-full bg-gray-900 text-white`), title + code snippet. Used on welcome page and how-it-works.

### ASCII Heading
ANSI Shadow FIGlet font rendered in monospace. White with shimmer gradient animation on marketing site. Static white on welcome page (inside app). Always `role="img" aria-label="SHOWPANE"`.

## Surfaces

| Surface | Background | Text | Vibe |
|---------|-----------|------|------|
| Marketing hero | Blue-gray gradient + dot grid | White | Brand, identity |
| Marketing body | `#FAFAF8` off-white | Dark | Clean, informational |
| Portal pages | `#FFF8F3` warm cream | Dark | Warm, professional |
| Welcome page header | Blue-gray gradient (smaller) | White | Brand continuity |
| Welcome page body | White or warm cream | Dark | Clean onboarding |
| Terminal/CLI | Terminal default (black) | ANSI colors | Developer tool |

## Rules

1. The blue-gray gradient is the brand signature. Use it on headers/heroes, never on body content.
2. Orange accent (`#E8590C`) is for interactive elements only: buttons, active tabs, badges. Never decorative.
3. Warm cream (`#FFF8F3`) is the portal surface. Use it wherever portal content is shown.
4. Terminal boxes (`#111827`) are for code and commands. Never use them decoratively.
5. ASCII art uses ANSI Shadow font. Generate with FIGlet/TAAG. Consistent across CLI, welcome page, and marketing site.
6. No purple. No generic blue (#3B82F6). The blue is always the steel blue-gray (#2C5278).
