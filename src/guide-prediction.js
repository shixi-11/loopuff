// Predictions describe one run's observations, never a score or mastery claim.
export function readPrediction(raw='',silent=false){
 if(silent)return [];
 if(!raw.trim())return null;
 return raw.replace(/\r\n?/g,'\n').trim().split('\n').map(line=>line.trim());
}
export function comparePrediction(predicted,report){
 if(predicted===null||!report)return null;
 if(!report.ok)return {kind:'error'};
 if(report.result.waiting)return {kind:'waiting'};
 const actual=report.result.logs;
 const index=Array.from({length:Math.max(predicted.length,actual.length)},(_,i)=>i).find(i=>predicted[i]!==actual[i]);
 return index===undefined?{kind:'matched',count:actual.length}:{kind:'different',index,expected:predicted[index]??null,actual:actual[index]??null};
}
