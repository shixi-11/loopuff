# Diagnostic learning path

This design extends the active learning goal. It is not a claim that the diagnostic UI is already available.

## Observable contract

A learner submits one program per concept area. The program runs against several changing inputs, including empty lists, zero and threshold boundaries where appropriate. Feedback shows the actual inputs, expected and observed output, runtime errors and contributing language concepts. Different correct programs remain valid. Correct constants, unused declarations and replies that never contribute to an output do not establish a skill.

Nine areas cover named calculations, branches, list iteration, stateful iteration, synchronous function results, function replies, one message, joint messages and a combined dispatch task. Existing lesson IDs and the bounded runner are reused. Native checks of original examples use the fixed ALUX source and existing verified compiler build; private upstream source is not published or sent to translation services.

Checks describe these programs on these inputs. They do not certify general mastery, grant course completion or change historical course grades. Learners may choose any area, enter an existing independent task or revisit its foundations. Beginners keep the normal guided path. Hints are optional and progressive; a new practice set retains code but requires checking it again without reviving an old result.

## State and compatibility proposal

The intended state is an optional `course.state.diagnostic` record with its own version, seed, selected area, bounded per-area drafts, matching submitted sources and hint levels. Reports and passed flags are derived from real execution, not imported as trusted scores. Editing invalidates the submitted source even if the text is later changed back. Invalid records must remain available through raw recovery rather than being overwritten silently.

The five existing save domains and their IDs remain. Old files without a diagnostic remain readable. Same-seed conflicts choose a complete per-area draft/submission/hint record; different seeds choose a whole diagnostic run. A cloud writer that omits an existing diagnostic must not erase it, even with a matching revision. Stale revisions still return a conflict. The backend must understand the optional field before the public UI can upload it.

## Verification and remaining integration

The core needs positive alternatives, hard-coded and unused-computation negatives, zero/empty/threshold cases, deterministic seeds, waiting/runtime failure cases, edit/reset invalidation and native original-program comparisons. File/cloud round trips, legacy preservation, explicit merge choices, progressive hints, keyboard/mobile/RTL UI and actual beginner use are separate gates. Until those are integrated and verified, the core must not be described as a shipped diagnostic experience.

The core and optional course-save contract are implemented. Completed call events carry source spans and their actual synchronous/reply kind; function diagnostics check the host entry call, so an unrelated helper or a function-selection reply cannot supply false mechanism evidence. Ordinary `fn` with a normal return remains a valid inferred synchronous function. All nine areas share the waiting check. A new set changes the low seed bits used by the combined dispatch task, not merely the seed number.

Current checks include 161 frontend tests, 17 isolated backend tests, and 54 representative original-program comparisons against the pinned native build. These checks establish the implemented core and compatibility behaviour; diagnostic UI, its restore interaction and learner outcomes remain unverified.
