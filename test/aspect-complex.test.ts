import {readFileSync} from 'node:fs';
import {beforeAll,expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {segmentIntersectsBox,boxesOverlap} from '../src/focused/layout.js';
import type {DiagramLayout} from '../src/focused/types.js';
beforeAll(installDiagramIcons);
function defects(l:DiagramLayout){
 let crossing=0,shared=0,nodeHits=0,labelHits=0;
 for(const [i,e] of l.edges.entries())for(let k=1;k<e.points.length;k++){
  const a=e.points[k-1]!,b=e.points[k]!;
  for(const n of l.nodes)if(!(e.edge.from===n.node.id&&k===1)&&!(e.edge.to===n.node.id&&k===e.points.length-1)&&segmentIntersectsBox(a,b,n.junction??n,-1))nodeHits++;
  for(const o of l.edges)if(o!==e&&o.labelBox&&segmentIntersectsBox(a,b,o.labelBox,2))labelHits++;
  for(const o of l.edges.slice(i+1))for(let j=1;j<o.points.length;j++){
   const c=o.points[j-1]!,d=o.points[j]!;
   if(a.x===b.x&&c.x===d.x&&a.x===c.x&&Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))>Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))||a.y===b.y&&c.y===d.y&&a.y===c.y&&Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))>Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)))shared++;
   if(a.x===b.x&&c.y===d.y&&a.x>Math.min(c.x,d.x)&&a.x<Math.max(c.x,d.x)&&c.y>Math.min(a.y,b.y)&&c.y<Math.max(a.y,b.y)||a.y===b.y&&c.x===d.x&&c.x>Math.min(a.x,b.x)&&c.x<Math.max(a.x,b.x)&&a.y>Math.min(c.y,d.y)&&a.y<Math.max(c.y,d.y))crossing++;
  }
 }
 for(const e of l.edges)if(e.labelBox)for(const n of l.nodes)if(boxesOverlap(e.labelBox,n.junction??n))labelHits++;
 return {crossing,shared,nodeHits,labelHits};
}
it.each(['system','activity','er'].flatMap(name=>['TB','BT','LR','RL'].map(dir=>({name,dir}))))('does not degrade complex $name / $dir',async({name,dir})=>{
 const source=readFileSync(`test/fixtures/aspect-complex/${name}.mmd`,'utf8').replace(name==='system'?'flowchart TB':'direction TB',name==='system'?`flowchart ${dir}`:`direction ${dir}`);
 const model=await parseDiagram(source);expect(model.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 if(name==='activity')for(const [id,shape] of [['Valid','decision'],['Review','decision'],['Fork','fork'],['Join','join']])expect(model.nodes.find(n=>n.id===id)?.shape).toBe(shape);
 const snapshot=JSON.stringify(model),before=renderDiagram(model,{balance:'off'}),after=renderDiagram(model);
 expect(JSON.stringify(model)).toBe(snapshot);
 const a=defects(before.layout),b=defects(after.layout);
 for(const key of Object.keys(a) as Array<keyof typeof a>)expect(b[key],key).toBeLessThanOrEqual(a[key]);
 expect(after.model.diagnostics.length).toBeLessThanOrEqual(before.model.diagnostics.length);
 expect(after.layout.nodes.map(n=>[n.node.id,n.width,n.height])).toEqual(before.layout.nodes.map(n=>[n.node.id,n.width,n.height]));
 expect(after.layout.edges.map(e=>e.edge)).toEqual(before.layout.edges.map(e=>e.edge));
 expect(after.svg).not.toMatch(/NaN|Infinity/);
});
it('preserves nested parallel/conditional sequence geometry',async()=>{
 const model=await parseDiagram(readFileSync('test/fixtures/aspect-complex/sequence.mmd','utf8'));
 expect(model.diagnostics).toEqual([]);const before=renderDiagram(model,{balance:'off'}),after=renderDiagram(model);
 expect(after.layout).toEqual(before.layout);expect(after.model.diagnostics).toEqual([]);
});
it.each(['','state Group {\n'])('retains late state types in nested and root documents (%s)',async prefix=>{
 const model=await parseDiagram(`%% archmap: {"view":"activity"}
stateDiagram-v2
${prefix}
[*] --> Check
Check --> Split: yes
Split --> A
Split --> B
A --> Merge
B --> Merge
Merge --> [*]
state Check <<choice>>
Check : 判定
state Split <<fork>>
Split : 並列
state Merge <<join>>
Merge : 完了
${prefix?'}':''}`);
 expect(model.diagnostics).toEqual([]);
 for(const [id,shape,label] of [['Check','decision','判定'],['Split','fork','並列'],['Merge','join','完了']]){
  const node=model.nodes.find(n=>n.id===id)!;expect(node.shape).toBe(shape);expect(node.label).toBe(label);
 }
});
