# PATHOS hardware in 3D

The `#prototype` section of the landing page plays the finished Blender film
`PATHOS_Final_Complete.blend` (2880 frames at 60 fps, ten shots) as a
scroll-driven film in the browser: the breadboard rig on a matte black table
beside the midnight MacBook running the PATHOS v1 dashboard on a marble
wallpaper.

## Model export

`export_web.py` runs inside Blender's Python (`pip install bpy==5.0.1`, Python 3.11):

```sh
python export_web.py -- PATHOS_Final_Complete.blend raw.glb
```

It removes the Blender editorial HUD (the titles are rebuilt in HTML) and the
studio lights, converts curves to meshes, applies modifiers, and joins static
meshes per rigid group (about 1,400 source objects become 82 meshes). The
MacBook display, the dashboard window and the table stay separate, with their
UVs, because the page rebuilds their node materials. Shape-keyed wires, the
travelling signal pulses, highlight rings, Wi-Fi packets and the camera keep
their own animated nodes. Images are not embedded: the film's screenshots and
marble artwork are the same files the site already serves.

`optimize.mjs` (gltf-transform + meshoptimizer) then drops unused UV sets,
resamples the animation, dedups, prunes and Draco-compresses. Its `mobile` mode
also welds and simplifies the geometry by about a third:

```sh
node optimize.mjs raw.glb assets/pathos-hardware.glb            # desktop, ~2.0 MB, ~439k triangles
node optimize.mjs raw.glb assets/pathos-hardware-mobile.glb mobile   # phones, ~1.4 MB, ~297k triangles
```

## Playback (`prototype.js`)

- Scroll maps to a film frame. Each shot gets a share of the scroll
  proportional to its length (with a floor), so the camera's quick moves stay
  quick and the holds breathe. The rendered frame eases toward the scroll
  target and stops when it arrives; nothing renders while off screen.
- The film's 16:9 frame always stays fully in view. The HUD (`#hwHud`) is laid
  over exactly that frame, and its sizes and positions are the Blender HUD's
  own, in container query units: eyebrow, Didot title, cream caption plate.
  Titles switch on and off on the film's frames (for example chapter 1 leaves
  at 286, the final card arrives at 2598, the laptop shot has none). On narrow
  views the picture moves up and the titles stack underneath at a readable size.
- Node materials rebuilt from the film:
  - MacBook screen: the four v1 screenshots, switched on the film's
    `Screen page` keys (Live Instrument, then Model Study at 2020, Source Data
    at 2092, Diagnostics at 2163, back to Live at 2520).
  - Wallpaper: `assets/marble.webp` with the film's mapping (u × 0.865 + 0.067).
  - Table: near-black matte, with the marble panel drawn in screen space at the
    right of the frame (window x > 0.82, sampled at x − 0.107) during frames
    1–285 and 2520–2880, as the film's `Artwork timing` does.
- AgX tone mapping at −0.12 EV and the film's five area lights (as spot lights
  at the same positions, aims, colours and relative power).
- Phones and touch devices load `pathos-hardware-mobile.glb`, the 800 px
  screenshots and the smaller marble, with a lower pixel-ratio cap.
- In the film, only scroll moves anything. Clicking (or tapping) a part pins
  a label to it with its name and what it does; hovering names it. Seeking sets
  every clip's time directly, so scrubbing anywhere, including past the last
  frame and back, is exact.
- **360° view** (button in the window bar): orbit the scene at the current
  frame with gentle, damped dragging, no panning, staying above the table, and
  zoom with the + / − buttons or a pinch. The mouse wheel keeps scrolling the
  page. "Back to the film", Esc, or scrolling away glides back to the film camera.
- A chapter rail and a timeline scrubber. Pixel ratio adapts if frames get slow.
- `assets/pathos-hardware-poster.webp` shows while the model loads and stays as
  the fallback if WebGL or the model is unavailable; titles still follow the scroll.

## Tests

With the local server running on port 8000:

```sh
node deliverables/test-prototype.cjs
node deliverables/test-prototype-fallbacks.cjs
node deliverables/test-prototype-interaction.cjs
node deliverables/test-prototype-interaction-phone.cjs
```

The first checks every shot (chapter, titles, frame counter), the title frames,
the screen pages and table artwork on their keys, reverse scrubbing, rail
navigation, the phone build (lighter model, small screenshots, stacked titles)
and reduced motion, and writes captures plus `validation.json` to this folder.
The second checks a missing model, a failed Draco decoder and no WebGL. The
interaction checks cover clicks and drags in the film, labels, the 360 view and
the phone.
