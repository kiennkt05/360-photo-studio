# 360° Photo Studio — GPano Metadata & Initial View Editor

A static, dependency-free web app for editing the initial view of an **equirectangular 360° image** and exporting a JPEG with **Google Photo Sphere (GPano) XMP metadata**. Designed for photographs exported from cameras like Insta360 X4.

**Demo/deployment:** Upload `index.html`, `styles.css`, `app.js`, and `.nojekyll` into the root of any GitHub repository, then enable **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**. Your public address will be `https://USERNAME.github.io/REPOSITORY/`.

## Features

- Open local JPG/PNG panorama images, validating near-2:1 equirectangular aspect ratio.
- Interactive 360 perspective viewer: pointer drag, wheel zoom, keyboard arrows.
- Interactive equirectangular overview map for picking the view direction.
- Fine-grained Heading, Pitch and horizontal FOV controls.
- Optional horizontal **pixel rotation** that moves your chosen heading to the equirectangular image center, improving compatibility with viewers that ignore `InitialViewHeadingDegrees`.
- Standard JPEG APP1 XMP/GPano metadata:
  - `UsePanoramaViewer`, `ProjectionType`, full panorama dimensions, crop dimensions and offsets.
  - `InitialViewHeadingDegrees`, `InitialViewPitchDegrees`, `InitialHorizontalFOVDegrees`.
  - `PoseHeadingDegrees`, `PosePitchDegrees`, `PoseRollDegrees`.
- JPG quality and maximum width controls. Never upsamples.
- 100% local browser processing; no external scripts, CDNs, image uploads, analytics or server-side rendering.

## Quick start

1. Open `index.html` in Chrome, Edge, Firefox, or Safari. Works offline.
2. Import a 2:1 equirectangular JPG/PNG exported in *360° mode* (not Flat/Reframe).
3. Drag the viewer or use the angle sliders to frame the desired initial view.
4. Leave **Xoay panorama về giữa** enabled for best compatibility.
5. Click **Xuất JPG 360° + GPano**, then upload the downloaded JPG to Facebook.

## Notes and limitations

- The exported JPEG is **re-encoded**. The original EXIF/XMP and GPS are not retained; only new GPano XMP is added.
- On extremely large images, mobile browsers may run out of memory; use the downscaling selector.
- If the input is not a true 360 equirectangular panorama, adding GPano tags will not magically make it 360.
- Facebook/Meta controls its own 360 photo handling. Recognition and initial heading can differ across Facebook products, clients, and upload interfaces. Do a test post first.
- "Heading" is image-relative. Without an actual compass bearing, the app does not claim the scene is georeferenced.
- The UI is not affiliated with Insta360 or Meta.

## Host on GitHub Pages

1. Create a **public** GitHub repository, e.g. `360-photo-studio`.
2. Upload the contents of this project folder to the repository root (not the ZIP itself).
3. Under **Settings → Pages**, select **Deploy from a branch**, branch **main**, folder **/(root)**, then click **Save**.
4. Once GitHub Pages deployment completes, visit `https://USERNAME.github.io/360-photo-studio/`.

Documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

GPano reference: https://developers.google.com/streetview/spherical-metadata

## License

MIT — see LICENSE.
