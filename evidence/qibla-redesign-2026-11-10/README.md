# Qibla screen redesign: evidence (2026-11-10)

- `approved-mockup.jpg`: the owner's reference. Its numbers (61°, turn left 91°, London) are not used anywhere: the
  bearing comes from `qiblaBearing` (great circle, `src/qibla.ts`) for the saved place, the turn from the live heading.
- `before-web-qibla.jpg`: the screen before.
- iOS simulator (iPhone 16 Pro, full Debug build): `sim-ios-prayers-header.jpg` (mosque scene and gold wave under the
  title), `sim-ios-top-no-compass.jpg`, `sim-ios-bottom-no-compass.jpg`. The simulator has no magnetometer, so the screen
  says "No live compass", keeps north at the top and hides the phone pointer.
- Web build at 393 × 852 and 852 × 393. A heading was fed by a test hook added to the built `www/js/app.js` only (never
  in `src`, removed by the next build): `web-heading-149_5-turn-left-91.jpg` (saved place New York, bearing 58.5°,
  heading 149.5° → turn left 91°, N drawn at 210.5°), `web-magnetic-turn-right-38.jpg` (magnetic heading: "MAG" on the
  dial and the declination warning), `web-arabic-rtl.jpg`, `web-landscape-dark-facing.jpg`, `web-dark-north-up.jpg`.
- Not verified here: the live heading on a physical iPhone (the simulator has no compass).
