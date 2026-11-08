# PATHOS landing page

Static landing page for PATHOS, with a scroll-driven 3D hardware study built
from the Blender scene `PATHOS_Hardware_Detail_1080p60.blend`.

Run from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/#prototype to review the ten-chapter 3D section.
Scroll to scrub the film; the chapter rail on the right jumps between shots.

Three.js and the Draco decoder are bundled locally. The 3D model is
`assets/pathos-hardware.glb` (exported from Blender, ~2.2 MB). The `.blend`
source stays out of git; see [the 3D section notes](deliverables/pathos-hardware/README.md)
for how the model is exported, how scroll maps to frames, and how to run the tests.

The dashboard in the model shows simulated signals, not live readings or V4 inference.
