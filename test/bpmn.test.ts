import {describe,it,expect} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {boxesOverlap} from '../src/focused/layout.js';
import {DIAGRAM_SAMPLES} from '../src/focused/samples.js';
const sample=DIAGRAM_SAMPLES.find(s=>s.id==='bpmn')!.source;
describe('BPMN-style lane projection from standard Mermaid',()=>{
  it.each(['LR','RL','TB','BT'])('keeps lanes aligned, nodes contained and every edge in %s',async direction=>{
    const m=await parseDiagram(sample.replace('flowchart LR',`flowchart ${direction}`));
    expect(m.diagnostics).toEqual([]);expect(m.kind).toBe('bpmn');
    const r=renderDiagram(m),l=r.layout;
    expect(l.edges).toHaveLength(m.edges.length);
    expect(l.groups).toHaveLength(2);
    const [a,b]=l.groups;
    expect(boxesOverlap(a!,b!)).toBe(false);
    if(direction==='LR'||direction==='RL'){expect(a!.x).toBe(b!.x);expect(a!.width).toBe(b!.width);}
    else {expect(a!.y).toBe(b!.y);expect(a!.height).toBe(b!.height);}
    for(const n of l.nodes){const g=l.groups.find(g=>g.group.id===n.node.group)!;expect(n.x).toBeGreaterThanOrEqual(g.x);expect(n.y).toBeGreaterThanOrEqual(g.y);expect(n.x+n.width).toBeLessThanOrEqual(g.x+g.width);expect(n.y+n.height).toBeLessThanOrEqual(g.y+g.height);}
    expect(r.svg).not.toMatch(/NaN|Infinity/);
    const d=new DOMParser().parseFromString(r.svg,'image/svg+xml');
    expect(d.querySelector('[data-node="start"] circle')?.getAttribute('stroke-width')).toBe('1.5');
    expect(d.querySelector('[data-node="finish"] circle')?.getAttribute('stroke-width')).toBe('3.5');
    expect(d.querySelectorAll('.archmap-bpmn-lane')).toHaveLength(2);
  });
  it('retains loop, self-loop and parallel branches without overlapping nodes',async()=>{
    const m=await parseDiagram('%% archmap: {"view":"bpmn"}\nflowchart LR\nsubgraph team[Team]\nA[Review] --> B{OK?}\nB -->|retry| A\nB --> C[Notify]\nB --> D[Record]\nC --> C\nend');
    expect(m.diagnostics).toEqual([]);
    const l=renderDiagram(m).layout;expect(l.edges).toHaveLength(5);
    l.nodes.forEach((n,i)=>l.nodes.slice(i+1).forEach(other=>expect(boxesOverlap(n,other)).toBe(false)));
  });
  it('handles empty lanes and nodes without a lane',async()=>{
    const m=await parseDiagram('%% archmap: {"view":"bpmn"}\nflowchart LR\nsubgraph empty[Empty]\nend\nsubgraph lane[Team]\nA[Work]\nend\nA --> B[Outside]');
    expect(m.diagnostics).toEqual([]);const l=renderDiagram(m).layout;
    expect(l.nodes).toHaveLength(2);expect(l.groups).toHaveLength(2);
    for(const g of l.groups)expect(boxesOverlap(g,l.nodes.find(n=>n.node.id==='B')!)).toBe(false);
  });
  it.each([
    'subgraph outer[Pool]\nsubgraph inner[Lane]\nA[Work]\nend\nend',
    'subgraph team[Team]\nA[Work]\nend\nB[Work] --> team',
    'A[(Database)]'
  ])('reports unsupported BPMN interpretation: %s',async body=>{
    const m=await parseDiagram('%% archmap: {"view":"bpmn"}\nflowchart LR\n'+body);
    expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
  });
  it('keeps ordinary flowcharts unchanged without view opt-in',async()=>{
    const m=await parseDiagram(sample.replace('%% archmap: {"view":"bpmn"}',''));
    expect(m.kind).toBe('system');expect(renderDiagram(m).svg).not.toContain('archmap-bpmn-lane');
  });
});
