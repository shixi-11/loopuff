// Original parser for the explicitly supported learning subset, not tolangc.
import { LessonError } from './language-error.js';
const reserved = new Set(['let','log','if','then','else','for','in','while','loop','continue','break','sync','fn','return','true','false','and','or','not']);
const precedence = new Map([['or',1],['and',2],['==',3],['!=',3],['<',4],['<=',4],['>',4],['>=',4],['+',5],['-',5],['*',6],['/',6],['%',6]]);
const arithmetic = {'+':'add','-':'subtract','*':'multiply','/':'divide','%':'remainder'};
export function compile(source) {
  if(typeof source!=='string'||source.length>4096)throw new LessonError('limit');
  const tokens=[];let offset=0;
  while(offset<source.length){
    if(/\s/.test(source[offset])){offset++;continue;}
    if(source.startsWith('//',offset)){offset=source.indexOf('\n',offset);if(offset<0)break;continue;}
    const match=/^(\d+|[A-Za-z_][A-Za-z_0-9]*|\.\.=|\.\.|<-|==|!=|<=|>=|[+\-*/%().=;,{}\[\]<>!?&|])/.exec(source.slice(offset));
    if(!match)throw new LessonError('subset',offset);
    tokens.push({value:match[0],position:offset,end:offset+match[0].length});offset+=match[0].length;
    if(tokens.length>2048)throw new LessonError('limit',offset);
  }
  let cursor=0,depth=0,count=0;
  const peek=(ahead=0)=>tokens[cursor+ahead]?.value;
  const position=()=>tokens[cursor]?.position??source.length;
  const fail=code=>{throw new LessonError(code,position());};
  const take=value=>{if(peek()!==value)fail('syntax');return tokens[cursor++];};
  const optional=value=>peek()===value?(cursor++,true):false;
  const name=()=>{const value=peek();if(!/^[A-Za-z_]\w*$/.test(value||'')||reserved.has(value))fail('syntax');cursor++;return value;};
  const mark=(start,node)=>Object.assign(node,{span:{start,end:tokens[cursor-1]?.end??start}});
  function nested(fn){if(++depth>64)fail('limit');try{return fn();}finally{depth--;}}
  function block(){return nested(()=>{take('{');const body=sequence('}');take('}');return body;});}
  function argumentsList(){
    take('(');const values=[];
    if(peek()!==')')do{values.push(expression());}while(optional(','));
    take(')');return values;
  }
  function value(){return nested(()=>{
    const start=position();let node;
    if(optional('(')){node=expression();take(')');node={...node,grouped:true};}
    else if(optional('[')){
      const values=[];if(peek()!==']')do{values.push(expression());}while(optional(','));
      take(']');node={type:'list',values};
    }else if(peek()==='loop'){
      take('loop');take('(');const names=[],values=[];
      if(peek()!==')')do{names.push(name());take('=');values.push(expression());}while(optional(','));
      take(')');node={type:'loop',names,values,body:block()};
    }else if(peek()==='-'||peek()==='not'){
      const op=peek();cursor++;node={type:'unary',op,expr:value()};
    }else if(/^\d+$/.test(peek()||'')){
      const number=Number(tokens[cursor++].value);if(!Number.isSafeInteger(number)||number>1000000)fail('limit');
      node={type:'number',value:number};
    }else if(peek()==='true'||peek()==='false'){node={type:'boolean',value:peek()==='true'};cursor++;}
    else node={type:'name',name:name()};
    node=mark(start,node);
    while(peek()==='(')node=mark(start,{type:'call',callee:node,args:argumentsList()});
    return node;
  });}
  function expression(min=0){
    let left=value();
    while(precedence.has(peek())&&precedence.get(peek())>=min){
      const op=peek(),rank=precedence.get(op);cursor++;
      const right=expression(rank+1);
      left=mark(left.span.start,{type:arithmetic[op]||(rank<=2?'logical':'compare'),op,left,right});
    }
    return left;
  }
  function statement(){
    if(++count>256)fail('limit');
    const start=position();let node;
    if(optional('let')){
      const id=name();node=optional('=')?{type:'bind',name:id,expr:expression()}:{type:'channel',name:id};
      if(!optional(';')&&!['}', '|', undefined].includes(peek()))take(';');
    }else if(peek()==='fn'||peek()==='sync'){
      const sync=optional('sync');take('fn');const id=name();take('(');const params=[];
      if(peek()!==')')do{params.push(name());}while(optional(','));
      take(')');if(new Set(params).size!==params.length)fail('syntax');
      node={type:'function',name:id,params,sync,body:block()};optional(';');
    }else if(optional('if')){
      const condition=expression();take('then');const yes=block();let no=[];
      if(optional('else'))no=peek()==='if'?[statement()]:block();
      node={type:'if',condition,yes,no};optional(';');
    }else if(optional('while')){
      const condition=expression();node={type:'while',condition,body:block()};optional(';');
    }else if(optional('for')){
      const id=name();take('in');let iterable=expression();
      if(peek()==='..'||peek()==='..='){
        const inclusive=peek()==='..=';cursor++;
        iterable={type:'range',start:iterable,end:expression(),inclusive};
      }
      node={type:'for',name:id,iterable,body:block()};optional(';');
    }else if(optional('return')){
      const reply=optional('!');node={type:'return',reply,expr:expression()};optional(';');
    }else if(optional('break')){
      node={type:'break',expr:[';', '}', '|',undefined].includes(peek())?null:expression()};optional(';');
    }else if(optional('continue')){node={type:'continue',values:argumentsList()};optional(';');}
    else if(peek()==='{'){node={type:'block',body:block()};optional(';');}
    else if(optional('?')){
      take('(');const bindings=[];
      do{const id=name();take('<-');bindings.push({name:id,channel:expression()});}while(optional('&'));
      take(')');if(new Set(bindings.map(x=>x.name)).size!==bindings.length)fail('syntax');
      node={type:'receive',bindings,body:block()};optional(';');
    }else if(/^[A-Za-z_]\w*$/.test(peek()||'')&&peek(1)==='='){
      const id=name();take('=');node={type:'assign',name:id,expr:expression()};optional(';');
    }else{
      const expr=expression();
      if(optional('.')){
        if((expr.left||expr.type==='unary')&&!expr.grouped)fail('subset');
        take('log');take('(');take(')');node={type:'log',expr};
      }
      else if(optional('!'))node={type:'send',channel:expr,expr:expression()};
      else node={type:'expression',expr};
      optional(';');
    }
    return mark(start,node);
  }
  function sequence(end){
    const branches=[[]];
    while(cursor<tokens.length&&peek()!==end){
      if(optional('|')){if(!branches.at(-1).length)fail('syntax');branches.push([]);}
      else branches.at(-1).push(statement());
    }
    if(branches.length>1){if(!branches.at(-1).length)fail('syntax');return [{type:'parallel',branches,span:{start:branches[0][0].span.start,end:branches.at(-1).at(-1).span.end}}];}
    return branches[0];
  }
  const program=sequence(undefined);if(!program.length)fail('syntax');
  // Also bound left-associated trees before recursive validation or evaluation.
  const stack=[[program,0]];
  while(stack.length){const [item,level]=stack.pop();if(level>100)fail('limit');if(item&&typeof item==='object')for(const child of Object.values(item))if(child&&typeof child==='object')stack.push([child,level+1]);}
  validate(program,new Set(),{});
  return program;
}

function validate(nodes,names,context){
  const error=(code,node)=>{throw new LessonError(code,node.span?.start||0);};
  const returnsAll=body=>{
    const last=body.at(-1);if(!last)return false;
    return last.type==='return'&&!last.reply||last.type==='block'&&returnsAll(last.body)||last.type==='if'&&returnsAll(last.yes)&&returnsAll(last.no);
  };
  function check(node,known=names){
    if(!node)return;
    if(node.type==='name'){if(!known.has(node.name))error('name',node);return;}
    if(node.type==='loop'){
      node.values.forEach(value=>check(value,known));
      if(new Set(node.names).size!==node.names.length)error('syntax',node);
      validate(node.body,new Set([...known,...node.names]),{...context,loop:true,loopTailEligible:true,state:node.names,arm:false,tailCarry:null});return;
    }
    if(node.type==='range'){check(node.start,known);check(node.end,known);return;}
    for(const key of ['expr','left','right','callee'])if(node[key])check(node[key],known);
    for(const key of ['values','args'])if(node[key])node[key].forEach(value=>check(value,known));
  }
  for(const [index,node] of nodes.entries()){
    const loopTail=context.loopTailEligible&&index===nodes.length-1;
    switch(node.type){
      case 'bind':check(node.expr);names.add(node.name);break;
      case 'channel':names.add(node.name);break;
      case 'assign':
        if(!names.has(node.name))error('name',node);
        if(context.forBindings?.some(binding=>binding.name===node.name&&binding.collides))error('bindingScope',node);
        if(context.arm&&!context.tailCarry?.has(node.name))error('bindingScope',node);
        check(node.expr);break;
      case 'block':validate(node.body,names,{...context,loopTailEligible:loopTail});break;
      case 'parallel':
        if(context.sync||context.reply||context.loop)error('subset',node);
        node.branches.forEach(branch=>validate(branch,new Set(names),{...context,arm:false,tailCarry:null}));break;
      case 'if':
        check(node.condition);
        for(const branch of [node.yes,node.no])validate(branch,new Set(names),{...context,arm:true,loopTailEligible:loopTail,tailCarry:loopTail?new Set(names):null});
        break;
      case 'while':check(node.condition);validate(node.body,new Set(names),{...context,loop:true,loopTailEligible:true,arm:false,state:null,tailCarry:null});break;
      case 'for':check(node.iterable);validate(node.body,new Set([...names,node.name]),{...context,loop:true,loopTailEligible:true,arm:false,state:null,tailCarry:null,forBindings:[...(context.forBindings||[]),{name:node.name,collides:names.has(node.name)}]});break;
      case 'function':{
        names.add(node.name);
        const returns=[];
        const scan=value=>{if(!value||typeof value!=='object')return;if(value.type==='function')return;if(value.type==='return')returns.push(value.reply);for(const child of Object.values(value))if(child&&typeof child==='object')scan(child);};
        scan(node.body);
        if(returns.includes(true)&&returns.includes(false))error('type',node);
        node.async=returns.includes(true)||!returns.length;
        if(node.sync&&node.async)error('type',node);
        if(!node.async&&!returnsAll(node.body))error('type',node);
        validate(node.body,new Set([...names,...node.params]),{fn:true,sync:!node.async,reply:node.async,loop:false,arm:false});break;
      }
      case 'return':if(!context.fn)error('syntax',node);check(node.expr);break;
      case 'break':if(!context.loop||!context.state&&node.expr)error('syntax',node);check(node.expr);break;
      case 'continue':
        if(!context.state||node.values.length!==context.state.length)error('syntax',node);
        node.values.forEach(value=>check(value));break;
      case 'send':if(context.sync)error('subset',node);check(node.channel);check(node.expr);break;
      case 'receive':
        if(context.sync)error('subset',node);
        node.bindings.forEach(binding=>check(binding.channel));
        validate(node.body,new Set([...names,...node.bindings.map(binding=>binding.name)]),{...context,arm:false,tailCarry:null});break;
      default:check(node.expr);
    }
  }
}
