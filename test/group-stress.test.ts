import {beforeAll,expect,it} from 'vitest';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {boxesOverlap,segmentIntersectsBox,textWidth,wrapText} from '../src/focused/layout.js';
import {groupContains} from '../src/focused/groups.js';
import {OUTPUT_THEME} from '../src/focused/theme.js';
import type {DiagramLayout,DiagramBox} from '../src/focused/types.js';
beforeAll(installDiagramIcons);
const dir='test/fixtures/group-stress';
const contains=(a:DiagramBox,b:DiagramBox)=>b.x>=a.x-.01&&b.y>=a.y-.01&&b.x+b.width<=a.x+a.width+.01&&b.y+b.height<=a.y+a.height+.01;
function metrics(l:DiagramLayout){
 let nodeHits=0,headerHits=0,labelHits=0,bends=0,length=0,direct=0,maxDetour=1,crossings=0,sharedSegments=0;
 for(const e of l.edges){
  bends+=Math.max(0,e.points.length-2);let distance=0;
  for(let k=1;k<e.points.length;k++){
   const a=e.points[k-1],b=e.points[k];distance+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
   for(const n of l.nodes)if(!(e.edge.from===n.node.id&&k===1)&&!(e.edge.to===n.node.id&&k===e.points.length-1)&&segmentIntersectsBox(a,b,n,-1))nodeHits++;
   for(const g of l.groups){const header={x:g.x+16,y:g.y+9,width:Math.min(g.width-32,textWidth(g.group.label,OUTPUT_THEME.groupFontSize)),height:wrapText(g.group.label,g.width-34,OUTPUT_THEME.groupFontSize).length*17+5};if(segmentIntersectsBox(a,b,header,0))headerHits++;}
   for(const o of l.edges)if(o!==e&&o.labelBox&&segmentIntersectsBox(a,b,o.labelBox,0))labelHits++;
  }
  const a=e.points[0],b=e.points[e.points.length-1]!;const shortest=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);length+=distance;direct+=shortest;
  if(e.edge.from!==e.edge.to)maxDetour=Math.max(maxDetour,distance/Math.max(1,shortest));
 }
 for(const [i,e] of l.edges.entries())for(const o of l.edges.slice(i+1))for(let k=1;k<e.points.length;k++)for(let j=1;j<o.points.length;j++){
  const a=e.points[k-1],b=e.points[k],c=o.points[j-1],d=o.points[j];
  if(a.x===b.x&&c.x===d.x&&a.x===c.x&&Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))>Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))||a.y===b.y&&c.y===d.y&&a.y===c.y&&Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))>Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)))sharedSegments++;
  if(a.x===b.x&&c.y===d.y&&a.x>Math.min(c.x,d.x)&&a.x<Math.max(c.x,d.x)&&c.y>Math.min(a.y,b.y)&&c.y<Math.max(a.y,b.y)||a.y===b.y&&c.x===d.x&&c.x>Math.min(a.x,b.x)&&c.x<Math.max(a.x,b.x)&&a.y>Math.min(c.y,d.y)&&a.y<Math.max(c.y,d.y))crossings++;
 }
 return {nodeHits,headerHits,labelHits,crossings,sharedSegments,bends,maxDetour:+maxDetour.toFixed(3),detour:+(length/Math.max(1,direct)).toFixed(3),aspect:+(l.width/l.height).toFixed(3),nodeAreaRatio:+(l.nodes.reduce((sum,n)=>sum+n.width*n.height,0)/(l.width*l.height)).toFixed(3),width:l.width,height:l.height};
}
const names=readdirSync(dir).filter(n=>n.endsWith('.mmd')).map(n=>n.slice(0,-4));
it.each(names.flatMap(name=>(name.startsWith('scale-')?['LR']:['LR','RL','TB','BT']).map(direction=>({name,direction}))))('stress $name / $direction: geometry, routing, size and latency',async({name,direction})=>{
 const m=await parseDiagram(readFileSync(`${dir}/${name}.mmd`,'utf8').replace('flowchart LR',`flowchart ${direction}`));expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const snapshot=JSON.stringify(m),start=performance.now(),r=renderDiagram(m),ms=performance.now()-start,l=r.layout;
 expect(JSON.stringify(m)).toBe(snapshot);expect(r.svg).not.toMatch(/NaN|Infinity/);expect(l.nodes).toHaveLength(m.nodes.length);expect(l.edges).toHaveLength(m.edges.length);
 for(const [i,n] of l.nodes.entries())for(const o of l.nodes.slice(i+1))expect(boxesOverlap(n,o),`${n.node.id}/${o.node.id}`).toBe(false);
 for(const [i,g] of l.groups.entries()){
  if(g.group.parent)expect(contains(l.groups.find(p=>p.group.id===g.group.parent)!,g)).toBe(true);
  for(const n of l.nodes)if(groupContains(m,g.group.id,n.node.group))expect(contains(g,n)).toBe(true);else expect(boxesOverlap(g,n)).toBe(false);
  for(const h of l.groups.slice(i+1))if(!groupContains(m,g.group.id,h.group.id)&&!groupContains(m,h.group.id,g.group.id))expect(boxesOverlap(g,h)).toBe(false);
 }
 for(const box of [...l.nodes,...l.groups,...l.edges.flatMap(e=>e.labelBox?[e.labelBox]:[])])expect(contains({x:0,y:0,width:l.width,height:l.height},box),'within canvas').toBe(true);
 for(const e of l.edges)for(let i=1;i<e.points.length;i++)expect(e.points[i].x===e.points[i-1].x||e.points[i].y===e.points[i-1].y,'orthogonal route').toBe(true);
 const measured=metrics(l);
 if(process.env.GROUP_METRICS_REPORT)writeFileSync(`${process.env.GROUP_METRICS_REPORT}/${name}.${direction}.metrics.json`,JSON.stringify({...measured,ms:Math.round(ms),diagnostics:r.model.diagnostics},null,2)+'\n');
 const baselinePath=`${dir}/${name}.${direction}.metrics.json`;
 if(process.env.UPDATE_GROUP_METRICS)writeFileSync(baselinePath,JSON.stringify(measured,null,2)+'\n');
 else {
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
  // Fixed fixtures: catch routing/area degradation, but allow improvements.
  for(const key of ['crossings','sharedSegments','bends','maxDetour','detour'] as const)expect(measured[key],key).toBeLessThanOrEqual(baseline[key]+.001);
  expect(l.width*l.height,'canvas area').toBeLessThanOrEqual(baseline.width*baseline.height*1.01);
  expect(Math.max(measured.aspect,1/measured.aspect),'aspect imbalance').toBeLessThanOrEqual(Math.max(baseline.aspect,1/baseline.aspect)*1.01);
 }
 if(process.env.UPDATE_GROUP_METRICS)writeFileSync(`/private/tmp/group-stress-${name}-${direction}.json`,JSON.stringify({...measured,ms:Math.round(ms),diagnostics:r.model.diagnostics}));
 expect(measured.nodeHits).toBe(0);expect(measured.headerHits).toBe(0);expect(measured.labelHits).toBe(0);
 expect(ms).toBeLessThan(10000);
},60000);

it('is deterministic and keeps requested grid order across repeated renders',async()=>{
 const m=await parseDiagram(readFileSync(`${dir}/mixed-spans.mmd`,'utf8'));
 const first=renderDiagram(m).layout;expect(renderDiagram(m).layout).toEqual(first);
 const g=(id:string)=>first.groups.find(g=>g.group.id===id)!;
 expect(g('G0').x).toBeLessThan(g('G1').x);expect(g('G1').x).toBeLessThan(g('G2').x);
 expect(g('G0').y).toBe(g('G1').y);expect(g('G1').y).toBe(g('G2').y);
 expect(g('G3').x).toBe(g('G1').x);expect(g('G3').y).toBeGreaterThan(g('G1').y);
 expect(g('G4').x).toBe(g('G0').x);expect(g('G4').y).toBeGreaterThanOrEqual(g('G0').y+g('G0').height);
});
