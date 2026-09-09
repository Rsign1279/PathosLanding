# PATHOS — studio revision 2

This replaces the first review with rebuilt hardware surfaces, smooth manufactured edges, readable Arial lettering, more PCB detail, cleaner harness routing, reframed shots, and a native full-HD animation.

## Deliverables

- `PATHOS_FullHD_v2.mp4`: 1920 × 1080, 24 distinct rendered frames per second, 48 seconds. H.264 high-quality delivery. All 1,152 frames are rendered. No frame duplication, interpolation, depth-of-field blur, or motion blur.
- `PATHOS_Studio_v2.blend`: complete editable ten-shot scene. Opens in camera view at frame 1. Physical components, electrodes, screen hinge, cable endpoint morphs, synthetic waveforms, and presentation effects remain separately controllable. Fonts are packed. The saved scene uses Cycles at 128 samples for high-quality final rendering.
- `PATHOS_Controller_4K.png`: 3840 × 2160 Cycles close-up rendered at 128 samples. This is a high-resolution still, separate from the video.
- `PATHOS_Web_v2.glb`: standard glTF 2.0 binary asset for broad viewer compatibility.
- `PATHOS_Web_v2_Draco.glb`: geometry-compressed alternative, requiring a Draco decoder in the web renderer.
- `storyboard.png`: ten-shot contact sheet.
- `asset_manifest.json`, `validation.json`, `blender_validation.json`: geometry, connection metadata and verification results.

The movie uses Blender EEVEE with 16 antialiasing samples and direct studio lighting. It is not an upscaled version of the original preview. The 4K still uses Cycles. Soft studio lighting and detailed PBR materials are retained in the Blender file. The physical model is approximately 437,000 triangles with 57 mesh objects; the additional detail favors close-up inspection. For a lower-end mobile website, produce a dedicated LOD or bake small silkscreen geometry into texture atlases.

## Editing

Open the `.blend` in Blender 5.2 or newer. Numpad 0 enters camera view; Space plays the timeline. Ten named timeline markers identify the shots. The animation runs from frames 1–1152 at 24 fps. The geometry uses meters; the breadboard is 166 × 63 mm with a 2.54 mm socket pitch.

`PATHOS_ROOT` owns the physical system. `Breadboard_Assembly` contains the breadboard, individually named modules, and `Wires`. The electrodes, power bank and laptop are separate children of the root. `MicroSD_Card` is separately movable under its breakout; `Laptop_Screen` pivots at the hinge. Static local details are consolidated per module, while cable meshes preserve source and destination morph targets for the exploded view. `Editorial_HUD` owns the vector captions; `Presentation_FX` owns signal markers and temporary highlights. These presentation elements are excluded from the physical web asset.

## Electrical representation and accuracy

This is an improved reference-based visualization. The board outlines, component placement and underlying breadboard contact usage are representative, not fabrication CAD or an electrically verified assembly. Exact breakout vendors and revisions were not supplied. Increased render quality does not certify hardware accuracy.

- ESP32-S3 GPIO8 = SDA and GPIO9 = SCL. TMP117, ADS1115, MPU6050, MAX30102 and BME280 share the modeled I2C bus.
- ADS1115 ADDR is visibly strapped to VDD, representing 0x49. Other assumed addresses: TMP117 0x48, MPU6050 0x68, MAX30102 0x57, BME280 0x76.
- Electrodes → GSR module → ADS1115 A0 → I2C → ESP32-S3. GSR is not connected directly to an ESP32 ADC input.
- Dedicated SD SPI: GPIO12 CLK, GPIO13 MISO, GPIO11 MOSI, GPIO10 CS.
- Breakout logic and supply are assumed 3.3 V compatible, with common ground. Jumper routes express these logical nets; crimp junctions, passive values, pull-up population, and terminal-strip use require verification before physical construction.
- The USB power bank powers the ESP32. The laptop has no physical data or power cable to the prototype.
- The controller is a USB-C DevKitC-style interpretation. Official DevKitC revisions can differ in connector type and exact geometry.
- TMP117 has an accessible thermal island; the MAX30102 optical window and BME280 air aperture are exposed.

The dashboard, V4 labels, numeric readings and moving signal markers are synthetic presentation data. The scene does not perform physiological analysis or V4 inference.

## Web export

The GLBs preserve physical component animation, wire deformation and dashboard waveform morphs. Lighting, the cinema camera, vector captions, illustration particles and procedural material microstructure remain Blender presentation features. Recreate these in the web renderer when needed. The base PBR material values are exported. Load the standard GLB for a decoder-free path, or configure Draco support for the compressed alternative. Play the scene animation to explode and reassemble; stop at time zero for an assembled model controlled through object names.

## Reproduction

`rebuild.sh` generates the source, rebuilds and refines the scene, exports the GLBs, renders the full native-24-fps movie and 4K still, and runs the checks. It requires Blender, Python 3 and ffmpeg. The build scripts use macOS Arial font paths; the completed Blender file has the fonts packed for portability. Override `BLENDER_BIN` when necessary. A full render is substantial work; PNG frames are resumable and can be removed after video encoding.

## References

- User-supplied PATHOS multiview image and system specification.
- Espressif DevKitC documentation: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/index.html
- TI ADS1115 address selection: https://www.ti.com/lit/an/sbaa408a/sbaa408a.pdf
