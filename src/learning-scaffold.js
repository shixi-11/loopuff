// Worked examples are separate from assessed drafts and never award progress.
export const learningExamples = Object.freeze({
  run: '3.log()',
  change: '4.log()',
  repair: '2.log()',
  calculate: '(2 + 3).log()',
  name: 'let energy = 5;\n(energy + 2).log()',
  score: 'if score > 9 then { 1.log() } else { 0.log() }',
  select: 'choose(2)',
  control: 'start();\nright()',
  repeat: 'start();\nfor n in [1, 2] { right() }',
  finish: 'pause()',
  strategy: 'if x < targetX then { right() } else { drop() }'
});

export function learningStage(index) { return index < 3 ? 0 : index < 6 ? 1 : 2; }
