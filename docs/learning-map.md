# Learning concept map

`/guide/map/` is a subpage of the existing guide, alongside the language comparison. The three main navigation entries remain unchanged. The map reuses all thirteen course IDs, examples and completion records; it does not create a second course or award completion merely for viewing or running an example.

## Learning paths

Four columns organize signals, control flow, functions and message coordination. Connections are teaching recommendations, not compiler dependencies or locked prerequisites. A selected concept shows its immediate foundations, places where it can be used, the existing task goal and an executable example. The suggested starting point is the first unfinished foundation in course order. Every task remains available regardless of that suggestion.

Beginners can enter the ordinary lesson flow. Experienced learners can enter the independent programming task directly; the `practice=independent` query also supports opening that link in a separate tab. The shortcut preserves existing drafts and does not grant a passing grade. This is a navigation shortcut, not an adaptive diagnostic or proof of mastery.

Example execution uses the existing guide runner and actual logs. Code labels identify syntax fragments rather than adding language features. The map does not implement a new interpreter, compiler or TVM.

## Representation and UI

`learning-map.js` owns lane membership, recommended foundations and syntax labels. Tests require the node and dependency sets to match the current course exactly and reject cycles. In particular, the while lesson retains its existing `counter` ID.

Selection is transient in the shared guide model and can be deep-linked through a lesson ID in the URL hash. It does not alter `guideSelected`, guide drafts, lesson work or grades. No new save domain or format is required. Initial hash selection and subsequent clicks synchronize the same transient field.

SVG connections use the rendered button positions. Non-adjacent connections within one column go around intermediate nodes. RTL reverses the entry/exit sides. The map scrolls within its own container on narrow screens; relation buttons focus and reveal their target. Dispose removes listeners, scheduled drawing and the resize observer.

## Remaining learning work

The map provides orientation and a direct practice route. The broader goal still includes multi-input diagnostics, recommendations based on observed performance, decreasing scaffolding, varied transfer tasks and more concrete lesson scenes. User learning outcomes require separate observation; course completion markers are not a mastery claim.
