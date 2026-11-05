# PATHOS interactive prototype

Local review: http://localhost:8000/#prototype

The existing static HTML/CSS/JavaScript landing page now includes a scoped
Three.js studio section. Nothing was published. The Blender files and original
GLBs were not modified.

## Implementation

- `prototype.js` owns one deterministic scroll timeline: clip time, camera,
  cable signals, material emphasis, wireless indicators, and chapter state.
- `prototype.css` scopes the dark ink/yellow styling and responsive layouts to the section.
- The supplied Draco GLB is loaded with locally bundled decoders; the supplied
  standard GLB is the decoder-error fallback. Three.js 0.165.0 is bundled locally
  and shared with the existing hero renderer through the import map.
- The GLB contains a 48-second Scene clip, 47 animation tracks, and 57 source
  meshes. Five waveform meshes have 24 morph targets each. Cable meshes retain
  their source/destination service-loop targets. There are 436,679 model triangles.
- Blender inspection confirmed the latest scene is 60 fps, frames 1–2880.
  Retiming preserved seconds, so the 48-second GLB remains appropriate.
- `assets/prototype-paths.json` contains 36 original cable centerlines and their
  endpoint morph targets, extracted read-only from the supplied Blender scene
  using `inspect_web_scene.py`. Browser signal markers interpolate these actual
  paths with the same morph weights as the model. No replacement wire routes.
- All requested component names are checked at load time. Electrodes, laptop,
  power bank, screen, card, and modules retain their independent hierarchy.
- HTML supplies ten narrative chapters, a component selector, descriptions,
  loading/error messages, and the final contact action.
- Explore mode suspends guided camera/clip changes. Orbit and zoom are bounded;
  touch, mouse, arrow keys, +/- and Escape are supported. Returning evaluates
  the current scroll position immediately.
- Reduced motion uses fixed chapter poses and removes traveling signal markers.
  Rendering occurs only for changed frames while the section is visible.
- DPR is capped at 1.5 desktop / 1.25 mobile, with adaptation down to 1.
  Lighting uses an environment map and one 1024px soft-shadow light.
  The old hero renderer no longer renders underneath offscreen opaque sections.

## Verification

Chrome/Playwright checks in `test-prototype.cjs` cover all ten chapter stops,
reverse seeks, camera restoration, keyboard orbit, component descriptions,
mobile sizing, reduced motion, and a continuous four-second scroll sweep.
`test-prototype-fallbacks.cjs` verifies decoder failure, both missing GLBs,
unavailable WebGL, and reduced-motion settling.

Representative captures are `prototype-chapter-0.png` through
`prototype-chapter-9.png`, plus mobile/tablet/landscape captures.
The machine-readable report is `prototype-validation.json`.

The tested run had no page/console/resource errors or horizontal overflow.
Median scrolling frame interval was approximately 16.7 ms on this Mac's
headless Chrome at adaptive DPR 1 (about 60 fps); this is not a guarantee for
other devices. The scene reported 136 color-pass draw calls. Shadow passes
add GPU work beyond that counter.

Across chapter samples, the cable endpoint displacement agreed with its owning
component displacement within 1e-8 meters. This validates animation attachment,
not electrical accuracy or mesh-manufacturing tolerances.

To run locally from the project folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Browser checks require Playwright and an installed Chrome:

```sh
node deliverables/test-prototype.cjs
node deliverables/test-prototype-fallbacks.cjs
```

## Boundaries

The model is representative geometry, not certified manufacturer CAD or an
electrically validated schematic. Supply compatibility, bus pull-ups and board
revisions remain the assumptions documented with the source asset.

GSR analog OUT goes to ADS1115 A0; ADDR is tied to VDD (0x49). I2C is shared,
SD uses separate SPI, USB provides bank power, and the laptop link is wireless.
The dashboard waveforms are simulated presentation data. No live acquisition,
physiological analysis, or V4 inference executes in this experience.

The browser recreates presentation elements; it does not reproduce Blender's
cinematic lighting pixel-for-pixel. Mobile uses more distant, compact framing.
The full HTML narrative remains readable if the 3D experience cannot load.
