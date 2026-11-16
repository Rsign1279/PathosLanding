# Hero film render

`scene.html` is the three.js scene for the hero loop (marble slabs, gold edges,
bloom). It expects `three@0.170.0` in `./node_modules` and `marble.webp`
(copy of `assets/marble.webp`) next to it, served on http://127.0.0.1:8002/.

    npm i three@0.170.0
    node render.cjs 1920 1080 480 ./land        # landscape, 16 s at 30 fps
    node render.cjs 1080 1920 480 ./port        # portrait cut
    ffmpeg -framerate 30 -i land/f%04d.png -c:v libx264 -preset veryslow -crf 24 -pix_fmt yuv420p -g 60 -movflags +faststart -an ../../assets/hero/hero.mp4
    ffmpeg -framerate 30 -i port/f%04d.png -c:v libx264 -preset veryslow -crf 24 -pix_fmt yuv420p -g 60 -movflags +faststart -an ../../assets/hero/hero-portrait.mp4

Frame 0 of each cut (WebP, quality 82) is `assets/hero/hero-poster*.webp`.
