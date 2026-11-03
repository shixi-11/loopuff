// Original bounded learning model; no JS evaluation or ambient host calls.
import { compile } from './language-parser.js';
import { LessonError } from './language-error.js';
const union=(...items)=>new Set(items.flatMap(item=>[...(item||[])]));
const value=(data,concepts=[])=>({data,concepts:new Set(concepts),dataConcepts:new Set(concepts),inputs:new Set()});
const derive=(v,extra=[])=>({...v,concepts:union(v.concepts,extra),dataConcepts:union(v.dataConcepts,extra),...(v.shapeConcepts?{shapeConcepts:union(v.shapeConcepts,extra),shapeDataConcepts:union(v.shapeDataConcepts,extra)}:{})});
const controlled=(v,extra)=>({...v,concepts:union(v.concepts,extra),...(v.shapeConcepts?{shapeConcepts:union(v.shapeConcepts,extra)}:{})});
const computed=(data,concepts,operands)=>({...value(data),concepts:union(concepts,...operands.map(v=>v.concepts)),dataConcepts:union(concepts,...operands.map(v=>v.dataConcepts)),inputs:union(...operands.map(v=>v.inputs))});
const control=(flow,...extra)=>({...flow,concepts:union(flow.concepts,...extra)});
export function run(source,{trace=false}={}){
  const program=compile(source),logs=[],outputs=[],calls=[],queue=[],waiting=[];
  let steps=0,callCount=0,channelCount=0,messageCount=0,printedSize=0,bindingId=0,receiveId=0;
  const jointInputs=[],events=[],messageTokens=new Map();let truncated=false,messageSerial=0,requestSerial=0;
  // Lists in a scene are bounded previews; log events retain the full printed value.
  const snapshot=data=>{
    let remaining=192;
    const visit=(item,depth=0)=>{
      if(remaining<4)return '…';
      if(Array.isArray(item)){
        if(depth>=4){remaining-=3;return '[…]';}
        remaining-=2;const parts=[];
        for(let index=0;index<item.length;index++){
          if(index>=16||remaining<4){parts.push('…');break;}
          if(index)remaining-=2;parts.push(visit(item[index],depth+1));
        }
        return '['+parts.join(', ')+']';
      }
      const printed=item?.kind==='channel'?'@'+item.id:item?.kind==='function'?item.node.name+'(…)':String(item);
      const result=printed.length>remaining?printed.slice(0,remaining-1)+'…':printed;remaining-=result.length;return result;
    };return visit(data);
  };
  const record=(type,node,fields={},env,flow)=>{
    if(!trace)return;if(events.length>=512){truncated=true;return;}
    const event={type,sequence:events.length+1,context:flow?.callId||fields.context||0,start:node?.span?.start??0,end:node?.span?.end??0,...fields};
    for(const key of ['value','left','right'])if(Object.hasOwn(event,key))event[key]=type==='log'&&key==='value'?event[key]:snapshot(event[key]);
    for(const key of ['values','args'])if(event[key])event[key]=event[key].map(value=>snapshot(value));
    if(env){event.references=channelBindings(env);event.names=scalarNames(env);event.bindingIds=Object.fromEntries(Object.keys(event.names).map(name=>[name,env.get(name).bindingId]));}events.push(event);
  };
  const bind=(v,id=++bindingId)=>({...v,bindingId:id});
  const spend=node=>{if(++steps>20000)throw new LessonError('limit',node?.span?.start||0);};
  const fail=(code,node)=>{throw new LessonError(code,node?.span?.start||0);};
  const integer=(n,node)=>{if(!Number.isSafeInteger(n)||Math.abs(n)>1000000)fail('limit',node);return n;};
  const numeric=(v,node)=>{if(typeof v.data!=='number')fail('type',node);return v.data;};
  const boolean=(v,node)=>{if(typeof v.data!=='boolean')fail('type',node);return v.data;};
  const channel=(v,node)=>{if(v.data?.kind!=='channel')fail('type',node);return v.data;};
  const fresh=(single=false)=>({kind:'channel',id:++channelCount,messages:[],single,spent:false});
  const scalarNames=env=>Object.fromEntries([...env].filter(([,v])=>typeof v.data==='number'||typeof v.data==='boolean').map(([name,v])=>[name,v.data]));
  const channelBindings=env=>[...env].filter(([,v])=>v.data?.kind==='channel').map(([name,v])=>({name,channel:v.data.id,bindingId:v.bindingId}));
  const carry=(outer,inner,keys)=>{for(const key of keys)if(inner.has(key)&&inner.get(key).bindingId===outer.get(key)?.bindingId)outer.set(key,inner.get(key));};
  function display(data,node){
    let size=0;
    const add=part=>{size+=part.length;if(size>4096||printedSize+size>16000)fail('limit',node);return part;};
    const format=item=>{
      if(Array.isArray(item))return add('[ ')+item.map(child=>format(child)+add(' ')).join('')+add(']');
      if(typeof item!=='number'&&typeof item!=='boolean')fail('subset',node);
      return add(String(item));
    };
    const printed=format(data);printedSize+=size;return printed;
  }
  function* expression(node,env,flow){
    spend(node);
    if(node.type==='number'||node.type==='boolean')return value(node.value,[node.type]);
    if(node.type==='name'){
      const bound=env.get(node.name);if(!bound)fail('name',node);
      return derive(bound,['name','bind']);
    }
    if(node.type==='list'){
      if(node.values.length>256)fail('limit',node);
      const values=[];for(const item of node.values)values.push(yield* expression(item,env,flow));
      return {...computed(values.map(v=>v.data),['list'],values),elements:values,shapeConcepts:new Set(['list']),shapeDataConcepts:new Set(['list']),shapeInputs:new Set()};
    }
    if(node.type==='unary'){
      const v=yield* expression(node.expr,env,flow);
      return computed(node.op==='-'?integer(-numeric(v,node),node):!boolean(v,node),['unary'],[v]);
    }
    if(node.type==='call'){
      const callee=yield* expression(node.callee,env,flow),fn=callee.data;
      if(fn?.kind!=='function')fail('type',node);
      const args=[...fn.bound];for(const arg of node.args)args.push(yield* expression(arg,env,flow));
      if(args.length>fn.node.params.length)fail('arity',node);
      if(args.length<fn.node.params.length)return {...callee,data:{...fn,bound:args}};
      if(flow.depth>=32||++callCount>1024)fail('limit',node);
      const callEnv=new Map(fn.closure);
      fn.node.params.forEach((name,index)=>callEnv.set(name,bind(args[index])));
      const invocation=callCount;
      const next=control({...flow,depth:flow.depth+1,callId:invocation},callee.concepts,['call']);
      if(fn.node.async){
        if(flow.sync)fail('subset',node);
        const reply=fresh(true);
        record('call',node,{name:fn.node.name,kind:'reply',invocation,args:args.map(v=>v.data),replyChannel:reply.id},env,flow);
        yield {kind:'fork',tasks:[execute(fn.node.body,callEnv,{...next,reply,sync:false})]};
        const [answer]=yield {kind:'receive',channels:[reply],span:node.span,names:[],reply:true,context:flow.callId||0,request:trace?++requestSerial:0,references:trace?channelBindings(env):[],scalarNames:trace?scalarNames(env):{},scalarBindings:trace?Object.fromEntries([...env].filter(([,v])=>typeof v.data==='number'||typeof v.data==='boolean').map(([name,v])=>[name,v.bindingId])):{}};
        calls.push({...node.span,kind:'reply'});record('call-result',node,{name:fn.node.name,kind:'reply',invocation,value:answer.data},env,flow);
        return controlled(derive(answer,union(callee.dataConcepts,['call'])),callee.concepts);
      }
      record('call',node,{name:fn.node.name,kind:'sync',invocation,args:args.map(v=>v.data)},env,flow);
      const result=yield* execute(fn.node.body,callEnv,{...next,reply:null,sync:true});
      if(result?.kind!=='return')fail('type',node);
      calls.push({...node.span,kind:'sync'});record('call-result',node,{name:fn.node.name,kind:'sync',invocation,value:result.value.data},env,flow);
      return controlled(derive(result.value,union(callee.dataConcepts,['call'])),callee.concepts);
    }
    if(node.type==='loop'){
      const state=new Map(env),keys=[...env.keys()].filter(name=>!node.names.includes(name));
      for(let i=0;i<node.names.length;i++)state.set(node.names[i],bind(yield* expression(node.values[i],env,flow)));
      for(;;){
        spend(node);
        const inner=new Map(state),result=yield* execute(node.body,inner,control(flow,['loop']));
        if(result?.kind==='return')fail('subset',node);
        if(result?.kind==='break'){carry(env,inner,keys);return derive(result.value,['loop']);}
        if(result?.kind!=='continue')fail('subset',node);
        node.names.forEach((name,index)=>state.set(name,bind(result.values[index],state.get(name).bindingId)));
        carry(state,inner,keys);
      }
    }
    // and/or evaluate both operands; there is no JS-style short circuit here.
    const left=yield* expression(node.left,env,flow),right=yield* expression(node.right,env,flow);
    const concepts=union(left.concepts,right.concepts,[node.type]);let result;
    if(node.type==='logical'){
      const a=boolean(left,node),b=boolean(right,node);result=node.op==='and'?a&&b:a||b;
    }else if(node.type==='compare'){
      if(node.op==='=='||node.op==='!='){
        if([left.data,right.data].some(v=>v&&typeof v==='object'))fail('subset',node);
        const same=JSON.stringify(left.data)===JSON.stringify(right.data);result=node.op==='=='?same:!same;
      }else{
        const a=numeric(left,node),b=numeric(right,node);result=node.op==='<'?a<b:node.op==='<='?a<=b:node.op==='>'?a>b:a>=b;
      }
    }else{
      const a=numeric(left,node),b=numeric(right,node);
      if((node.op==='/'||node.op==='%')&&b===0)fail('zeroDivision',node);
      result=integer(node.op==='+'?a+b:node.op==='-'?a-b:node.op==='*'?a*b:node.op==='/'?Math.trunc(a/b):a%b,node);
    }
    record('calculate',node,{operator:node.op,left:left.data,right:right.data,value:result},env,flow);
    return {...computed(result,[node.type],[left,right]),concepts};
  }
  function* execute(nodes,env,flow){
    for(const node of nodes){
      spend(node);
      switch(node.type){
        case 'bind':case 'assign':{
          const v=yield* expression(node.expr,env,flow);
          env.set(node.name,bind(controlled(derive(v,union(['bind'],node.type==='assign'?['assign']:[])),flow.concepts),node.type==='assign'?env.get(node.name).bindingId:undefined));record(node.type,node,{name:node.name,bindingId:env.get(node.name).bindingId,value:v.data,...(v.data?.kind==='channel'?{channel:v.data.id}:{})},env,flow);break;
        }
        case 'channel':env.set(node.name,bind(value(fresh(),union(flow.concepts,['channel','bind']))));record('channel',node,{name:node.name,bindingId:env.get(node.name).bindingId,channel:env.get(node.name).data.id},env,flow);break;
        case 'function':{
          const closure=new Map(env),fn=bind(value({kind:'function',node,closure,bound:[]},['function']));
          closure.set(node.name,fn);env.set(node.name,fn);record('function',node,{name:node.name,params:node.params,kind:node.async?'reply':'sync'},env,flow);break;
        }
        case 'expression':yield* expression(node.expr,env,flow);break;
        case 'log':{
          const v=yield* expression(node.expr,env,flow);
          if(v.data&&typeof v.data==='object'&&!Array.isArray(v.data))fail('subset',node);
          if(logs.length>=256)fail('limit',node);
          const printed=display(v.data,node);logs.push(printed);
          const dataConcepts=union(v.dataConcepts);
          if(jointInputs.some(group=>group.every(input=>v.inputs.has(input))))dataConcepts.add('join');
          outputs.push({...node.span,value:printed,names:scalarNames(env),concepts:[...union(v.concepts,flow.concepts)].sort(),dataConcepts:[...dataConcepts].sort()});record('log',node,{value:printed,index:logs.length-1},env,flow);break;
        }
        case 'block':{
          const result=yield* execute(node.body,env,flow);if(result)return result;break;
        }
        case 'parallel':{
          const next=control(flow,['parallel']);
          yield {kind:'fork',tasks:node.branches.map(branch=>execute(branch,new Map(env),next))};
          break;
        }
        case 'if':{
          const condition=yield* expression(node.condition,env,flow),branch=boolean(condition,node)?node.yes:node.no;
          record('branch',node.condition,{value:condition.data},env,flow);
          const branchFlow=control(flow,condition.concepts,['if']);
          const inner=new Map(env),result=yield* execute(branch,inner,branchFlow);
          carry(env,inner,[...env.keys()]);if(result)return result;
          // A skipped early exit also decides whether the remaining sequence runs.
          const exits=body=>body.some(item=>['return','break','continue'].includes(item.type)||item.type==='block'&&exits(item.body)||item.type==='if'&&(exits(item.yes)||exits(item.no)));
          if(exits(node.yes)||exits(node.no))flow.concepts=union(flow.concepts,branchFlow.concepts);
          break;
        }
        case 'while':{
          const keys=[...env.keys()];
          for(;;){
            spend(node);const condition=yield* expression(node.condition,env,flow);const active=boolean(condition,node);record('while',node.condition,{value:active},env,flow);if(!active)break;
            const inner=new Map(env),result=yield* execute(node.body,inner,control(flow,condition.concepts,['while']));
            carry(env,inner,keys);if(result?.kind==='return')return result;if(result?.kind==='break')break;
            if(result?.kind==='continue')fail('subset',node);
          }break;
        }
        case 'for':{
          let iterable;
          if(node.iterable.type==='range'){
            const a=yield* expression(node.iterable.start,env,flow),b=yield* expression(node.iterable.end,env,flow);
            const start=numeric(a,node),end=numeric(b,node)+(node.iterable.inclusive?1:0),length=Math.max(0,end-start);
            if(length>256)fail('limit',node);
            const elements=Array.from({length},(_,index)=>computed(start+index,['range'],[a,b]));
            const range=computed(elements.map(v=>v.data),['range'],[a,b]);
            iterable={...range,elements,shapeConcepts:range.concepts,shapeDataConcepts:range.dataConcepts,shapeInputs:range.inputs};
          }else iterable=yield* expression(node.iterable,env,flow);
          if(!Array.isArray(iterable.data))fail('type',node);if(iterable.data.length>256)fail('limit',node);
          record('list',node,{name:node.name,value:iterable.data},env,flow);
          const keys=[...env.keys()].filter(name=>name!==node.name);
          for(const [index,item] of iterable.data.entries()){
            const shape=iterable.shapeConcepts||new Set();
            spend(node);const inner=new Map(env),next=control(flow,shape,['for']);
            const element=derive(iterable.elements?.[index]||value(item),['for']);
            inner.set(node.name,bind({...controlled(element,shape),dataConcepts:union(element.dataConcepts,iterable.shapeDataConcepts),inputs:union(element.inputs,iterable.shapeInputs)}));
            record('iteration',node,{name:node.name,value:item,index},inner,flow);
            const result=yield* execute(node.body,inner,next);carry(env,inner,keys);
            if(result?.kind==='return')return result;if(result?.kind==='break')break;if(result?.kind==='continue')fail('subset',node);
          }break;
        }
        case 'return':{
          const v=yield* expression(node.expr,env,flow),answer=controlled(v,flow.concepts);
          if(node.reply){if(!flow.reply)fail('type',node);send(flow.reply,derive(answer,['reply']),node,flow,env);yield {kind:'tick'};break;}
          record('return',node,{value:answer.data},env,flow);return {kind:'return',value:answer};
        }
        case 'break':{
          const v=node.expr?yield* expression(node.expr,env,flow):value(null);
          return {kind:'break',value:controlled(v,flow.concepts)};
        }
        case 'continue':{
          const values=[];for(const item of node.values){const v=yield* expression(item,env,flow);values.push(controlled(v,flow.concepts));}
          return {kind:'continue',values};
        }
        case 'send':{
          const target=yield* expression(node.channel,env,flow),v=yield* expression(node.expr,env,flow);
          const delivery=union(target.concepts,flow.concepts,['send']);
          send(channel(target,node),{...controlled(derive(v,['send']),delivery),delivery},node,flow,env);
          yield {kind:'tick'};break;
        }
        case 'receive':{
          const targets=[];for(const binding of node.bindings)targets.push(yield* expression(binding.channel,env,flow));
          const messages=yield {kind:'receive',channels:targets.map(v=>channel(v,node)),span:node.span,names:node.bindings.map(binding=>binding.name),context:flow.callId||0,request:trace?++requestSerial:0,references:trace?channelBindings(env):[],scalarNames:trace?scalarNames(env):{},scalarBindings:trace?Object.fromEntries([...env].filter(([,v])=>typeof v.data==='number'||typeof v.data==='boolean').map(([name,v])=>[name,v.bindingId])):{}};
          const inner=new Map(env),next=control(flow,...messages.map(v=>v.delivery||[]),...targets.map(v=>v.concepts),['receive'],node.bindings.length>1?['join']:[]);
          const group=node.bindings.map((_,index)=>`${++receiveId}:${index}`);
          if(group.length>1)jointInputs.push(group);
          node.bindings.forEach((binding,index)=>{
            const received=derive(messages[index],['receive']);
            inner.set(binding.name,bind({...received,inputs:union(received.inputs,[group[index]]),...(received.shapeInputs?{shapeInputs:union(received.shapeInputs,[group[index]])}:{})}));
          });
          record('received-names',node,{bindings:node.bindings.map(binding=>binding.name),values:messages.map(message=>message.data)},inner,flow);
          const result=yield* execute(node.body,inner,next);if(result)return result;break;
        }
        default:fail('subset',node);
      }
    }
    return null;
  }
  function send(target,message,node,flow,env){
    if(target.single&&target.spent)fail('replyUsed',node);
    if(++messageCount>256)fail('limit',node);target.spent=true;target.messages.push(message);if(trace){if(!messageTokens.has(target.id))messageTokens.set(target.id,[]);messageTokens.get(target.id).push(++messageSerial);record('send',node,{channel:target.id,message:messageSerial,value:message.data,reply:target.single,context:flow.callId||0},env,flow);}
  }
  function consume(channels,origin){
    const counts=new Map();for(const target of channels)counts.set(target,(counts.get(target)||0)+1);
    for(const [target,count] of counts)if(target.messages.length<count)return null;
    const messages=channels.map(target=>target.messages.shift());messageCount-=messages.length;if(trace)record('receive',origin,{channels:channels.map(target=>target.id),messages:channels.map(target=>messageTokens.get(target.id).shift()),bindings:origin.names,values:messages.map(message=>message.data),reply:!!origin.reply,request:origin.request,context:origin.context,references:origin.references,names:origin.scalarNames,bindingIds:origin.scalarBindings});return messages;
  }
  queue.push({task:execute(program,new Map(),{concepts:new Set(),depth:0,sync:false,reply:null}),resume:undefined});
  try{while(queue.length){
    spend();if(queue.length+waiting.length>128)fail('limit');
    const job=queue.shift(),next=job.task.next(job.resume);job.resume=undefined;
    if(!next.done){
      const event=next.value;
      if(event.kind==='fork'){for(const task of event.tasks)queue.push({task,resume:undefined});queue.push(job);}
      else if(event.kind==='receive'){
        const messages=consume(event.channels,event);
        if(messages){job.resume=messages;queue.push(job);}else {record('wait',event,{channels:event.channels.map(target=>target.id),bindings:event.names,reply:!!event.reply,request:event.request,context:event.context,references:event.references,names:event.scalarNames,bindingIds:event.scalarBindings});waiting.push({...job,channels:event.channels,origin:event});}
      }else queue.push(job);
    }
    for(let i=0;i<waiting.length;){
      const job=waiting[i],messages=consume(job.channels,job.origin);
      if(messages){waiting.splice(i,1);job.resume=messages;queue.push(job);}else i++;
    }
  }
  }
  catch(error){if(trace&&error instanceof LessonError)error.recording={events,truncated,logs:[...logs],outputs:[...outputs]};throw error;}
  return {logs,outputs,calls,steps,statementCount:program.length,waiting:waiting.length,...(trace?{recording:{events,truncated}}:{})};
}
