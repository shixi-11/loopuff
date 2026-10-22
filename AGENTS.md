# Loopuff project rules

- Build a programming-learning game for complete beginners, using Tolang. Score and typing speed are not measures of programming mastery.
- Chinese names: 环灵 (zh), 環靈 (zh-Hant). Every other locale uses Loopuff. Repository and URL slug: loopuff.
- Required locales: en, zh, zh-Hant, ja, ko, vi, de, es, ru, uk, ar. Translate interface, lessons, assessments, hints and errors; never silently mix languages. Keep code and output unchanged. Arabic text is RTL; code is LTR.
- Keep translations structurally aligned with the source content. Switching language must preserve lesson and progress. Check layouts for longer text and narrow screens.
- Teach purpose, meaning, observable behavior and trade-offs. Gradually remove scaffolding and accept distinct correct programs when the task permits.
- Grade independent code by actual execution, required output and concepts contributing to that output. Separate task scores from flight points; speed, retries and matching example text do not affect grades. Editing invalidates the displayed grade until resubmission. A task score does not certify language fluency.
- Describe only implemented features as available. Keep incomplete curriculum plans in developer documentation. No generated marketing filler or internal work narration in player-facing text.
- The introductory interpreter supports only its documented subset. Never label it the complete Tolang compiler or TVM. Validate new teaching semantics before publishing them.
- Do not add non-public upstream source, compiler binaries, private research, credentials or private repository history. The public project has its own Git history.
- Run npm test and npm run build before syncing. Check affected flows in the real browser. Do not merge unrelated website changes.
- PolyForm Noncommercial 1.0.0; preserve the official LICENSE text. Copyright and required notices belong in NOTICE. Commercial use requires separate written permission.
