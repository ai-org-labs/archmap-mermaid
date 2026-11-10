import type {DiagramBox,DiagramLayout,DiagramLayoutNode,DiagramModel,DiagramPoint} from './types.js';
import {overviewContent} from './layout.js';

function boundary(box:DiagramBox,to:DiagramPoint,node?:DiagramLayoutNode):DiagramPoint {
 const center={x:box.x+box.width/2,y:box.y+box.height/2},dx=to.x-center.x,dy=to.y-center.y;
 if(!dx&&!dy)return center;
 const rx=box.width/2,ry=box.height/2,shape=node?.node.flowShape;
 let scale=1/Math.max(Math.abs(dx)/rx,Math.abs(dy)/ry);
 if(shape&&['circle','dbl-circ','fr-circ','sm-circ','f-circ','cross-circ'].includes(shape))scale=1/Math.sqrt(dx*dx/(rx*rx)+dy*dy/(ry*ry));
 else if(shape==='diam'||node?.node.shape==='decision')scale=1/(Math.abs(dx)/rx+Math.abs(dy)/ry);
 return {x:center.x+dx*scale,y:center.y+dy*scale};
}
/** Direct routing changes edges only. Do not move or remove authored nodes. */
export function straightConnections(layout:DiagramLayout,model:DiagramModel):DiagramLayout {
 if(!layout.edges.some(e=>(e.edge.routing??model.routing)==='straight'))return layout;
 const lookup=(id:string)=>layout.nodes.find(n=>n.node.id===id)??layout.groups.find(g=>g.group.id===id);
 const body=(b:DiagramBox):DiagramBox=>model.kind==='overview'&&'node' in b?{...b,height:overviewContent((b as DiagramLayoutNode).node).body}:b;
 const center=(b:DiagramBox)=>({x:b.x+b.width/2,y:b.y+b.height/2});
 const edges=layout.edges.map(e=>{
  if((e.edge.routing??model.routing)!=='straight'||e.edge.from===e.edge.to)return e;
  const source=lookup(e.edge.from),target=lookup(e.edge.to);if(!source||!target)return e;
  const a=body(source),b=body(target),ac=center(a),bc=center(b);
  // Coincident/overlapping endpoints cannot yield a meaningful exterior segment.
  if(ac.x===bc.x&&ac.y===bc.y)return e;
  const start=boundary(a,bc,model.kind==='overview'?undefined:'node' in source?source:undefined),end=boundary(b,ac,model.kind==='overview'?undefined:'node' in target?target:undefined);
  if((end.x-start.x)*(bc.x-ac.x)+(end.y-start.y)*(bc.y-ac.y)<=0)return e;
  const labelBox=e.labelBox?{...e.labelBox,x:(start.x+end.x-e.labelBox.width)/2,y:(start.y+end.y-e.labelBox.height)/2}:undefined;
  return {...e,points:[start,end],labelBox};
 });
 return {...layout,edges,width:Math.max(layout.width,...edges.map(e=>e.labelBox?e.labelBox.x+e.labelBox.width+24:0)),height:Math.max(layout.height,...edges.map(e=>e.labelBox?e.labelBox.y+e.labelBox.height+24:0))};
}
