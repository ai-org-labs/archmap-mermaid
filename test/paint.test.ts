import {describe,it,expect} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {resolvePaint} from '../src/focused/paint.js';
const svg=(source:string)=>new DOMParser().parseFromString(source,'image/svg+xml');
describe('standard Mermaid colors',()=>{
  it('resolves default, classes and direct styles for nodes and subgraphs',async()=>{
    const m=await parseDiagram(`flowchart LR
subgraph G[Services]
 A[API]:::warm --> B[(DB)]
end
classDef default fill:#eef2ff,stroke:#334155,color:#112233
classDef warm fill:#fff0dd,stroke:#bb5500,color:#663300
class G warm
style A fill:#ffeedd,stroke:#aabbcc,color:#123456
style G fill:#e0f2fe
`);
    expect(m.diagnostics).toEqual([]);
    expect(m.nodes.find(n=>n.id==='A')?.paint).toEqual({fill:'#ffeedd',stroke:'#aabbcc',color:'#123456'});
    expect(m.nodes.find(n=>n.id==='B')?.paint?.fill).toBe('#eef2ff');
    expect(m.groups[0]?.paint).toEqual({fill:'#e0f2fe',stroke:'#bb5500',color:'#663300'});
    const d=svg(renderDiagram(m).svg);
    expect(d.querySelector('[data-node="A"] rect')?.getAttribute('fill')).toBe('#ffeedd');
    expect(d.querySelector('[data-node="A"] text')?.getAttribute('fill')).toBe('#123456');
    expect(d.querySelector('[data-group="G"] rect')?.getAttribute('fill-opacity')).toBe('1');
  });
  it('supports state classes and direct styling',async()=>{
    const m=await parseDiagram(`stateDiagram-v2
A --> B
classDef warm fill:#ffeecc,stroke:#ff8800,color:#443300
class A warm
style A stroke:#123456
`);
    expect(m.diagnostics).toEqual([]);
    expect(m.nodes.find(n=>n.id==='A')?.paint).toEqual({fill:'#ffeecc',stroke:'#123456',color:'#443300'});
    const d=svg(renderDiagram(m).svg);
    expect(d.querySelector('[data-node="A"] rect')?.getAttribute('stroke')).toBe('#123456');
  });
  it('supports ER entity colors',async()=>{
    const m=await parseDiagram(`erDiagram
 CUSTOMER ||--o{ ORDER : places
 classDef warm fill:#ffeecc,stroke:#ff8800,color:#443300
 class CUSTOMER warm
`);
    expect(m.diagnostics).toEqual([]);
    expect(m.nodes.find(n=>n.id==='CUSTOMER')?.paint?.fill).toBe('#ffeecc');
  });
  it('styles nested state groups without coloring unrelated nodes',async()=>{
    const m=await parseDiagram('stateDiagram-v2\nstate Group {\nA --> B\n}\nstyle Group fill:pink,stroke:navy,color:maroon');
    expect(m.diagnostics).toEqual([]);
    expect(m.groups.find(g=>g.id==='Group')?.paint).toEqual({fill:'pink',stroke:'navy',color:'maroon'});
    expect(m.nodes.find(n=>n.id==='A')?.paint).toBeUndefined();
  });
  it('honors class order, transparent colors and literal RGB',()=>{
    const classes=new Map([['first',{styles:['fill:red','color:navy']}],['second',{styles:['fill:transparent']}]]);
    expect(resolvePaint(classes,['first','second'],['stroke:none','color:rgb(1, 2, 3)'],()=>{})).toEqual({fill:'transparent',stroke:'none',color:'rgb(1, 2, 3)'});
  });
  it('rejects resource references and unsupported properties without injecting CSS',()=>{
    const warnings:string[]=[];
    expect(resolvePaint(new Map(),[],['fill:url(https://example.com/x)','stroke-width:20','color:var(--text)','stroke:red'],s=>warnings.push(s))).toEqual({stroke:'red'});
    expect(warnings).toHaveLength(3);
  });
  it('keeps colors isolated and safe for programmatic model input',async()=>{
    const m=await parseDiagram('flowchart LR\nA --> B\nstyle A fill:pink,color:navy');
    m.nodes[0]!.paint!.stroke='" onload="alert(1)';
    const output=renderDiagram(m).svg,d=svg(output);
    expect(output).not.toContain('onload');
    expect(d.querySelector('[data-node="B"] rect')?.getAttribute('fill')).not.toBe('pink');
  });
});
