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

Section headings use `.sys-head`: heading-2 (48) from 1024px, heading-3 (36)
from 640px, heading-4 (30) below, with a body-3 lead.

Hero heading steps down by viewport: heading-3 under 640px, heading-2 from
640px, heading-1 from 1024px.

**Colors** (existing brand tokens, kept):
- Background `--bg` #f3e9e1, surfaces `--surface` #fbf7f2 and `--surface-2` #efe3d8
- Text `--ink` #0a0806, `--text` #4a4038, `--muted` #6b5f55 (5.17:1), `--faint` #70655b (4.74:1).
  Both pass WCAG AA on every page surface; the old #7d7166 and #a2978b are rejected.
- Accents `--gold` #7b5d23, `--gold-light` #d2af70, `--pink` #f0a3bb, `--pink-deep` #b8577a
- Lines `--line` rgba(10, 8, 6, 0.09), `--line-strong` rgba(10, 8, 6, 0.16)
- Hero heading only: text gradient #000000 to #666666, left to right. No other gradients.
- Dark surfaces, where a section needs one (charts, instrument scenes): #131209, flat.

**Spacing.** Section padding is 64px on desktop and 40px on phones (`--section-pad`).
Only 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px
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

**Copy.** Sentence case. Keep proper names and handles on one line with non-breaking
spaces ("Alice L. Walton", "by @autism_feed"). No hyphens inside sentences (product names such as
ESP32-S3 and Wi-Fi are exempt). Headings balanced, body text pretty-wrapped.

## Rejected

- One-sided borders used as dividers (the old proof band).
- Gradient patterns used to fake dashes or stripes (use solid shapes).
- Monospace for ordinal numbers (01, 02); keep it for timestamps, part numbers and data.
- Gradient fills on objects (the old iPad bezel and its radial floor shadow).
- A visual section with no heading telling visitors what they are looking at.
- Stats without a stated source.
- Dark marble gradient tint behind lists of text (partners now sit on a light panel).
- Dark marble tilt cards for the feature overview and the signal toggles (now light bordered panels).
- Gradient highlights and gradient meter fills; canvas traces drawn with gradient fills.
- The same eyebrow on two sections.

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
| Software tour | Done (pass 3) | Heading added ("What the dashboard actually shows", heading-2/3/4 by width) saying these are real v1 screenshots. Scroll timing measured on a new track so the heading never shifts it. Flat bezel instead of a gradient, floor shadow without a gradient, radii 24/12/8 (16/8/6 on phones) by the nested formula. Steps: button-sm with aria-current, labels wrap on phones; captions body-3 in a fixed three or four line box. |
| Partners | Done (pass 4) | Eyebrow "Partners" (was a duplicate "Results so far"); heading without the accent word, in the shared `.sys-head` style. Six partners on one light panel bordered on all sides, each with a role (caption-4), name (title-2) and involvement (body-6); press screenshot and the $25 note beside it. SkillsUSA line states the result instead of "Where we compete with it". Official name "Alice L. Walton School of Medicine" used site-wide. |
| Project log | Done (pass 5) | Shared `.sys-head` heading with a lead line, no accent word. Light panel bordered on all sides instead of the dark marble panel with one-sided dividers. Each milestone: date (caption-4, mono as a timestamp), title (title-2), detail (body-6). Timeline drawn as one segment per milestone, dot to dot, lighting as the reader scrolls; verified to meet each dot exactly. Proper names and handles kept together with non-breaking spaces. |
| Problem | Done (pass 6) | Shared heading without the accent word. Chart on a flat dark surface (#131209, from the skill's dark palette) instead of the marble gradient; legend caption-2 with a solid-dash swatch instead of a gradient pattern; chart labels 14px. Three points on light panels bordered on all sides: number (caption-4, Geist, not mono), title (title-2), detail (body-6). |
| Features overview | Done (pass 7) | Shared `.sys-head` heading ("Meet PATHOS", no mono accent); lead says "inexpensive" instead of the hyphenated "low-cost". Eight features moved from dark marble tilt cards to light panels bordered on all sides (radius 16, padding 24, 16 on phones, gap 16): flat #131209 inset (radius 8) for each small animation, number caption-4 in Geist, title title-2, detail body-6, "See how" body-5 in gold. Hover lifts 2px over 500ms, active scale(0.98), gold focus ring; reduced motion keeps color only. Hyphens removed ("standard sensors", "a case to wear all day"); animations still pause off screen. |
| Why five signals | Done (pass 8) | Shared `.sys-head` heading without the mono accent. Four signal toggles moved from dark marble tilt cards to light panels bordered on all sides (radius 16, padding 24/16), title-2 and body-6, flat #131209 trace (radius 8). Pressed state: pink-deep border and check; focus ring gold. Meter is one solid color (grey while moving) instead of a gradient. Closing line title-1, emphasis in semibold with a solid underline when all three agree (was mono plus a gradient highlight). Live traces (here and in the sensor table) draw a flat fill and a solid line instead of gradients. Click, Enter and Space tested. |
| Sensors | Done (pass 9) | Shared `.sys-head` heading without the mono accent. Sensor table moved from a dark marble panel with one-sided row dividers to one light panel bordered on all sides (radius 16, padding 8; 4 on phones), rows separated by spacing only, each row radius 8 (12 on phones) by the nested formula, hover tint `--bg`. Header labels caption-4 in Geist (not mono); signal title-3; part number caption-2 in Geist Mono (functional); reason body-6; status caption-4 pill. Traces on #131209. Pin names kept together with non-breaking spaces. |
| The model and the rest | Pending | One section per pass. |
