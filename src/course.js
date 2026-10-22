// Original introductory course. Content ids and executable text do not change with locale.
export const course = [
  {
    id:'signal', source:'7.log()', logs:['7'], fragments:['7','.log','()'],
    prediction:['7','0',''], predictionAnswer:0,
    remix:{template:'___.log()',solution:'9',source:'9.log()',logs:['9']},
    independent:{logs:['12'],require:[],example:'12.log()'}
  },
  {
    id:'addition',source:'(2 + 3).log()',logs:['5'],fragments:['(2 + 3)','.log','()'],
    prediction:['6','5','23'],predictionAnswer:1,
    remix:{template:'(2 + ___).log()',solution:'6',source:'(2 + 6).log()',logs:['8']},
    independent:{logs:['11'],require:['add'],example:'(4 + 7).log()'}
  },
  {
    id:'names',source:'let n = 5;\n(n + 2).log()',logs:['7'],fragments:['let n = 5;','\n','(n + 2)','.log','()'],
    prediction:['5','2','7'],predictionAnswer:2,
    remix:{template:'let n = ___;\n(n + 2).log()',solution:'8',source:'let n = 8;\n(n + 2).log()',logs:['10']},
    // The parser requires every name to be bound. Count using that binding once;
    // a separate 'bind' criterion would double-weight the same dependency.
    independent:{logs:['14'],require:['name','add'],example:'let energy = 10; (energy + 4).log()'}
  }
];
export const locales = [
  ['en','English'],['zh','简体中文'],['zh-Hant','繁體中文'],['ja','日本語'],['ko','한국어'],
  ['vi','Tiếng Việt'],['de','Deutsch'],['es','Español'],['ru','Русский'],['uk','Українська'],['ar','العربية']
];
export function hasConcept(program, type) {
  if (Array.isArray(program)) return program.some(node=>hasConcept(node,type));
  return program && typeof program==='object' && (program.type===type || Object.values(program).some(value=>hasConcept(value,type)));
}
