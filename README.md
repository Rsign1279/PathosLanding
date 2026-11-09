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

## Page structure

The page tells one story, in this order:

1. **Hero** (`#hero`): the result people want ("See stress building before it
   spills over") without the thing they fear (a $200 wearable, the cloud).
2. **Proof**: partner logos, a results band (`#proof`), the v1 software tour
   (`#device-tour`), partners (`#impact`) and the project log (`#journey`).
3. **Problem** (`#problem`): a live chart of the gap between what the body
   shows and what people see, plus the real cost of missing it.
4. **Solution** (`#solution`): eight feature cards, each with a benefit and a
   live mini visual, linking to the deep dives that follow (`#philosophy`,
   `#sensors`, `#ai`, `#hardware`, `#prototype`, `#product`, `#pathos-iot`,
   `#roadmap`, `#workshops`).
5. **How it works** (`#how`): the three-step demo flow (place, verify,
   observe) with a live scene that plays each step.
6. **Founder** (`#team`) and **FAQ** (`#faq`).
7. **Final call to action** (`#contact`) and the illustrated footer.

`story.js` also makes in-page links land exactly: sections render lazily, so
it renders them for a moment before aiming and corrects if needed.

Test: `node deliverables/test-story.cjs`

## Interactive explanations (`play.js`, `play.css`)

- **One reading can mean anything:** each signal card shows a live trace in the
  shape that signal really has (pulse, skin conductance, skin temperature,
  motion). Tap the signals you'd see together and a meter reads the
  combination: one signal could be anything, movement explains it away, and
  heart rate + sweat + cold fingers while still is the strong sign.
- **Sensor table:** a small live trace per sensor; hovering a row shows what
  that signal looks like when it reacts.
- **How PATHOS makes a call:** the four steps run in sequence while on screen;
  hovering or focusing a step holds it.
- **Project log:** a rail fills as you scroll and each milestone lights up.
- Partner numbers count up when they come into view, and the contact email has
  a copy button. Traces only draw while visible; reduced motion keeps
  everything still.

Test: `node deliverables/test-play.cjs`
