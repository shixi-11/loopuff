import {arcadeLearningSteps,arcadeLearningIds,inspectArcadeLearning} from './arcade-learning.js';
import {arcadeWorkKey} from './guide-work.js';
export function arcadeLearningSource(work,id){return work[arcadeWorkKey(id)]??arcadeLearningSteps.find(step=>step.id===id)?.starter??'';}
export function arcadeLearningProgress(work){return arcadeLearningIds.filter(id=>work[arcadeWorkKey(id,true)]===arcadeLearningSource(work,id)&&inspectArcadeLearning(id,arcadeLearningSource(work,id)).ok);}
export function requestedArcadeLearningStep(input,work){const id=new URL(input).searchParams.get('step');if(arcadeLearningIds.includes(id))return id;const passed=new Set(arcadeLearningProgress(work));return arcadeLearningIds.find(id=>!passed.has(id))||arcadeLearningIds.at(-1);}
