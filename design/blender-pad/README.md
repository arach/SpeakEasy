# SpeakEasy micro → iPad study

An original Blender model inspired by the tactile layout of Work Louder’s Codex Micro. No third-party meshes or video frames are embedded.

- `speakeasy-micro.blend`: editable geometry, named component groups, materials, camera, and studio lights.
- `build.py`: reproducible model generator (Blender 5.2).
- `../../landing/public/models/speakeasy-micro.glb`: web export.
- `../../landing/lib/pad-scene.ts`: Three.js lighting, scroll poses, and the iPad screen texture (a presentation snapshot of the current Pad Console design, with lane bank, active task, waveform and speech controls).

Rebuild from the repository root:

```sh
blender --background --python design/blender-pad/build.py
cd landing
pnpm run build:pad-scene
pnpm dev --hostname 127.0.0.1
```

Open `/codex#transformation`. Scroll forward and backward. The Blender key groups persist across the transition: hollow keycaps lift away from the dark switch housings and lavender stems, settle back, then the hardware contracts and expands into nine software lanes. The browser uses separate UV-mapped finishes for satin plastic, matte rubber and directionally brushed metal. Optical keycaps and the frosted frame have distinct transmission and roughness settings. Broad studio area lights supplement the reflection environment. The page loads the GLB and renderer once, and renders only when the scroll pose or viewport changes.

Reduced motion displays the final iPad pose. If WebGL or the asset cannot load, the CSS illustration remains available. GPU resources are released when the page is removed. This animation is a visual demonstration, not an interactive task controller.

Design references:

- https://worklouder.cc/codex-micro
- https://x.com/JaydenDavisNC/status/2097043600605319525
- https://x.com/DataChaz/status/2096150343096889835
