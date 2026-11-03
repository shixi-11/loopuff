export const diagnosticIds=Object.freeze(['names','branch','repeat','counter','function','reply','message','join','coordination']);
export const diagnosticSourceLimit=3000;
export function normalizeDiagnostic(value){
 const fail=()=>{throw Error('DIAGNOSTIC_INVALID');},own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const record=(x,fields)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==fields.length||fields.some(k=>!own(x,k)))fail();};
 record(value,['version','seed','selected','drafts','submitted','hints']);
 if(value.version!==1||!Number.isInteger(value.seed)||value.seed<0||value.seed>0xffffffff||!diagnosticIds.includes(value.selected))fail();
 for(const key of ['drafts','submitted','hints'])record(value[key],diagnosticIds);
 const out={version:1,seed:value.seed,selected:value.selected,drafts:{},submitted:{},hints:{}};
 for(const id of diagnosticIds){
  const source=value.drafts[id],submitted=value.submitted[id],hint=value.hints[id];
  if(typeof source!=='string'||source.length>diagnosticSourceLimit||!(submitted===null||typeof submitted==='string'&&submitted.length<=diagnosticSourceLimit)||!Number.isInteger(hint)||hint<0||hint>2)fail();
  out.drafts[id]=source;out.submitted[id]=submitted===source?submitted:null;out.hints[id]=hint;
 }
 return out;
}
