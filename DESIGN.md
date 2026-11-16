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

**Editorial layer** (founder, November 2026; from a Wispr Flow style
reference, `flow.css`, loaded last). EB Garamond 400 for display headings
and stat numbers, Figtree for body and interface (Geist Mono stays for
data). Lavender (#f0d7ff) primary buttons with a 2px #1a1a1a border and
12px radius. The floating nav is a pill with a 2px ink border. A
hand-drawn lavender underline under "humans" in the hero. The film is a
dark 16:9 chamber up to 1200px wide, 40px radius (32 on phones), 2px ink
border, no shadow. Everything else keeps the PATHOS palette and marble.

**Hero background** (founder, November 2026; `heroAscii.js`). One canvas
behind the start screen draws the hand reaching for the sensor board as a
living ASCII field (" .:-=+*#%@"), built from the hand and board dot data.
It never stops moving: a director cycles reach and touch with signal rings,
data packets along the board, quick taps, a scan line, and the hand
dissolving into dust and reforming, over breathing, shimmer and drifting
dust. Cursor parts the characters, dragging splits them, a click explodes
them; springs reassemble. The canvas never takes the pointer, so the text,
pill and button stay clickable; characters behind text are drawn faint (hand 32%, rest 30%). The hand is
the subject: bold Geist Mono 700, deep orange #a8521f, full opacity, denser.
Reduced motion: one still frame. Replaces the two side halftone figures.

**Fonts.**
- Geist for all interface text.
- Geist Mono only where a monospace is functional: part numbers, data values,
  timestamps, frame counters, file names.
- Section eyebrows ("01 · Why five signals") in Geist 14/20, weight 500, muted,
  with the gold square marker (switched from mono, November 2026).
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

Every section now uses `.sys-head` (no section keeps a gold mono accent word). Panels use `.sys-panel` / `.sys-note` (light, bordered on all sides, radius 16). Section headings use `.sys-head`: heading-2 (48) from 1024px, heading-3 (36)
from 640px, heading-4 (30) below, with a body-3 lead.

Hero heading steps down by viewport: heading-3 under 640px, heading-2 from
640px, heading-1 from 1024px.

**Colors** (existing brand tokens, kept):
- Background `--bg` #f3e9e1, surfaces `--surface` #fbf7f2 and `--surface-2` #efe3d8
- Text `--ink` #0a0806, `--text` #4a4038, `--muted` #6b5f55 (5.17:1), `--faint` #70655b (4.74:1).
  Both pass WCAG AA on every page surface; the old #7d7166 and #a2978b are rejected.
- Accents `--gold` #7b5d23, `--gold-light` #d2af70, `--pink` #f0a3bb, `--pink-deep` #b8577a
- Lines `--line` rgba(10, 8, 6, 0.09), `--line-strong` rgba(10, 8, 6, 0.16)
- Hero heading only: text gradient #000000 to #666666, left to right. The only
  other gradient allowed is the dark tint that is part of the marble surface.
- Dark surfaces, where a section needs one (charts, instrument scenes): #131209, flat.

**Marble surface** (restored by the founder, November 2026). The brand's dark
marble is the surface for cards and panels: the feature tiles, signal toggles,
sensor table, pipeline steps and notes, hardware, In the works and roadmap
cards, Is / Isn't, workshops, the How it works scene, founder card, contact
panel, problem chart and points, project log, partner list and note, photo
deck card backs, the tour's device screen and the footer. One class,
`.marble` in `system.css` (`--panel` for long lists, `--contact` for the
contact crop), with light text on it (`--on-dark`, `--on-dark-2`,
`--on-dark-3`, gold-light accents). Layout, type, spacing and radii from the
passes stay. The cards tilt again (`tilt.js`): hover leans them toward the
pointer, drag turns them and they settle on a spring; the contact panel does
not tilt, and reduced motion turns tilt off. The photo deck's light catch (sheen) on the photo
fronts is back as well.

**The PATHOS film** (founder's film, November 2026). A dark 16:9 chamber
(see Editorial layer) right after the results panel. It plays on its own, muted and
looping, edge to edge (`object-fit: cover`), with a thin gold progress line.
It pauses while off screen and resumes on return; with reduced motion it
does not autoplay and shows ordinary controls (`film.js`, `film.css`). One
1080p file, `assets/film/film-1080.mp4`, poster `assets/film/stills/p-00.webp`.

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
- Gradient highlights and gradient meter fills; canvas traces drawn with gradient fills.
- A second filled button beside or after the primary (the old gold LinkedIn button and gold submit button).
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
| Hero | Restored (founder, November 2026) | The original start screen is back at the founder's request: gold "PATHOS MVP 2 is in the works" pill, "Stress awareness for humans, from sensors" with gold accents, the original subtitle, one "See the build" button and the partner name strip, with their original sizes. Pass 1 notes kept for reference: | One primary CTA ("Explore a partnership"), text link secondary, honest status line ("Research prototype"), plain text proof line limited to facts in the brief (5NEWS feature, AIM Fest demonstration), imitation logo strip removed, heading-1 / title-1 / button-md, 680px caps, tokens only, entrance animates opacity and transform only. Nav CTA renamed to match. |
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
| The model | Done (pass 10) | Shared heading. Pipeline steps on the shared light panel (`.sys-panel`); active step gold border and solid gold progress bar (no gradient bar, no dimming filter). Discarded model note is a light panel on `--surface-2` (`.sys-note`); R² in mono via `.data`. |
| Hardware | Done (pass 11) | Shared heading. Three light panels; checklists and spec rows spaced instead of divided; spec labels caption-4 in Geist. "Real-time", "WESAD-aligned", "IRB-approved" rewritten without hyphens. |
| Hardware in 3D | Done (pass 12) | Shared heading. Film and Didot titles untouched (approved exception, sizes follow the frame). Chrome on the system: flat window bar, frame 24 with 8px bezel (16 on phones), token spacing, 12/14/16px text, Geist chapter rail, solid scrubber, balanced captions. File name and frame counter stay mono. All 3D tests pass, including fallbacks. |
| The build (photo deck) | Done (pass 13) | Shared heading. Card backs flat #131209 instead of marble plus gradient; photo sheen removed; back text caption-4 / heading-6 / body-6; caption title-2 / body-3; counter Geist with tabular figures; round buttons. |
| In the works | Done (pass 14) | Shared heading, three light panels; "skin-contact" and "3D-printed" rewritten. |
| Roadmap | Done (pass 15) | Shared heading, three light panels with spaced dot lists (`.sys-list`); Is / Isn't as light panels instead of dashed marble; "go-to low-cost" rewritten. |
| Workshops | Done (pass 16) | Shared heading; one light panel, rows spaced, numbers caption-4 in Geist. |
| How it works | Done (pass 17) | Shared heading; steps on light panels with a solid gold progress bar; scene on #131209; finger and problem chart band drawn with flat fills; "60-second" rewritten. |
| Founder | Done (pass 18) | Shared heading; light panel instead of marble tilt card; name heading-4, role Geist, facts as light chips, LinkedIn as a text link (was a second filled button); mentor names kept together. |
| FAQ | Done (pass 19) | Shared heading; each question a light panel (radius 12) instead of rows between rules. |
| Final CTA (contact) | Done (pass 20) | Light panel instead of dark marble; ink primary button per the approved style; white inputs, gold focus ring, errors in `--pink-deep`; email underlined, secondary links as text links. Form tests pass. |
| Footer | Done (pass 21) | Light panel on `--surface-2` instead of drifting marble under a gradient scrim; solid underlines on links. |
| The film | Done | Scroll-driven 4K film after the results panel; frame exact at 60 of 60 tested positions; loading stills; skip link; no-JS fallback with controls. The film's own text (93.72% on WESAD with its caveat, the LLC question, booking by the hour, the Thanksgiving target) is the founder's and is not repeated as page copy. |
| Software tour (follow-up) | Done | Step numbers Geist (ordinals); screen bezel 32px (12 on phones) on #131209 instead of 4% over marble. |


## Condensed copy

The page's text was cut to about half (visible reading text 2,143 → ~1,200 words) after a round of decisions with the founder. All animations stay.

- **Each fact said once.** The under-$25 budget lives on the problem card ($200+ tools) and the parts tagline; partners and the founder no longer repeat stats; "body sensors arrive in MVP 2" is the parts table's status column.
- **Voice.** Plain sentence first, technical detail as a small mono spec tag (`.spec-tag`) in the model steps; part numbers live in the parts table.
- **Taglines.** Every section's intro paragraph is replaced by a 3–6 word deck line (`p.body-3.sec-tag`, EB Garamond italic 24/30, 21/27 on phones).
- **The parts** (`#sensors`, now after the model): one table, What · Part · Job · Status, for the ESP32-S3 and the five sensors (traces kept), with the bus and the rest of the rig (electrodes, microSD, breadboard, power bank) underneath. Replaces "Five sensors, one bus" and "What works today". No per-part prices (not verified); total "under $25".
- **Merges.** Project log folded into the Roadmap as one timeline (planned milestones keep hollow dots, `.is-next`); "Results so far" stays, the partner cards drop the repeated numbers; the founder's mentor line is gone (it's in Partners); Meet PATHOS keeps 4 cards (five signals, $25, on-device, 3D); FAQ keeps 4 questions not answered above (medical device, who it's for, data, how to help), and its structured data matches.
- **Caveats.** Only "not a medical device" (FAQ, footer) and "not yet validated on PATHOS hardware" (model section) remain. The R² story, "no photos yet", the chart's "Illustration" label, the screenshot "simulated / not clinical" notes, the how-it-works note and the Is / Isn't row were removed.
- Section numbers: 01 Why five signals, 02 The model, 03 The parts, 04 Hardware in 3D, 05 The build, 06 In the works, 07 Workshops. The 3D chapter captions are unchanged.

## Motion on every device

A ThinkPad with Windows "Animation effects" off (common on school laptops) reports `prefers-reduced-motion: reduce`, and the site used to honour it: hero particles, margin art, charts, traces, the finger scene, the photo deck and the 3D easing all froze, and the film showed native controls. By the founder's decision, animations now run for everyone:

- Every reduced-motion branch in the scripts is a constant `false`, and every reduced-motion CSS block is removed. `deliverables/test-motion.cjs` loads the page with reduced motion on and checks that each moving part moves (it fails on the old build, passes now).
- **Film:** muted autoplay loop, never any controls. It starts downloading after the page's own load (or a screen before it's reached), so the 25 MB file never competes with first paint.
- **3D:** the scene is built once the page is idle, or two screens before the section, instead of during the hero. Built-in graphics (Intel UHD/Iris, AMD Radeon Graphics, etc.) start at 1x pixels and a 1024 shadow map; any machine under ~42 fps for 10 frames halves the shadow map, then lowers the pixel ratio in steps down to 0.55x. One frame at the laptop start costs ~25% less than before, ~47% less after adapting. Scroll easing is back on every device.
- **Spawn:** every card, panel and row (features, signals, pipeline, parts rows, partners, workshops, FAQ, problem points, how steps, founder, results) rises in with a staggered `spawn` keyframe (32px, scale 0.96, 0.85s). The backwards fill releases the transform so hover lifts and tilt still work.

## Hero film, editorial layout, pre-rendered 3D

**Hero.** The ASCII particle hand is gone from the first screen. The hero is a dark chamber (#0b0908) with a seamless 16 s loop of marble slabs (the site's marble on each face, brushed-gold edges, soft bloom) cascading from top left to the right, after the Fragment reference. It was rendered offline from a three.js scene (`deliverables/hero-render/`): 1920×1080 and a 1080×1920 portrait cut, each slab travelling the full cycle so the last frame flows into the first (seam difference equals a normal frame step). `hero.js` picks the cut by aspect ratio, plays on screen, pauses off screen and restarts a stall. The first frame is the hero background, so first paint already shows the slabs. Text sits bottom left over a shade, partners on a rule below.

**No cards.** Every boxed card is gone. Sections are organised by hairline rules (`--rule`, `--rule-strong`), numbers and Garamond titles: features, signals, pipeline and MVP 2 are columns divided by rules; partners, problem points, parts, workshops, FAQ and the timeline are rows between rules; the founder and results stand on the page. Marble is a material on real objects only: the hero slabs; instrument "screens" (problem chart, how-it-works scene, feature tiles, signal traces, part traces) as small dark-marble slabs with a gold edge; the big result numbers (marble multiplied by bronze, clipped to the type); and the closing band, where contact and footer sit on dark marble. Signal toggles light a pink rule when pressed; the active pipeline step runs a gold bar along its rule.

**3D on laptops.** Live WebGL was still slow on a ThinkPad (likely software rendering on a blocklisted driver, where no quality setting helps). On laptops and desktops the 3D film now plays from 480 pre-rendered frames (every 6th of 2880, `assets/hw-seq/`), baked from the live scene by `deliverables/hw-bake.cjs` (`?bake`) at 1.5× with 2048 shadows and downscaled to 1600×800 WebP, the 1280×720 film frame in the middle so any view from 1.6:1 to 2.2:1 is covered exactly as the live render frames it. A 2D canvas draws the two samples either side of the scroll position, blended, aligned to the film frame (titles and labels unchanged), edges feathered into the backdrop. Frames stream coarse to fine. The live scene is built only on demand (a click on the picture or the 360 view; a click made while it loads is answered when ready) and then handles labels, hover names and the 360 view; phones keep the live scene. If the frames can't load, the live scene takes over.

**Fixes.** The film was re-encoded from the 4K original for streaming (7.1 MB, SSIM 0.998), with native autoplay and a stall watchdog. Photos are visible by default (the fade-in is an animation), and `main.js` starts each feature on its own so one failure can't blank the photos.
