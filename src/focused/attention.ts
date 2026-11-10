import type {DiagramModel,DiagramNode} from './types.js';
const styles={
 context:{accent:'#737373',fill:'#fafafa',border:'#c4c4c4',ink:'#525252',calloutFill:'#f5f5f5',titleSize:20,calloutSize:16,iconSize:32,strokeWidth:1,weight:500},
 focus:{accent:'#087f72',fill:'#f2fbf8',border:'#087f72',ink:'#17463e',calloutFill:'#e5f6ef',titleSize:26,calloutSize:24,iconSize:52,strokeWidth:2.5,weight:700},
 problem:{accent:'#c52d32',fill:'#fff6f5',border:'#c52d32',ink:'#772328',calloutFill:'#ffe9e7',titleSize:26,calloutSize:28,iconSize:52,strokeWidth:3,weight:700},
} as const;
export const attentionStyle=(attention:DiagramNode['attention'])=>attention?styles[attention]:undefined;
/** Opt-in presentation hierarchy. Original graph and explicit paint remain intact. */
export function focusModel(model:DiagramModel):DiagramModel{
 if(model.kind!=='overview'||!model.nodes.some(n=>n.attention)&&!model.edges.some(e=>e.attention))return model;
 return {...model,
  nodes:model.nodes.map(n=>{
   const attention=n.attention??'context',s=styles[attention];
   return {...n,attention,paint:{fill:s.fill,stroke:s.border,color:s.ink}};
  }),
  groups:model.groups.map(g=>({...g,paint:{fill:'#fafafa',stroke:'#d4d4d4',color:'#626262'}})),
  edges:model.edges.map(e=>{
   const attention=e.attention??'context',s=styles[attention];
   return {...e,attention,stroke:s.accent,strokeWidth:attention==='context'?1.4:attention==='problem'?5:3,
    calloutSize:e.calloutSize??s.calloutSize};
  })
 };
}

export function focusTypography(node:DiagramNode){
 if(!['focus','problem'].includes(node.attention??''))return undefined;
 const choices={
  sans:{family:'"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',measureScale:1},
  serif:{family:'"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',measureScale:1.12},
  mono:{family:'"Noto Sans Mono CJK JP", "SFMono-Regular", Menlo, monospace',measureScale:1.3}
 };
 return node.fontFamily?choices[node.fontFamily]:undefined;
}
