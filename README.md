# PATHOS landing page

Static landing page with a real, scroll-controlled Three.js prototype experience.

Run from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/#prototype to review the ten-chapter 3D story.
Explore mode supports component selection, bounded orbit/zoom, touch, and keyboard controls.

The repository includes the original web GLBs and locally bundled Three.js and
Draco dependencies. Large Blender source scenes, rendered frame sequences, and
movies remain in the original local project and are not required to run the site.

Implementation and test details: [interactive prototype notes](deliverables/PROTOTYPE_WEB_README.md).
The dashboard shows simulated signals, not live readings or actual V4 inference.

This is source code only; no public hosting deployment is configured here.
