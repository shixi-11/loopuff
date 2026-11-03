import {course} from './course.js';
import {dispatchIds} from './dispatch.js';
import {diagnosticIds,diagnosticLessons} from './diagnostic.js';
import {learningContext,learningPrerequisites} from './learning-map.js';
import {routeUrl} from './routing.js';

const applications={branch:'branch',repeat:'manifest',function:'fuel',coordination:'relay'};
export function lessonApplication(id){
 if(!course.some(item=>item.id===id))throw Error('Unknown learning concept');
 return applications[id]??null;
}
export function diagnosticApplication(area,passed){
 if(!diagnosticIds.includes(area))throw Error('Unknown diagnostic area');
 const checked=new Set(passed);
 if(!checked.has(area))return null;
 return diagnosticIds.every(id=>checked.has(id))?'relay':applications[area]??null;
}
export function nextDiagnosticArea(area,passed){
 if(!diagnosticIds.includes(area))throw Error('Unknown diagnostic area');
 const checked=new Set(passed),combination=learningPrerequisites.coordination;
 if(checked.has('join')&&!checked.has('coordination'))return combination.find(id=>!checked.has(id))||'coordination';
 const lesson=diagnosticLessons[area].at(-1);
 const direct=learningContext(lesson).next.filter(id=>diagnosticIds.includes(id)&&!checked.has(id)&&
  (id!=='coordination'||combination.every(key=>checked.has(key))));
 if(direct.length)return direct[0];
 const at=diagnosticIds.indexOf(area),forward=[...diagnosticIds.slice(at+1),...diagnosticIds.slice(0,at)];
 return forward.find(id=>!checked.has(id))??null;
}
export function requestedDispatchMission(input){
 const id=new URL(input).searchParams.get('mission');return dispatchIds.includes(id)?id:null;
}
export function dispatchMissionUrl(input,locale,mission){
 if(!dispatchIds.includes(mission))throw Error('Unknown dispatch mission');
 const url=routeUrl(input,locale,'dispatch');url.hash='';
 for(const key of ['practice','return','area','mode'])url.searchParams.delete(key);
 url.searchParams.set('mission',mission);return url;
}
