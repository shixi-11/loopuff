# Learning workbench

The home remains an illustrated flight scene. Reading, lesson selection, games and assessment use an ivory-and-sage workbench, with dark teal reserved for the code editor and live game scene.

`public/ui.css` is applied after the base and vault styles in the bundled stylesheet. It owns the learning-page palette and the compact illustrated arcade layout. `src/arcade-art.js` contains the original decorative SVG signs; the real games retain their existing execution rules.

The level page highlights the first unfinished lesson while keeping every existing lesson available. Completed lessons retain their status. The recommendation uses the existing localized start/next labels and does not create a new completion or grading rule.

Verification covers the rendered home, levels, playground, guide, lesson brief, prediction, result and vault error/success states. The playground was checked in all 11 locales at a narrow emulated browser width, including right-to-left Arabic. These checks do not claim physical phone or software-keyboard testing. Contrast calculations cover solid reading surfaces; artwork and gradients also require visual inspection.


## Navigation

The Lessons navigation link carries the completed-lesson count. It replaces the second route button, so the header has four distinct destinations and the language selector. Lesson cards and the flight challenge use real localized links, while ordinary clicks retain the in-page transition. The unused route dialog has been removed; all four lessons remain available on the full-page selector.

At narrow widths the navigation uses four equal columns, a minimum 44px target and localized short labels for the introduction. Verification at a 320px CSS viewport covered all eleven locales, including Arabic RTL, with no horizontal overflow or clipped navigation labels. A real first-lesson run covered pause/resume, prediction, explanation, editing, assessment and completion; the 1/4 progress persisted through an English switch and reload. This was browser emulation, not physical-phone or software-keyboard testing.

## Home aircraft and language picker

The home aircraft has a reserved space beside the first instruction, wrapping below it on narrow screens. The hero and footer follow document flow so longer translations do not collide with the aircraft. The original world image, centered headline and accent are retained.

The transparent aircraft control supports pointer capture, touch dragging and arrow-key movement. Home or Enter restores the default position; a double click does the same. Release clamps the full footprint to the scene and finds the nearest clear position away from reading and navigation. Its position is transient and does not modify learning progress. The typing-game aircraft retains its existing behavior.

The language picker remains a native select with a consistent chevron, text padding and a 44px target. Arabic mirrors the chevron and spacing. The narrow typing header uses an icon-only pause control with its full accessible name.

The home and typing-game aircraft now render the user's approved transparent PNG, `public/assets/aircraft-2d.png`, rather than the simplified canvas paths. The source is copied byte for byte (SHA-256 `4387e91ea4a75568716daaedf05dcf891435e4c95913551c4ad27b4e7e9901e4`), preserving its eyes, colors and alpha. Hovering and dragging do not draw an enclosing circle. Keyboard focus uses a small underline; pointer capture, movement and reset behavior are retained.

Validation: 28 automated checks, real desktop mouse drag/drop over controls, keyboard movement/reset, all eleven locales at 320 CSS pixels, and a narrow typing-page header check. Browser emulation does not substitute for a physical touch-device test.
