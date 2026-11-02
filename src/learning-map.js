import {course} from './course.js';

// Teaching recommendations, not compiler dependencies or locked prerequisites.
// IDs refer to the existing lessons so the map cannot create parallel progress.
export const learningLanes=[['signal','addition','names','leap'],['comparison','branch','repeat','counter'],['function','reply'],['message','join','coordination']];
export const learningPrerequisites={signal:[],addition:['signal'],names:['addition'],leap:['addition'],comparison:['names'],branch:['comparison'],repeat:['names'],counter:['branch'],function:['names'],reply:['function'],message:['names'],join:['message'],coordination:['branch','function','join']};
export const learningSyntax={signal:'.log()',addition:'+',names:'let',leap:'.log()',comparison:'>',branch:'if',repeat:'for',counter:'while',function:'sync fn',reply:'return !',message:'! · ?',join:'<- & <-',coordination:'sync fn · if · ?'};
export function learningContext(id,completed=[]){
 if(!Object.hasOwn(learningPrerequisites,id))throw Error('Unknown learning concept');
 const known=new Set(completed.filter(key=>course.some(lesson=>lesson.id===key))),before=new Set();
 const visit=key=>{for(const parent of learningPrerequisites[key]){if(!before.has(parent)){before.add(parent);visit(parent);}}};visit(id);
 return {id,prerequisites:[...learningPrerequisites[id]],ancestors:course.filter(lesson=>before.has(lesson.id)).map(lesson=>lesson.id),
  next:course.filter(lesson=>learningPrerequisites[lesson.id].includes(id)).map(lesson=>lesson.id),
  completed:known.has(id),suggested:course.find(lesson=>before.has(lesson.id)&&!known.has(lesson.id))?.id||id};
}
