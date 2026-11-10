import type {DiagramBox,DiagramLayout,DiagramPoint} from './types.js';
import {boxesOverlap,wrapText,segmentIntersectsBox} from './layout.js';

/** Annotations are presentation objects, never graph vertices. */
export function placeEdgeCallouts(layout:DiagramLayout):DiagramLayout {
 const callouts:NonNullable<DiagramLayout['edgeCallouts']>=[];
 let width=layout.width,height=layout.height;
 const occupied:DiagramBox[]=[...layout.nodes,...layout.edges.flatMap(e=>e.labelBox?[e.labelBox]:[])];
 for(const [edgeIndex,{edge,points}] of layout.edges.entries()){
  if(!edge.callout||edge.invisible)continue;
  const fontSize=edge.calloutSize??22,text=wrapText(edge.callout,284,fontSize),w=320,h=32+text.length*Math.ceil(fontSize*1.35);
  let longest=-1,anchor:DiagramPoint=points[0];
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
   if(length>longest){longest=length;anchor={x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  }
  const candidates=[
   {x:anchor.x-w/2,y:anchor.y-h-28},{x:anchor.x-w/2,y:anchor.y+28},
   {x:anchor.x+28,y:anchor.y-h/2},{x:anchor.x-w-28,y:anchor.y-h/2},
   {x:Math.max(24,anchor.x-w/2),y:height+24},
   {x:width+24,y:Math.max(64,anchor.y-h/2)}
  ].map(p=>({...p,width:w,height:h}));
  const box=candidates.find(b=>b.x>=24&&b.y>=64&&!occupied.some(o=>boxesOverlap(b,o))&&!layout.nodes.some(n=>segmentIntersectsBox(anchor,{x:Math.max(b.x+16,Math.min(anchor.x,b.x+b.width-16)),y:b.y+b.height/2},n,4))&&!layout.edges.some(e=>e.points.some((p,i)=>i>0&&segmentIntersectsBox(e.points[i-1],p,b,8))))??candidates[5];
  callouts.push({...box,text,fontSize,anchor,edgeIndex});occupied.push(box);
  width=Math.max(width,box.x+w+24);height=Math.max(height,box.y+h+24);
 }
 return callouts.length?{...layout,width,height,edgeCallouts:callouts}:layout;
}
