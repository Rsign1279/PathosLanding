# PATHOS hardware in 3D

The `#prototype` section of the landing page plays the Blender scene
`PATHOS_Hardware_Detail_1080p60.blend` (2880 frames at 60 fps, 10 chapters)
as a scroll-driven film in the browser.

## Model export

`export_web.py` runs inside Blender's Python (`pip install bpy==5.0.1`, Python 3.11):

```sh
python export_web.py -- PATHOS_Hardware_Detail_1080p60.blend pathos_hw.glb
```

It removes the Blender editorial HUD (titles are rebuilt in HTML) and the studio
lights, converts curves to meshes, applies modifiers, and joins static meshes per
rigid group (each animated module plus the static rig): about 1,140 source objects
become 85 meshes. Shape-keyed wires, the travelling signal pulses, highlight rings,
Wi-Fi packets and the camera keep their own animated nodes.

The GLB is then post-processed with gltf-transform to drop redundant keyframes and
re-compress the geometry:

```sh
npx gltf-transform resample pathos_hw.glb a.glb --tolerance 0.0001
npx gltf-transform dedup a.glb b.glb && npx gltf-transform prune b.glb c.glb
npx gltf-transform draco c.glb assets/pathos-hardware.glb --method edgebreaker --quantize-position 14 --quantize-normal 10
```

Result: ~2.2 MB (about 0.8 MB gzipped), ~200 draw calls, ~390k triangles per
frame including the shadow pass.

## Playback (`prototype.js`)

- Scroll maps to a timeline frame. Each chapter gets a share of the scroll
  proportional to its length in the film (with a floor), so the camera's quick
  moves between shots stay quick.
- The rendered frame eases toward the scroll target every animation frame and
  stops when it arrives; nothing renders while the section is off screen.
- Chapter titles are HTML, shown on the exact frames the Blender HUD used.
  `--t` and `--x` CSS variables drive a staggered, reversible reveal.
- Route segments (for example `TMP117 → ADS1115 → …`) light up when the matching
  pulse starts in the film; the exploded-view chips fill as each module lifts.
- Signal materials are recoloured to the site palette (gold for SDA/data, pink
  for SCL/clock, amber for SPI/analog) and get a soft additive glow.
- Small pointer parallax, module labels on hover, a chapter rail and a timeline
  scrubber. Pixel ratio adapts if frames get slow.
- `assets/pathos-hardware-poster.webp` shows while the model loads and stays as
  the fallback if WebGL or the model is unavailable; titles still follow the scroll.

## Tests

With the local server running on port 8000:

```sh
node deliverables/test-prototype.cjs
node deliverables/test-prototype-fallbacks.cjs
```

The first checks every chapter (shot, titles, frame counter), that the final card
stays hidden until frame 2598, route timing on the sensor highway, reverse
scrubbing, rail navigation, the phone layout and reduced motion, and writes
captures plus `validation.json` to this folder. The second checks a missing model,
a failed Draco decoder and no WebGL.
