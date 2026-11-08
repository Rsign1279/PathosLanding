# PATHOS landing page

Static landing page for PATHOS, with a scroll-driven 3D hardware study built
from the finished Blender film `PATHOS_Final_Complete.blend`.

Run from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/#prototype to review the ten-chapter 3D section.
Scroll to scrub the film; the chapter rail on the right jumps between shots.

Three.js and the Draco decoder are bundled locally. The 3D model is
`assets/pathos-hardware.glb` (exported from Blender, ~2.0 MB; phones load
`assets/pathos-hardware-mobile.glb`, ~1.4 MB). The `.blend`
source stays out of git; see [the 3D section notes](deliverables/pathos-hardware/README.md)
for how the model is exported, how scroll maps to frames, and how to run the tests.

The MacBook in the model shows screenshots of the PATHOS v1 software, not live readings or V4 inference.

## The build: photo deck (`#product`)

`field.js` + `field.css` turn the MVP 1 and field photos (`assets/field-*.webp`,
with `-sm` variants for phones) into a scroll-driven deck under the "The build"
heading. Scrolling moves the cards along a U-shaped path; the centred card faces
you, neighbours bank with the curve and turn, and outer cards flip to a marble
back with their caption. Sideways drag swipes, the arrows step, tapping a side
card centres it and tapping the centre card opens it in the lightbox. With
reduced motion or no JavaScript the photos show as a plain grid. The track
length scales with the number of cards (`--n` on `#flTrack`).
