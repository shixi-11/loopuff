import {course} from './course.js';
import {run} from './runner.js';

// Reuse the executable, native-checked course examples. The scene is a log viewer,
// not a second interpreter or an animation standing in for program execution.
export const guideStations=['signal','addition','names','branch','repeat','function','reply','join'].map(id=>course.find(item=>item.id===id));
export function readGuideWork(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(guideStations.filter(s=>typeof value[s.id]==='string').map(s=>[s.id,value[s.id].slice(0,4096)]));
}
export function executeGuide(source){
 try{return {ok:true,source,result:run(source)};}
 catch(error){return {ok:false,source,code:error.code||'syntax',position:error.position??0};}
}
export const comparisonPrograms={
 signal:{python:'print(7)',javascript:'console.log(7);',rust:'fn main() {\n    println!("{}", 7);\n}'},
 addition:{python:'print(2 + 3)',javascript:'console.log(2 + 3);',rust:'fn main() {\n    println!("{}", 2 + 3);\n}'},
 names:{python:'n = 5\nprint(n + 2)',javascript:'let n = 5;\nconsole.log(n + 2);',rust:'fn main() {\n    let n = 5;\n    println!("{}", n + 2);\n}'},
 branch:{python:'fuel = 6\nif fuel > 4:\n    print(1)\nelse:\n    print(2)',javascript:'let fuel = 6;\nif (fuel > 4) {\n  console.log(1);\n} else {\n  console.log(2);\n}',rust:'fn main() {\n    let fuel = 6;\n    if fuel > 4 {\n        println!("1");\n    } else {\n        println!("2");\n    }\n}'},
 repeat:{python:'for dock in [2, 4, 6]:\n    print(dock)',javascript:'for (const dock of [2, 4, 6]) {\n  console.log(dock);\n}',rust:'fn main() {\n    for dock in [2, 4, 6] {\n        println!("{}", dock);\n    }\n}'},
 function:{python:'def combine(a, b):\n    return a + b\n\nload = combine(3, 4)\nprint(load)',javascript:'function combine(a, b) {\n  return a + b;\n}\nconst load = combine(3, 4);\nconsole.log(load);',rust:'fn combine(a: i32, b: i32) -> i32 {\n    a + b\n}\nfn main() {\n    let load = combine(3, 4);\n    println!("{}", load);\n}'}
};
export const comparisonSources={python:'https://docs.python.org/3/tutorial/controlflow.html',javascript:'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',rust:'https://doc.rust-lang.org/book/ch03-00-common-programming-concepts.html'};
