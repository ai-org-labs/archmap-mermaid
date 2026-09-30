/** Standard Mermaid flowchart shapes, drawn with ArchMap's typography/theme. */
export const FLOW_SHAPES: Record<string,string> = {
  square:'rect',rect:'rect',proc:'rect',process:'rect',rectangle:'rect',round:'rounded',rounded:'rounded',event:'rounded',
  stadium:'stadium',terminal:'stadium',pill:'stadium',subroutine:'fr-rect',subproc:'fr-rect',subprocess:'fr-rect','framed-rectangle':'fr-rect','fr-rect':'fr-rect',
  cylinder:'cyl',cyl:'cyl',db:'cyl',database:'cyl',circle:'circle',circ:'circle',doublecircle:'dbl-circ','double-circle':'dbl-circ','dbl-circ':'dbl-circ',
  diamond:'diam',diam:'diam',decision:'diam',question:'diam',hexagon:'hex',hex:'hex',prepare:'hex',
  lean_right:'lean-r','lean-r':'lean-r','lean-right':'lean-r','in-out':'lean-r',lean_left:'lean-l','lean-l':'lean-l','lean-left':'lean-l','out-in':'lean-l',
  trapezoid:'trap-b','trap-b':'trap-b',priority:'trap-b','trapezoid-bottom':'trap-b',inv_trapezoid:'trap-t','trap-t':'trap-t',manual:'trap-t','trapezoid-top':'trap-t','inv-trapezoid':'trap-t',odd:'odd',
  doc:'doc',document:'doc',docs:'docs',documents:'docs','st-doc':'docs','stacked-document':'docs','lin-doc':'lin-doc','lined-document':'lin-doc','tag-doc':'tag-doc','tagged-document':'tag-doc',
  'notch-rect':'notch-rect',card:'notch-rect','notched-rectangle':'notch-rect','lin-rect':'lin-rect','lined-rectangle':'lin-rect','lined-process':'lin-rect','lin-proc':'lin-rect','shaded-process':'lin-rect',
  'div-rect':'div-rect','div-proc':'div-rect','divided-process':'div-rect','divided-rectangle':'div-rect','win-pane':'win-pane','internal-storage':'win-pane','window-pane':'win-pane',
  'st-rect':'st-rect',procs:'st-rect',processes:'st-rect','stacked-rectangle':'st-rect','tag-rect':'tag-rect','tagged-rectangle':'tag-rect','tag-proc':'tag-rect','tagged-process':'tag-rect',
  'sm-circ':'sm-circ',start:'sm-circ','small-circle':'sm-circ','fr-circ':'fr-circ',stop:'fr-circ','framed-circle':'fr-circ','f-circ':'f-circ',junction:'f-circ','filled-circle':'f-circ','cross-circ':'cross-circ',summary:'cross-circ','crossed-circle':'cross-circ',
  fork:'fork',join:'fork',hourglass:'hourglass',collate:'hourglass',brace:'brace',comment:'brace','brace-l':'brace','brace-r':'brace-r',braces:'braces',
  bolt:'bolt','com-link':'bolt','lightning-bolt':'bolt',delay:'delay','half-rounded-rectangle':'delay','h-cyl':'h-cyl',das:'h-cyl','horizontal-cylinder':'h-cyl',
  'lin-cyl':'lin-cyl',disk:'lin-cyl','lined-cylinder':'lin-cyl','curv-trap':'curv-trap','curved-trapezoid':'curv-trap',display:'curv-trap',
  tri:'tri',triangle:'tri',extract:'tri','flip-tri':'flip-tri','manual-file':'flip-tri','flipped-triangle':'flip-tri','sl-rect':'sl-rect','manual-input':'sl-rect','sloped-rectangle':'sl-rect',
  'notch-pent':'notch-pent','loop-limit':'notch-pent','notched-pentagon':'notch-pent','bow-rect':'bow-rect','stored-data':'bow-rect','bow-tie-rectangle':'bow-rect',flag:'flag','paper-tape':'flag',
  text:'text',cloud:'cloud',bang:'bang',datastore:'datastore','data-store':'datastore',folder:'folder',directory:'folder',bucket:'bucket',console:'console',browser:'browser',person:'person',
};
const polygons:Record<string,number[][]>={
  hex:[[.12,0],[.88,0],[1,.5],[.88,1],[.12,1],[0,.5]],
  'lean-r':[[.15,0],[1,0],[.85,1],[0,1]],'lean-l':[[0,0],[.85,0],[1,1],[.15,1]],
  'trap-b':[[.15,0],[.85,0],[1,1],[0,1]],'trap-t':[[0,0],[1,0],[.85,1],[.15,1]],
  odd:[[.12,0],[1,0],[1,1],[.12,1],[0,.5]],'notch-rect':[[.12,0],[1,0],[1,1],[0,1],[0,.2]],
  tri:[[.5,0],[1,1],[0,1]],'flip-tri':[[0,0],[1,0],[.5,1]],'sl-rect':[[0,.2],[1,0],[1,1],[0,1]],
  'notch-pent':[[.12,0],[.88,0],[1,.25],[1,1],[0,1],[0,.25]],
  hourglass:[[0,0],[1,0],[0,1],[1,1]],bolt:[[.55,0],[.2,.55],[.5,.5],[.45,1],[.85,.4],[.55,.45]],
};
export function flowShapeSvg(shape:string,x:number,y:number,w:number,h:number,fill:string,stroke:string):string {
  const path=(d:string,f=fill)=>`<path d="${d}" fill="${f}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const line=(d:string)=>path(d,'none');
  const rect=(inset=0)=>`<rect x="${x+inset}" y="${y+inset}" width="${w-2*inset}" height="${h-2*inset}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
  const ellipse=(inset=0,f=fill)=>`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2-inset}" ry="${h/2-inset}" fill="${f}" stroke="${stroke}" stroke-width="1.4"/>`;
  if(polygons[shape])return path(polygons[shape]!.map(([a,b],i)=>`${i?'L':'M'} ${x+a!*w} ${y+b!*h}`).join(' ')+' Z');
  if(shape==='text')return '';
  if(['circle','dbl-circ','cross-circ','sm-circ','fr-circ','f-circ'].includes(shape))return ellipse(0,shape==='f-circ'||shape==='sm-circ'?stroke:fill)+(shape==='dbl-circ'?ellipse(6):shape==='fr-circ'?ellipse(6,stroke):shape==='cross-circ'?line(`M ${x+w*.15} ${y+h*.15} L ${x+w*.85} ${y+h*.85} M ${x+w*.85} ${y+h*.15} L ${x+w*.15} ${y+h*.85}`):'');
  if(['doc','docs','lin-doc','tag-doc','flag'].includes(shape)) {
    const document=path(`M ${x} ${y+(shape==='flag'?12:0)} ${shape==='flag'?`Q ${x+w*.25} ${y-12} ${x+w*.5} ${y+12} T ${x+w} ${y+12}`:`H ${x+w}`} V ${y+h-12} Q ${x+w*.75} ${y+h-32} ${x+w*.5} ${y+h-12} T ${x} ${y+h-12} Z`);
    return (shape==='docs'?line(`M ${x+8} ${y-6} H ${x+w+8} V ${y+h-20} M ${x+16} ${y-12} H ${x+w+16} V ${y+h-26}`):'')+document+(shape==='lin-doc'?line(`M ${x+10} ${y+10} V ${y+h-26}`):shape==='tag-doc'?line(`M ${x+w-22} ${y} V ${y+22} H ${x+w}`):'');
  }
  if(shape==='delay'||shape==='curv-trap')return path(`M ${x+(shape==='curv-trap'?20:0)} ${y} H ${x+w-h/2} Q ${x+w} ${y} ${x+w} ${y+h/2} Q ${x+w} ${y+h} ${x+w-h/2} ${y+h} H ${x+(shape==='curv-trap'?20:0)} ${shape==='curv-trap'?`L ${x} ${y+h/2}`:''} Z`);
  if(shape==='h-cyl')return path(`M ${x+16} ${y} H ${x+w-16} C ${x+w+5} ${y} ${x+w+5} ${y+h} ${x+w-16} ${y+h} H ${x+16} C ${x-5} ${y+h} ${x-5} ${y} ${x+16} ${y} Z`)+line(`M ${x+w-16} ${y} C ${x+w-38} ${y} ${x+w-38} ${y+h} ${x+w-16} ${y+h}`);
  if(shape==='bow-rect')return path(`M ${x+18} ${y} H ${x+w} Q ${x+w-36} ${y+h/2} ${x+w} ${y+h} H ${x+18} Q ${x-18} ${y+h/2} ${x+18} ${y} Z`);
  if(['brace','brace-r','braces'].includes(shape))return (shape!=='brace-r'?line(`M ${x+16} ${y} Q ${x+4} ${y} ${x+4} ${y+h*.25} Q ${x+4} ${y+h/2} ${x} ${y+h/2} Q ${x+4} ${y+h/2} ${x+4} ${y+h*.75} Q ${x+4} ${y+h} ${x+16} ${y+h}`):'')+(shape!=='brace'?line(`M ${x+w-16} ${y} Q ${x+w-4} ${y} ${x+w-4} ${y+h*.25} Q ${x+w-4} ${y+h/2} ${x+w} ${y+h/2} Q ${x+w-4} ${y+h/2} ${x+w-4} ${y+h*.75} Q ${x+w-4} ${y+h} ${x+w-16} ${y+h}`):'');
  if(shape==='cloud')return path(`M ${x+w*.15} ${y+h*.9} C ${x-w*.05} ${y+h} ${x-w*.04} ${y+h*.35} ${x+w*.1} ${y+h*.3} C ${x+w*.05} ${y-h*.08} ${x+w*.45} ${y-h*.08} ${x+w*.5} ${y+h*.15} C ${x+w*.6} ${y-h*.08} ${x+w*.95} ${y-h*.05} ${x+w*.9} ${y+h*.3} C ${x+w*1.05} ${y+h*.35} ${x+w*1.05} ${y+h*.85} ${x+w*.87} ${y+h*.9} Q ${x+w*.7} ${y+h*1.1} ${x+w*.5} ${y+h*.92} Q ${x+w*.3} ${y+h*1.05} ${x+w*.15} ${y+h*.9} Z`);
  if(shape==='bang')return path(Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,r=i%2?.78:1;return `${i?'L':'M'} ${x+w/2+Math.cos(a)*w/2*r} ${y+h/2+Math.sin(a)*h/2*r}`;}).join(' ')+' Z');
  if(shape==='folder')return path(`M ${x} ${y+12} V ${y} H ${x+w*.35} L ${x+w*.4} ${y+12} H ${x+w} V ${y+h} H ${x} Z`);
  if(shape==='bucket')return path(`M ${x} ${y+10} Q ${x+w/2} ${y-10} ${x+w} ${y+10} L ${x+w*.85} ${y+h-10} Q ${x+w/2} ${y+h+10} ${x+w*.15} ${y+h-10} Z`)+line(`M ${x} ${y+10} Q ${x+w/2} ${y+28} ${x+w} ${y+10}`);
  if(shape==='person')return `<circle cx="${x+w/2}" cy="${y+16}" r="16" fill="${fill}" stroke="${stroke}"/>`+path(`M ${x} ${y+h} V ${y+48} Q ${x+w/2} ${y+18} ${x+w} ${y+48} V ${y+h} Z`);
  if(shape==='datastore')return line(`M ${x+w} ${y} H ${x} V ${y+h} H ${x+w}`);
  return (shape==='st-rect'?line(`M ${x+8} ${y-6} H ${x+w+8} V ${y+h-8} M ${x+16} ${y-12} H ${x+w+16} V ${y+h-16}`):'')+rect()+
    (shape==='fr-rect'?line(`M ${x+12} ${y} V ${y+h} M ${x+w-12} ${y} V ${y+h}`):
     shape==='lin-rect'?line(`M ${x+10} ${y} V ${y+h} M ${x+15} ${y} V ${y+h}`):
     shape==='div-rect'||shape==='browser'||shape==='console'?line(`M ${x} ${y+18} H ${x+w}`)+(shape==='console'?line(`M ${x+8} ${y+5} l 6 4 l -6 4 M ${x+20} ${y+13} h 10`):''):
     shape==='win-pane'?line(`M ${x+14} ${y} V ${y+h} M ${x} ${y+14} H ${x+w}`):
     shape==='tag-rect'?line(`M ${x+w-22} ${y} V ${y+22} H ${x+w}`):'');
}

/** Orthogonal attachment at the visible boundary, rather than the bounding box. */
export function flowShapePort(shape:string,w:number,h:number,side:'left'|'right'|'top'|'bottom',offset:number):{x:number;y:number}|undefined {
  const horizontal=side==='left'||side==='right';
  if(['circle','dbl-circ','fr-circ','f-circ','sm-circ','cross-circ'].includes(shape)) {
    const ratio=offset/(horizontal?h/2:w/2),extent=Math.sqrt(Math.max(0,1-ratio*ratio));
    return horizontal?{x:w/2+(side==='left'?-1:1)*w/2*extent,y:h/2+offset}:{x:w/2+offset,y:h/2+(side==='top'?-1:1)*h/2*extent};
  }
  const polygon=polygons[shape];if(!polygon)return undefined;
  const at=horizontal?.5+offset/h:.5+offset/w,axis=horizontal?1:0,other=1-axis,hits:number[]=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!;
    if(a[axis]===b[axis]){if(Math.abs(at-a[axis]!)<1e-8)hits.push(a[other]!,b[other]!);continue;}
    const t=(at-a[axis]!)/(b[axis]!-a[axis]!);if(t>=0&&t<=1)hits.push(a[other]!+t*(b[other]!-a[other]!));
  }
  if(!hits.length)return undefined;
  const value=side==='left'||side==='top'?Math.min(...hits):Math.max(...hits);
  return horizontal?{x:value*w,y:at*h}:{x:at*w,y:value*h};
}
