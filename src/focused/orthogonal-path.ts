import type {DiagramPoint} from './types.js';
/** Small corner radius, bounded by adjacent segments; endpoints remain exact. */
export function roundedOrthogonalPath(points:DiagramPoint[],radius=5):string {
 if(!points.length)return '';
 let d=`M ${points[0].x} ${points[0].y}`;
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],u=Math.hypot(b.x-a.x,b.y-a.y),v=Math.hypot(c.x-b.x,c.y-b.y),r=Math.min(radius,u/2,v/2);
  if(!r||a.x===b.x&&b.x===c.x||a.y===b.y&&b.y===c.y){d+=` L ${b.x} ${b.y}`;continue;}
  d+=` L ${b.x-(b.x-a.x)/u*r} ${b.y-(b.y-a.y)/u*r} Q ${b.x} ${b.y} ${b.x+(c.x-b.x)/v*r} ${b.y+(c.y-b.y)/v*r}`;
 }
 if(points.length>1)d+=` L ${points[points.length-1].x} ${points[points.length-1].y}`;
 return d;
}
