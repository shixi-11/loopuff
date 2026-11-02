# Continuous pursuit

Continuous pursuit is separate from the six short police/thief code experiments. The experiments retain their plans, debugging controls and `loopuff-chase-v1` save. Pursuit uses `loopuff-pursuit-v1`.

## Time and movement

The world advances in fixed 10 ms steps. The timer counts active simulated time while the page is visible, focused and running. Pausing, editing, opening settings, leaving the page or losing focus stops the clock. A frame gap above 250 ms pauses instead of catching up. Animation and reduced-motion preferences do not accelerate the simulation.

Each actor initially follows a separate twenty-section road. Every section has two paths; the shortest is 226 m. Speed is capped at 7.5 m/s, so the minimum road length is 4,520 m. Allowing for the 1.1 m contact radius still leaves a physical lower bound above 600 seconds. Reaching ten minutes alone does not decide the outcome.

The roads meet at a junction. An early police arrival continues backwards along the thief road to intercept. At later nodes the police can turn towards the rival's previous-step position. Route changes occur at nodes, and remaining movement carries across edges in metres. No lead cap, teleport or rubber-banding pads the duration.

Capture requires a jump-height difference below 0.8 m and either separation below 1.1 m on the same road, section and path, or a combined distance below 1.1 m from a shared node. Matching progress on separate roads is insufficient. Escape requires the thief to reach the end of the 200 m exit road. Capture takes precedence when both conditions hold in the same step.

Terrain, collisions, energy and route choices affect later movement. Supply points can be collected once per actor and physical point. Difficulty modifies the rival's behaviour and speed within the cap.

## Strategy execution

The editor runs the bounded learning subset of Tolang, not the full compiler or TVM. Source is limited to 3,000 characters. A successful execution produces one to eight integer signals:

- `1`: steady movement.
- `2`: sprint.
- `3`: request a jump.

One queued signal is consumed every 250 ms. When the queue empties, the program runs again with fresh `energy`, `obstacle`, `gap`, `round` and `rivalEnergy` inputs. `gap` describes signed route progress, not physical contact distance. Syntax/runtime errors, waiting receives and invalid signals pause before consuming that world step. Invalid deployment retains the previous strategy and queue. Direct sprint/jump controls and next-path selection remain available.

## Saving and recovery

`server/pursuit-format.mjs` supplies shared pure route, contact and validation rules. A save contains the current run and up to twenty completed-run summaries. Current state includes both actors, resources, direction, collected supplies, travelled distance, active time, strategy, draft, pending actions and recent events. Diagnostic reports are transient.

A restored running game opens paused and requires explicit resume; offline time is not simulated. One session survives language changes and SPA remounts. Active play saves periodically; edits, pauses and other changes also request saves. Pending writes use the shared progress writer. A save failure pauses play. Invalid stored bytes are preserved, with a separate raw recovery download on the saves page.

Each finished run is recorded once by its ID. Merge conflicts select an entire pursuit snapshot, including current run and history; positions, clocks and queues are never spliced between versions.

These are editable learning records, not trusted competitive results. Automated checks do not establish browser presentation, live deployment or beginner learning outcomes.
