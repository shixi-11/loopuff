// Names in the existing guideWork dictionary; selected concept remains separate.
export const guideStationIds=['signal','addition','names','branch','repeat','function','reply','join'];
export const startStepIds=['run','change','repair','calculate','name','decide'];
export const startWorkKey=(id,checked=false)=>`start-${id}${checked?'-checked':''}`;
export const arcadeNewStepIds=['score','select','control','repeat','finish','strategy'];
export const arcadeWorkKey=(id,checked=false)=>startStepIds.includes(id)?startWorkKey(id,checked):`arcade-${id}${checked?'-checked':''}`;
export const guideWorkIds=[...guideStationIds,...startStepIds.flatMap(id=>[startWorkKey(id),startWorkKey(id,true)]),...arcadeNewStepIds.flatMap(id=>[arcadeWorkKey(id),arcadeWorkKey(id,true)])];
