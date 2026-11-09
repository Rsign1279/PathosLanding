# PATHOS design record

The working record of approved and rejected design choices. Source of rules:
`landing-page-design` skill (github.com/elayadesign/ai-design-skills,
`skills/landing-page-design/SKILL.md`). Read this before changing any section.
Tokens live in `system.css`; new work uses those classes and variables instead
of new values.

## Approved

**Primary action.** "Explore a partnership", pointing at `#contact`. The same
words are used at the top and at the final call to action. Only one primary
button above the fold; a secondary action is a plain text link.

**Fonts.**
- Geist for all interface text.
- Geist Mono only where a monospace is functional: part numbers, data values,
  timestamps, frame counters.
- Didot (fallback Bodoni Moda) only inside the Blender film HUD, because it
  reproduces the film's own titles.
- No italics. Maximum weight 600 (semibold).

**Text styles** (classes in `system.css`, sizes from the Tailwind scale only):

| Style | Size / line height | Weight |
|---|---|---|
| heading-1 | 60 / 60 | 600 |
| heading-2 | 48 / 48 | 600 |
| heading-3 | 36 / 40 | 600 |
| heading-4 | 30 / 36 | 600 |
| heading-5 | 24 / 32 | 600 |
| heading-6 | 20 / 28 | 600 |
| title-1 | 20 / 28 | 500 |
| title-2 | 18 / 28 | 500 |
| title-3 | 16 / 24 | 500 |
| title-4 | 14 / 20 | 500 |
| body-2 | 16 / 24 | 500 |
| body-3 | 16 / 24 | 400 |
| body-5 | 14 / 20 | 500 |
| body-6 | 14 / 20 | 400 |
| button-md | 16 / 24 | 600 |
| button-sm | 14 / 20 | 600 |
| caption-2 | 14 / 20 | 400 |
| caption-4 | 12 / 16 | 500 |

Hero heading steps down by viewport: heading-3 under 640px, heading-2 from
640px, heading-1 from 1024px.

**Colors** (existing brand tokens, kept):
- Background `--bg` #f3e9e1, surfaces `--surface` #fbf7f2 and `--surface-2` #efe3d8
- Text `--ink` #0a0806, `--text` #4a4038, `--muted` #6b5f55 (5.17:1), `--faint` #70655b (4.74:1).
  Both pass WCAG AA on every page surface; the old #7d7166 and #a2978b are rejected.
- Accents `--gold` #7b5d23, `--gold-light` #d2af70, `--pink` #f0a3bb, `--pink-deep` #b8577a
- Lines `--line` rgba(10, 8, 6, 0.09), `--line-strong` rgba(10, 8, 6, 0.16)
- Hero heading only: text gradient #000000 to #666666, left to right. No other gradients.

**Spacing.** Only 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px
(`--sp-0` … `--sp-900` in `system.css`). Page gutter `--gutter` is 24px
(Spacing-300); the old 20px is rejected.

**Radius.** Tailwind steps only: 2, 4, 6, 8, 12, 16, 24 px, full. Nested
shapes with a gap under 32px use inner = outer − gap (only if the result is
over 2).

**Buttons.**
- Primary (`.btn-dark`): button-md, padding 8px 12px, radius 8px, `--ink`
  background, `--bg` text. Hover lifts 1px and lightens; active `scale(0.98)`;
  focus ring 2px `--gold` with 2px offset.
- Secondary: a text link in body-2 with an arrow, underline on hover. Never a
  second filled or outlined button beside the primary.

**Motion.** (Global `--ease` switched to this curve in pass 1.) Curve `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease`), 500ms for
position, 300ms for color and opacity, never under 200ms. Transform and
opacity only. Reduced motion: opacity only.

**Copy.** Sentence case. No hyphens inside sentences (product names such as
ESP32-S3 and Wi-Fi are exempt). Headings balanced, body text pretty-wrapped.

## Rejected

- One-sided borders used as dividers (the old proof band).
- Stats without a stated source.

- Competing calls to action above the fold (was: announcement link plus two buttons).
- Partner names drawn as imitation logos in invented type styles (Georgia
  italic, letter-spaced caps). Real organisations appear as plain text, and
  only with approved wording.
- A gold monospace accent word in every heading. Removed section by section.
- Background gradients, glowing orbs, neon, decorative glass.
- Invented statistics, testimonials, endorsements or affiliations.
- Generic card grids added to fill space.
- Italics and weights above 600.
- Off-scale sizes (16.5, 15.5, 19.5, 56px and others) and off-token spacing
  (20, 26, 14, 18, 22, 28, 56px and others).

## Facts

Confirmed by the founder (November 9, 2026): every claim on the page as it
stands, including the AIM reach, partner and mentor names, SkillsUSA and
science fair results.

Corrected from the @autism_feed screenshot: 13.6K likes, 1,009 reposts and
4,389 shares (the paper plane count). It was wrongly labelled "saves".

Wording rules: say the model runs on the device; make no claims about the
cloud, encryption or retention. Illustrative charts carry a visible
"Illustration, not measured data" note.

## Section log

| Section | Status | Notes |
|---|---|---|
| Hero | Done (pass 1) | One primary CTA ("Explore a partnership"), text link secondary, honest status line ("Research prototype"), plain text proof line limited to facts in the brief (5NEWS feature, AIM Fest demonstration), imitation logo strip removed, heading-1 / title-1 / button-md, 680px caps, tokens only, entrance animates opacity and transform only. Nav CTA renamed to match. |
| QA fixes | Done | Shares not saves; device wording; chart note; contrast tokens; meta, canonical, Open Graph and Twitter tags with a 1200x630 image; FAQ structured data; nav shows the current section; privacy notice and rebuilt 404. |
| Final CTA (contact) | Done (form) | Button reads "Explore a partnership". Form posts to FormSubmit (AJAX) for the PATHOS inbox, with Organization and Type of interest, inline errors per field, a sending state, and success only after the service confirms. The first submission triggers FormSubmit's one-time activation email. |
| Proof band | Done (pass 2) | One panel bordered on all sides (radius 16, padding 32/24) instead of one-sided dividers. Each stat: number (heading-3, 30/36 on phones), meaning (body-6), source (caption-4). Phones list one stat per row, number beside its text. No orphans from 360 to 1920px. Copy tightened, facts unchanged. |
| Software tour and the rest | Pending | One section per pass. |
