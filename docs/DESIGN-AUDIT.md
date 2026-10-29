# Design audit (Hallmark, 2026-10-29)

Audited with [Hallmark](https://github.com/Nutlope/hallmark) (MIT, commit 8f6969f): its `sloplint.mjs` on `public/style.css`
and `public/index.html` (`--scope app`, static tier, no rendering), and its Floor rules read by hand. Hallmark was not
installed into the project or the agent, and its themes were not applied: the approved charcoal and gold design stays
(AGENTS.md). Only findings that improve accessibility or robustness without changing the look were fixed.

## Fixed

- No sideways page scroll: `overflow-x: clip` on `html` and `body` (sticky headers keep working; `hidden` would break them).
- Reduce Motion: the system setting is now honoured everywhere, not only the in-app switch (`.reduced-motion`).
- Keyboard focus: an outline on every focusable control, including `textarea`, `summary` and `[tabindex]`, and on the
  custom-counter fields (they relied on a border colour).
- Disabled controls also show a not-allowed cursor, not opacity alone.
- Progress bars no longer transition `width` (each render replaces them, so the transition never ran anyway).
- Headings balance their lines (`text-wrap: balance`); the tasbih count uses tabular figures; the white count over the
  heart is a declared token.

## Kept on purpose (Hallmark would change these; they are part of the approved design)

| Hallmark gate | Where | Why kept |
|---|---|---|
| 67 tracked capitals / eyebrows | `.eyebrow`, `.picker-label`, reader labels | The approved section labels ("ADHKAR", "NEXT PRAYER"). Changing them is a visual redesign: ask first. |
| 24b 4 px spacing scale | throughout | Approved spacing; 245 values, no user-visible defect. |
| 48 colour literals | reader themes (`--r-*` on `.reader`), highlight colours | Already custom properties, scoped to the reader's own paper and night themes. |
| 29 glass header and nav, gold glow | `.app-header`, `.bottom-nav`, cards | The approved charcoal and gold look. |
| 56 two sticky bars | `.app-header` + `.r-bar` | The reader hides the app header, so they never stack. |
| F22 justified text | `.flow-text` | Arabic Mushaf text is justified by convention and is not hyphenated. |
| 19 dash in copy, 20 Hallmark stamp | `index.html`, CSS line 1 | Copy style and a Hallmark-only build marker; not defects. |

## Not checked here

Contrast on the device, Dynamic Type at the largest sizes, and VoiceOver order need the iPhone (see RELEASE-CHECKLIST.md).
