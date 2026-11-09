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
- Text `--ink` #0a0806, `--text` #4a4038, `--muted` #7d7166, `--faint` #a2978b
- Accents `--gold` #7b5d23, `--gold-light` #d2af70, `--pink` #f0a3bb, `--pink-deep` #b8577a
- Lines `--line` rgba(10, 8, 6, 0.09), `--line-strong` rgba(10, 8, 6, 0.16)
- Hero heading only: text gradient #000000 to #666666, left to right. No other gradients.

**Spacing.** Only 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px
(`--sp-0` … `--sp-900` in `system.css`).

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

## Facts awaiting verification (do not add or expand until confirmed)

- @autism_feed numbers: the site says 13.6K likes and 4,389 saves; the brief
  says about 13,500 likes and 1,003 reposts.
- "More than 2,000 people reached through AIM": not in the brief.
- Exact wording for Autism Involves Me, the Alice L. Walton School of Medicine
  and the named mentors, SkillsUSA NLSC 2026, and the state science fair.
- Model metrics (90.96% LOSO and others): version, dataset, protocol, limits.

## Section log

| Section | Status | Notes |
|---|---|---|
| Hero | Done (pass 1) | One primary CTA ("Explore a partnership"), text link secondary, honest status line ("Research prototype"), plain text proof line limited to facts in the brief (5NEWS feature, AIM Fest demonstration), imitation logo strip removed, heading-1 / title-1 / button-md, 680px caps, tokens only, entrance animates opacity and transform only. Nav CTA renamed to match. |
| Final CTA (contact) | Pending | Its button still says "Open in email" and the form only opens a mail app; must match "Explore a partnership" and submit to a real destination (needs your provider choice). |
| Proof band and the rest | Pending | One section per pass. |
