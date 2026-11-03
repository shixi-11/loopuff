# Diagnostic learning path

This feature extends the active learning goal. `/guide/check/` is a guide subpage; the three main navigation destinations remain unchanged.

## Observable contract

A learner submits one program per concept area. The program runs against several changing inputs, including empty lists, zero and threshold boundaries where appropriate. Feedback shows the actual inputs, expected and observed output, runtime errors and contributing language concepts. Different correct programs remain valid. Correct constants, unused declarations and replies that never contribute to an output do not establish a skill.

Nine areas cover named calculations, branches, list iteration, stateful iteration, synchronous function results, function replies, one message, joint messages and a combined dispatch task. Existing lesson IDs and the bounded runner are reused. Native checks of original examples use the fixed ALUX source and existing verified compiler build; private upstream source is not published or sent to translation services.

Checks describe these programs on these inputs. They do not certify general mastery, grant course completion or change historical course grades. Learners may choose any area, enter an existing independent task or revisit its foundations. Beginners keep the normal guided path. Hints are optional and progressive; a new practice set retains code but requires checking it again without reviving an old result.

## State and compatibility

The optional `course.state.diagnostic` record has its own version, seed, selected area, bounded per-area drafts, matching submitted sources and hint levels. Reports and passed flags are derived from real execution, not imported as trusted scores. Editing invalidates the submitted source even if the text is later changed back. Invalid records remain available through raw recovery rather than being overwritten silently; replacing one requires two explicit clicks.

The five existing save domains and their IDs remain. Old files without a diagnostic remain readable. Same-seed conflicts choose a complete per-area draft/submission/hint record; different seeds choose a whole diagnostic run. A cloud writer that omits an existing diagnostic must not erase it, even with a matching revision. Stale revisions still return a conflict. The backend must understand the optional field before the public UI can upload it.

## Interaction and verification

The editor starts empty. Direction and incomplete code outlines are optional and never inserted into a draft. Changing inputs retains code, clears submissions and resets hints for that set; the interface reports whether hints were viewed for the current set, not independent authorship. Each real case exposes its input, expected and observed output, contributing methods and output source. Host-added function calls are identified separately from learner code. Existing guided and independent tasks remain directly accessible through the SPA, without granting course credit.

Saved submissions are re-executed sequentially after remount. Transient caches are tied to seed, source and a matching submission; editing and undo cannot revive old output. Deferred checks are cancelled on edits/navigation, and old save completions cannot overwrite the latest save notice.

The core and optional course-save contract are implemented. Completed call events carry source spans and their actual synchronous/reply kind; function diagnostics check the host entry call, so an unrelated helper or a function-selection reply cannot supply false mechanism evidence. Ordinary `fn` with a normal return remains a valid inferred synchronous function. All nine areas share the waiting check. A new set changes the low seed bits used by the combined dispatch task, not merely the seed number.

Current checks include 168 frontend tests, 17 isolated backend tests, and 54 representative original-program comparisons against the pinned native build. Real browser checks covered all nine programs, a hard-coded negative, invalidation, two hints without draft replacement, language/remount rechecks, independent-task navigation, same-task and whole-input-set backup comparisons, and a future-version recovery path. Eleven locales fit a 390px viewport; Arabic text remains RTL and code LTR. Production deployment is checked separately after Git synchronization. Actual beginner learning and long-term transfer outcomes remain unverified.
