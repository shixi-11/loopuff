# Learning workbench

The home remains an illustrated flight scene. Reading, lesson selection, games and assessment use an ivory-and-sage workbench, with dark teal reserved for the code editor and live game scene.

`public/ui.css` is applied after the base and vault styles in the bundled stylesheet. It owns the learning-page palette and the compact illustrated arcade layout. `src/arcade-art.js` contains the original decorative SVG signs; the real games retain their existing execution rules.

The level page highlights the first unfinished lesson while keeping every existing lesson available. Completed lessons retain their status. The recommendation uses the existing localized start/next labels and does not create a new completion or grading rule.

Verification covers the rendered home, levels, playground, guide, lesson brief, prediction, result and vault error/success states. The playground was checked in all 11 locales at a narrow emulated browser width, including right-to-left Arabic. These checks do not claim physical phone or software-keyboard testing. Contrast calculations cover solid reading surfaces; artwork and gradients also require visual inspection.
