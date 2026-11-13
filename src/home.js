import {course} from './course.js';
import {lessonWork} from './progress.js';
import {startProgress} from './learning-paths.js';
import {run} from './runner.js';

export function homeDestination(state,work){
 const current=course[state.lesson]?.id,completed=state.completed||[];
 if(lessonWork(state,current)||completed.length||startProgress(work).length===6){
  return {view:'lesson',lessonId:lessonWork(state,current)?current:(course.find(item=>!completed.includes(item.id))||course.at(-1)).id,resumed:true};
 }
 return {view:'start',resumed:Object.keys(work).some(key=>key.startsWith('start-')||key.startsWith('arcade-'))};
}
export function inspectHomeSignal(value){
 if(!/^\d{1,2}$/.test(value))return {ok:false};
 const source=`${Number(value)}.log()`,result=run(source);
 return {ok:true,source,logs:result.logs};
}
