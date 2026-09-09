# PATHOS landing page images

The landing page uses JPEG copies of the four product photographs below.
The original WebP files are retained. Product references use the same basename
with `.jpg`; the press card uses `press-instagram-optimized.jpg`.
Portrait photographs are shown in full with captions below the image.

## Product → 1st MVP Iteration (the base PATHOS model)

| Filename | Which photo | Caption shown |
|---|---|---|
| `mvp1-hardware.webp` | Close-up of the breadboard: XIAO ESP32-S3 wired to the purple GY-BME/P280 module | **The board** |
| `mvp1-dashboard.webp` | The laptop screen close-up — Controls sidebar, live humidity/temperature tiles, the "Sad" inference card | **Live inference** |
| `mvp1-bench.webp` | The breadboard next to the open laptop running the dashboard | **End to end** |
| `mvp1-demo.webp` | Presenting the device with someone's hands on it (the framed/tilted photo) | **In someone's hands** |
| _(reserved slot)_ | Awaiting new photography | **On 5NEWS** |
| `mvp1-demo.webp` | The same live demonstration photo, used because no separate presenter photo was supplied | **Walking through it** |
| _(reserved slot)_ | Awaiting new photography | **With the community** |

## Impact → press strip

| Filename | Which photo |
|---|---|
| `press-instagram.jpg` | The `@autism_feed` Instagram post screenshot (13.6K likes) |
| _(reserved slot)_ | Text press card for the 5NEWS segment |

## Removed photography — do not re-add

Group photos of the original 2024–25 team were removed because those members
are no longer with PATHOS and never consented to appearing in the marketing of
the current venture. `mvp1-team-5news.webp`, `mvp1-community.webp` and
`press-facebook.webp` were deleted on 2026-08-14 along with the root-level
duplicates. Only photographs where the sole identifiable person is the current
owner are kept.

Reserved slots render an inline-SVG PATHOS motif via `.shot.is-placeholder`
(see `styles.css`). They are inert — no lightbox, no zoom affordance. To fill
one, swap the `<div class="shot ... is-placeholder">` back to the
`<button type="button" class="shot ...">` + `<img>` form used by the other
slots, and restore the `.shot-zoom` span.

## PATHOS IoT (2nd MVP)

No images yet — the section renders a "Coming Soon" state with three
placeholder frames (Board / Enclosure / Worn). When the second-iteration
photos exist, replace the `.iot-frames` block in `index.html` with a
`.gallery` block copied from the 1st MVP iteration.

## Notes

- Long edge of roughly 1600px is plenty; these are displayed at up to ~700px wide.
- Screenshots (`press-*`) are cropped to a 3:4 frame anchored to the top, so
  the account header stays visible.
- Every image is `loading="lazy"` and fades in once decoded.
- Clicking any image opens the lightbox (arrow keys to move, Esc to close).
