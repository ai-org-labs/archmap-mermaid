import {safePaint} from './paint.js';
import {safeLink} from './links.js';
import {flowShapeSvg} from './flow-shapes.js';
import {imageSize,validImageSource} from './images.js';
import { groupContains } from './groups.js';
import { getIcon } from '../icons.js';
import { entityContent, BODY_SIZE, boxesOverlap, computeDiagramLayout, FONT, iconNodeText, junctionText, LABEL_SIZE, nodeText, segmentIntersectsBox, TITLE_SIZE, textWidth, wrapText } from './layout.js';
import type { DiagramColor, DiagramLayoutOptions, DiagramDiagnostic, DiagramLayout, DiagramLayoutNode, DiagramModel, DiagramRenderResult } from './types.js';

const palette: Record<DiagramColor, { ink: string; fill: string; border: string }> = {
  blue: { ink: '#2873dc', fill: '#edf4ff', border: '#b9d2f5' }, green: { ink: '#19845e', fill: '#ecf8f0', border: '#b7dfc7' },
  orange: { ink: '#c87917', fill: '#fff6e8', border: '#f2d3a4' }, purple: { ink: '#8253ca', fill: '#f5efff', border: '#d9c5f2' },
  gray: { ink: '#67788a', fill: '#f1f5f8', border: '#cdd7e1' },
};
export function escapeXml(value: string): string { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!)); }
function textLines(lines: string[], x: number, y: number, size: number, lineHeight: number, fill: string, weight = 400, anchor = 'start'): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`;
}
function renderImage(node:DiagramLayoutNode['node'],x:number,y:number,width:number,height:number):string {
  const image=node.image!;
  if(image.error||!validImageSource(image.src))return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#f1f5f8" stroke="#cdd7e1"/>${textLines(wrapText('画像を読み込めません',Math.max(30,width-16),12),x+8,y+20,12,17,'#65768a')}</g>`;
  return `<image href="${escapeXml(image.data??image.src)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${image.constraint==='on'?'xMidYMid meet':'none'}"><title>${escapeXml(node.label)}</title></image>`;
}
function renderNode(box: DiagramLayoutNode, kind: DiagramModel['kind'], edges: DiagramLayout['edges']): string {
  const { node, x, y, width: w, height: h } = box, preset = palette[node.color] ?? palette.blue;
  const paint = Object.fromEntries(Object.entries(node.paint ?? {}).filter(([key,value])=>safePaint(value,key==='color')));
  const colors = {...preset, fill:paint.fill??preset.fill, border:paint.stroke??preset.border, ink:paint.stroke??preset.ink};
  const bodyFill=paint.fill??'#fff', titleColor=paint.color??'#25364b', detailColor=paint.color??'#65768a';
  const text = nodeText(node, kind, w), icon = node.icon ? getIcon(node.icon) : undefined;
  if(node.attributes) {
    const content=entityContent(node);let rowY=y+content.header;
    const rows=content.rows.map((r,i)=>{const top=rowY;rowY+=content.heights[i]!;return `<g class="archmap-attribute"><path d="M ${x} ${top} H ${x+w}" stroke="#e4eaf2"/>${textLines([r.a.keys.join('/')],x+12,top+21,10,17,paint.color??colors.ink,600)}${textLines(r.names,x+76,top+21,12,17,titleColor,500)}${textLines(r.types,x+230,top+21,11,17,detailColor)}${r.comments.length?textLines(r.comments,x+16,top+Math.max(r.names.length,r.types.length)*17+24,11,15,detailColor):''}</g>`;}).join('');
    return `<g class="archmap-node archmap-entity" data-node="${escapeXml(node.id)}"><title>${escapeXml(node.label)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${bodyFill}" stroke="${colors.border}"/><path d="M ${x+8} ${y} H ${x+w-8} Q ${x+w} ${y} ${x+w} ${y+8} V ${y+content.header} H ${x} V ${y+8} Q ${x} ${y} ${x+8} ${y}" fill="${colors.fill}"/>${textLines(content.title,x+16,y+26,15,21,titleColor,600)}${rows}${!content.rows.length?textLines(['属性未定義'],x+16,rowY+24,11,16,detailColor):''}</g>`;
  }
  if (box.junction && box.junctionLabel) {
    const bar = box.junction, label = box.junctionLabel, copy = junctionText(node);
    return `<g class="archmap-node archmap-junction" data-node="${escapeXml(node.id)}" data-kind="${node.shape}"><title>${escapeXml(node.label)}</title><rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="2" fill="${paint.fill??colors.ink}"${paint.stroke?` stroke="${paint.stroke}"`:""}/>${textLines(copy.title, label.x, label.y + 12, 12, 17, paint.color??'#334155', 600)}${copy.description.length ? textLines(copy.description, label.x, label.y + copy.title.length * 17 + 17, 11, 16, detailColor) : ''}</g>`;
  }
  if (box.screen) {
    const screen = box.screen;
    let artwork = node.icon ? icon ?? getIcon('browser') : undefined;
    const headingIcon = artwork ? `<svg x="${x + 20}" y="${y + (screen.titleY??61) - 16}" width="24" height="24" viewBox="${escapeXml(artwork.viewBox)}" color="${colors.ink}" aria-hidden="true">${artwork.body}</svg>` : '';
    let chrome = `<path d="M ${x + 10} ${y} H ${x + w - 10} Q ${x + w} ${y} ${x + w} ${y + 10} V ${y + 27} H ${x} V ${y + 10} Q ${x} ${y} ${x + 10} ${y}" fill="${colors.fill}"/><path d="M ${x} ${y + 27} H ${x + w}" stroke="${colors.border}"/>${[0, 1, 2].map(i => `<circle cx="${x + 17 + i * 9}" cy="${y + 14}" r="2" fill="${colors.ink}" opacity=".5"/>`).join('')}`;
    if (node.shape === 'modal') chrome = `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="26" rx="8" fill="${colors.fill}"/>${textLines(['MODAL'], x + 14, y + 18, 10, 14, colors.ink, 600)}<path d="M ${x + w - 22} ${y + 9} l 9 9 m -9 0 l 9 -9" stroke="${colors.ink}" stroke-width="1.3"/>`;
    const rows = screen.actions.map(action => {
      const connection = edges.find(item => item.edge === action.edge);
      const point = connection && action.edge ? action.edge.from === node.id ? connection.points[0] : connection.points[connection.points.length - 1] : undefined;
      const rowY = y + action.top, cy = rowY + action.height / 2;
      const contentHeight = action.lines.length * 18 + (action.detail ? 6 + action.detail.length * 14 : 0);
      const textY = cy - contentHeight / 2 + 13;
      return `<g class="archmap-screen-action" data-action-kind="${action.kind ?? 'navigate'}" data-edge-line="${action.line}"><path d="M ${x + 16} ${rowY} H ${x + w - 16}" stroke="#edf1f6"/>${textLines(action.lines, x + 24, textY, 13, 18, paint.color??'#33465c', 500)}${action.detail ? textLines(action.detail, x + 24, textY + action.lines.length * 18 + 4, 10, 14, action.kind === 'state' ? '#8253ca' : detailColor) : ''}${point ? `<circle cx="${point.x}" cy="${point.y}" r="3" fill="${bodyFill}" stroke="${colors.ink}" stroke-width="1.4"/>` : ''}</g>`;
    }).join('');
    return `<g class="archmap-node archmap-screen" data-screen-kind="${node.shape === 'modal' ? 'modal' : 'screen'}" data-node="${escapeXml(node.id)}"><title>${escapeXml(node.label + (node.description ? ': ' + node.description : ''))}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${bodyFill}" stroke="${colors.border}" stroke-width="1.4"/>${chrome}${headingIcon}${screen.image?renderImage(node,x+screen.image.x,y+screen.image.y,screen.image.width,screen.image.height):''}${textLines(screen.title, x + (node.icon ? 56 : 20), y + (screen.titleY??61), TITLE_SIZE, 21, titleColor, 600)}${screen.description.length ? textLines(screen.description, x + 20, y + (screen.titleY??61) - 16 + Math.max(24, screen.title.length * 21) + 8 + 12, BODY_SIZE, 17, detailColor) : ''}<path d="M ${x} ${y + screen.headerHeight} H ${x + w}" stroke="${colors.border}"/>${textLines([screen.actions.length ? 'アクション' : 'アクションの定義なし'], x + 20, y + screen.headerHeight + (screen.actions.length ? 18 : 28), 10, 14, '#7b8ba0', 500)}${rows}</g>`;
  }
  if(node.image) {
    const size=imageSize(node), lines=wrapText(node.label,w-40), desc=node.description?wrapText(node.description,w-40,BODY_SIZE):[];
    const titleHeight=lines.length*21+(desc.length?8+desc.length*17:0);
    const iy=y+20+(node.image.position==='t'?titleHeight+12:0),ty=node.image.position==='t'?y+35:iy+size.height+28;
    return `<g class="archmap-node archmap-image-node" data-node="${escapeXml(node.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${bodyFill}" stroke="${colors.border}"/>${renderImage(node,x+(w-size.width)/2,iy,size.width,size.height)}${textLines(lines,x+20,ty,TITLE_SIZE,21,titleColor,600)}${desc.length?textLines(desc,x+20,ty+lines.length*21+4,BODY_SIZE,17,detailColor):''}</g>`;
  }
  if (box.iconMode) {
    const copy = iconNodeText(node), cx = x + w / 2;
    const artwork = (node.icon ? getIcon(node.icon) : undefined) ?? getIcon(node.shape === 'database' ? 'database' : 'server');
    const graphic = artwork ? `<svg x="${cx - 24}" y="${y}" width="48" height="48" viewBox="${escapeXml(artwork.viewBox)}" color="${colors.ink}" aria-hidden="true">${artwork.body}</svg>` : `<rect x="${cx - 22}" y="${y + 2}" width="44" height="44" rx="6" fill="${colors.fill}" stroke="${colors.ink}"/>`;
    return `<g class="archmap-node archmap-icon-node" data-node="${escapeXml(node.id)}"><title>${escapeXml(node.label + (node.description ? ': ' + node.description : ''))}</title>${paint.fill||paint.stroke?`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${paint.fill??'none'}" stroke="${paint.stroke??'none'}"/>`:""}${graphic}${textLines(copy.title, cx, y + 77, TITLE_SIZE, 21, titleColor, 500, 'middle')}${copy.description.length ? textLines(copy.description, cx, y + 77 + copy.title.length * 21 + 2, BODY_SIZE, 17, detailColor, 400, 'middle') : ''}</g>`;
  }
  if (kind === 'sequence') {
    const links=(node.links??[]).filter(l=>safeLink(l.href)).map(l=>({...l,lines:wrapText(l.label,w-24,12)}));
    const contentHeight = text.title.length * 21 + (text.description.length ? 9 + text.description.length * 17 : 0)+links.reduce((h,l)=>h+l.lines.length*17+8,0);
    const ty = y + (h - contentHeight) / 2 + 15;
    const tx = x + 12 + (node.icon || node.participantType && node.participantType!=='participant' ? 28 : 0);
    let artwork = node.icon ? icon
      ? `<svg x="${x + 12}" y="${ty - 14}" width="18" height="18" viewBox="${escapeXml(icon.viewBox)}" color="${colors.ink}" aria-hidden="true">${icon.body}</svg>`
      : `<rect x="${x + 13}" y="${ty - 12}" width="15" height="14" rx="3" fill="none" stroke="${colors.ink}"/>` : '';
    const symbols:Record<string,string>={boundary:'<path d="M 1 2 V 18 M 1 10 H 7"/><circle cx="13" cy="10" r="6"/>',control:'<circle cx="10" cy="11" r="7"/><path d="M 10 1 l -4 3 l 4 3"/>',entity:'<circle cx="10" cy="8" r="6"/><path d="M 2 18 H 18"/>',collections:'<path d="M 5 2 H 19 V 14 M 2 5 H 16 V 19 H 2 Z"/>',queue:'<ellipse cx="4" cy="10" rx="3" ry="7"/><path d="M 4 3 H 16 C 21 3 21 17 16 17 H 4"/>'};
    if(node.participantType&&symbols[node.participantType])artwork=`<svg class="archmap-participant-symbol" data-type="${node.participantType}" x="${x+12}" y="${ty-15}" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="${colors.ink}" stroke-width="1.3">${symbols[node.participantType]}</svg>`;
    let linkY=ty+text.title.length*21+(text.description.length?5+text.description.length*17:0)+6;
    const linkSvg=links.map(l=>{const at=linkY;linkY+=l.lines.length*17+8;return `<a class="archmap-participant-link" href="${escapeXml(l.href)}" target="_blank" rel="noopener noreferrer">${textLines(l.lines,x+12,at,12,17,colors.ink)}<title>${escapeXml(l.href)}</title></a>`;}).join('');
    return `<g class="archmap-node" data-node="${escapeXml(node.id)}"><title>${escapeXml(node.label + (node.description ? ': ' + node.description : ''))}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${bodyFill}" stroke="${colors.border}" stroke-width="1"/>${artwork}${textLines(text.title, tx, ty, TITLE_SIZE, 21, titleColor, 500)}${text.description.length ? textLines(text.description, tx, ty + text.title.length * 21 + 5, BODY_SIZE, 17, detailColor) : ''}${linkSvg}</g>`;
  }
  const base = `fill="${bodyFill}" stroke="${colors.border}" stroke-width="1.4"`;
  let shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" ${base}/><rect x="${x}" y="${y + 15}" width="3" height="${h - 30}" rx="1.5" fill="${colors.ink}"/>`;
  if (node.shape === 'note') shape = `<path d="M ${x} ${y} H ${x+w-16} L ${x+w} ${y+16} V ${y+h} H ${x} Z" fill="${colors.fill}" stroke="${colors.border}"/><path d="M ${x+w-16} ${y} V ${y+16} H ${x+w}" fill="none" stroke="${colors.border}"/>`;
  if (node.shape === 'decision') shape = `<path d="M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z" fill="${colors.fill}" stroke="${colors.border}" stroke-width="1.4"/>`;
  if (node.shape === 'start' || node.shape === 'end') shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h / 2, 44)}" fill="${colors.fill}" stroke="${colors.ink}" stroke-width="${node.shape === 'end' ? 2.8 : 1.4}"/>`;
  if (node.shape === 'database') shape = `<path d="M ${x} ${y + 15} C ${x} ${y - 4} ${x + w} ${y - 4} ${x + w} ${y + 15} L ${x + w} ${y + h - 15} C ${x + w} ${y + h + 5} ${x} ${y + h + 5} ${x} ${y + h - 15} Z" ${base}/><path d="M ${x} ${y + 15} C ${x} ${y + 35} ${x + w} ${y + 35} ${x + w} ${y + 15}" fill="none" stroke="${colors.border}" stroke-width="1.4"/>`;
  if(node.flowShape && !['rounded','stadium','diam','cyl','lin-cyl','fork'].includes(node.flowShape))shape=flowShapeSvg(node.flowShape,x,y,w,h,colors.fill,['sm-circ','f-circ','fr-circ'].includes(node.flowShape)?colors.ink:colors.border);
  if(node.flowShape==='lin-cyl')shape+=`<path d="M ${x} ${y+25} C ${x} ${y+45} ${x+w} ${y+45} ${x+w} ${y+25}" fill="none" stroke="${colors.border}"/>`;
  let header = '';
  if (kind === 'screens' && node.shape === 'card') header = `<path d="M ${x + 12} ${y} H ${x + w - 12} Q ${x + w} ${y} ${x + w} ${y + 12} V ${y + 27} H ${x} V ${y + 12} Q ${x} ${y} ${x + 12} ${y}" fill="${colors.fill}"/><path d="M ${x} ${y + 27} H ${x + w}" stroke="${colors.border}"/>${[0, 1, 2].map(i => `<circle cx="${x + 17 + i * 9}" cy="${y + 14}" r="2" fill="${colors.ink}" opacity=".5"/>`).join('')}`;
  const totalText = text.title.length * 21 + (text.description.length ? 9 + text.description.length * 17 : 0);
  const ty = y + text.header + (h - text.header - totalText) / 2 + 15 + (node.shape === 'database' ? 9 : 0);
  const tx = text.centered ? x + w / 2 : x + text.inset + (node.icon ? 44 : 0), anchor = text.centered ? 'middle' : 'start';
  let iconSvg = '';
  if (node.icon && !text.centered) {
    const ix = x + 20, iy = ty - 17;
    iconSvg = `<rect x="${ix - 4}" y="${iy - 4}" width="36" height="36" rx="9" fill="${colors.fill}"/>`;
    iconSvg += icon ? `<svg x="${ix}" y="${iy}" width="28" height="28" viewBox="${escapeXml(icon.viewBox)}" color="${colors.ink}" aria-hidden="true">${icon.body}</svg>` : `<path d="M ${ix + 5} ${iy + 7} H ${ix + 23} V ${iy + 21} H ${ix + 5} Z M ${ix + 10} ${iy + 3} V ${iy + 7} M ${ix + 18} ${iy + 3} V ${iy + 7} M ${ix + 10} ${iy + 21} V ${iy + 25} M ${ix + 18} ${iy + 21} V ${iy + 25}" fill="none" stroke="${colors.ink}" stroke-width="1.7"/>`;
  }
  return `<g class="archmap-node" data-node="${escapeXml(node.id)}"><title>${escapeXml(node.label + (node.description ? ': ' + node.description : ''))}</title>${shape}${header}${iconSvg}${textLines(text.title, tx, ty, TITLE_SIZE, 21, node.flowShape&&['sm-circ','f-circ','fr-circ'].includes(node.flowShape)?(paint.color??'#fff'):titleColor, 600, anchor)}${text.description.length ? textLines(text.description, tx, ty + text.title.length * 21 + 5, BODY_SIZE, 17, detailColor, 400, anchor) : ''}</g>`;
}

function geometryWarnings(layout: DiagramLayout, model: DiagramModel): DiagramDiagnostic[] {
  const warnings: DiagramDiagnostic[] = [];
  const report = (line: number, message: string) => {
    if (!warnings.some(w => w.message === message && w.line === line)) warnings.push({ line, severity: 'warning', message });
  };
  for (const [index, group] of layout.groups.entries()) {
    if (layout.nodes.some(n => !groupContains(model, group.group.id, n.node.group) && boxesOverlap(group, n))) report(group.group.line, `グループ「${group.group.label}」の領域に別のノードが重なっています。at の行を分けてください。`);
    if (layout.groups.slice(index + 1).some(other => !groupContains(model, group.group.id, other.group.id) && !groupContains(model, other.group.id, group.group.id) && boxesOverlap(group, other))) report(group.group.line, `グループ「${group.group.label}」の領域が別のグループと重なっています。at の行を分けてください。`);
  }
  if (model.kind === 'sequence') return warnings;
  let connectorLabelCollision = false;
  for (const [index, edge] of layout.edges.entries()) {
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1]!, b = edge.points[i]!;
      if (layout.nodes.some(n => !(n.node.id === edge.edge.from && i === 1) && !(n.node.id === edge.edge.to && i === edge.points.length - 1) && segmentIntersectsBox(a, b, n, -1))) report(edge.edge.line, '接続経路がノードに重なっています。ノードの 補助設定の at を調整してください。');
      if (layout.edges.some((other, j) => j !== index && other.labelBox && segmentIntersectsBox(a, b, other.labelBox, 2))) connectorLabelCollision = true;
    }
  }
  if (connectorLabelCollision) report(1, '接続が密なため、一部のラベルと別の接続線が交差しています。補助設定の at で行や列を分けると改善します。');
  return warnings;
}

export function renderDiagram(model: DiagramModel, options: DiagramLayoutOptions = {}): DiagramRenderResult {
  const start = performance.now(), layout = computeDiagramLayout(model, options);
  const title = model.title || ({ system: 'System architecture', layers: 'Layer stack', sequence: 'Sequence diagram', screens: 'Screen flow', activity: 'Activity diagram', er:'Entity relationship diagram', usecase:'Use case diagram' }[model.kind]);
  const groups = layout.groups.map(({ group, x, y, width, height }) => {
    const preset = palette[group.color] ?? palette.gray;
    const paint=Object.fromEntries(Object.entries(group.paint??{}).filter(([key,value])=>safePaint(value,key==='color')));
    const colors={fill:paint.fill??preset.fill,border:paint.stroke??preset.border,ink:paint.color??preset.ink};
    return `<g class="archmap-group" data-group="${escapeXml(group.id)}"${group.concurrent?' data-concurrent="true"':''}><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${colors.fill}" fill-opacity="${paint.fill?1:group.concurrent?0:.52}" stroke="${colors.border}" stroke-dasharray="5 4"/>${textLines(wrapText(group.concurrent?'Concurrent region':group.label+(group.collapsed?' ⋯':''), width - 34, 12), x + 16, y + 24, 12, 17, colors.ink, 600)}</g>`;
  }).join('');
  const lifelines = model.kind === 'sequence' ? layout.nodes.map(n => `<path class="archmap-lifeline" d="M ${n.x + n.width / 2} ${n.y + n.height} V ${layout.destructions?.find(d=>d.node===n.node.id)?.y ?? layout.height - 32}" fill="none" stroke="#cbd5e1" stroke-width="1.3" stroke-dasharray="5 6"/>`).join('') : '';
  const layerBands = model.kind === 'layers' && !layout.groups.length ? [...new Set(layout.nodes.map(n => n.y + n.height / 2))].map(center => { const members = layout.nodes.filter(n => n.y + n.height / 2 === center), height = Math.max(...members.map(n => n.height)); return `<rect x="24" y="${center - height / 2 - 18}" width="${layout.width - 48}" height="${height + 36}" rx="16" fill="#f6f8fc" stroke="#e5ebf3"/>`; }).join('') : '';
  const activations = (layout.activations ?? []).map(bar => {
    const color = palette[model.nodes.find(node => node.id === bar.node)?.color ?? 'blue'];
    return `<rect class="archmap-activation" data-node="${escapeXml(bar.node)}" data-depth="${bar.depth}" x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="${color.fill}" stroke="${color.ink}" stroke-width="1.2"><title>${escapeXml(bar.node)}: 活性区間</title></rect>`;
  }).join('');
  const fragments = (layout.fragments ?? []).map(frame => {
    if(frame.kind==='rect')return `<rect class="archmap-fragment" data-kind="rect" x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="5" fill="${escapeXml(frame.fill||'#e8f0fa')}" fill-opacity=".38"/>`;
    const backgroundWidth = (value: string, inset: number, width: number) => Math.min(frame.width - 2, inset + Math.max(0, ...wrapText(value, width, 12).map(line => textWidth(line, 12))) + 8);
    const label = (value: string, x: number, y: number, width: number) => textLines(wrapText(value, width, 12), x, y, 12, 17, '#53647a', 500);
    return `<g class="archmap-fragment" data-kind="${frame.kind}" data-depth="${frame.depth}"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="none" stroke="#94a3b8" stroke-width="1.2"/><rect x="${frame.x + 1}" y="${frame.y + 1}" width="${backgroundWidth(frame.label, 68, frame.width - 84)}" height="${frame.headerHeight - 1}" fill="#fff"/><path d="M ${frame.x} ${frame.y} h 52 v 18 l -10 10 h -42 Z" fill="#f1f5f9" stroke="#94a3b8"/>${textLines([frame.kind], frame.x + 9, frame.y + 18, 12, 17, '#334155', 600)}${label(frame.label, frame.x + 68, frame.y + 21, frame.width - 84)}${frame.branches.map(branch => `<rect x="${frame.x + 1}" y="${branch.y}" width="${backgroundWidth(branch.label, 16, frame.width - 32)}" height="${branch.height}" fill="#fff"/><path class="archmap-fragment-separator" d="M ${frame.x} ${branch.y} h ${frame.width}" stroke="#94a3b8" stroke-dasharray="5 4"/>${label(branch.label, frame.x + 16, branch.y + 21, frame.width - 32)}`).join('')}</g>`;
  }).join('');
  const notes=(layout.notes??[]).map(n=>`<g class="archmap-sequence-note"><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="6" fill="#fff7df" stroke="#d9bd7c"/>${textLines(wrapText(n.label,n.width-32,12),n.x+16,n.y+21,12,17,'#685626')}</g>`).join('');
  const destructions=(layout.destructions??[]).map(d=>`<path class="archmap-destruction" d="M ${d.x-8} ${d.y-8} l 16 16 M ${d.x+8} ${d.y-8} l -16 16" stroke="#64748b" stroke-width="2"/>`).join('');
  const connections = layout.edges.filter(e=>!e.edge.invisible).map(({ edge, points }) => `<path class="archmap-edge" d="${points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}" fill="none" stroke="#7b8ba0" stroke-width="${edge.thick?3.2:1.6}" stroke-linejoin="round" stroke-linecap="round"${edge.style === 'dashed' ? ' stroke-dasharray="6 5"' : ''}${edge.targetMarker ? ` marker-end="url(#archmap-${escapeXml(edge.targetMarker)})"` : edge.arrow === "none" ? "" : ` marker-end="url(#${edge.arrow === "filled" ? "archmap-arrow-filled" : "archmap-arrow"})"`}${edge.sourceMarker ? ` marker-start="url(#archmap-${escapeXml(edge.sourceMarker)})"` : edge.bidirectional ? ` marker-start="url(#${edge.arrow === 'filled' ? 'archmap-arrow-filled' : 'archmap-arrow-start'})"` : ''}/>`).join('');
  const centralConnections=layout.edges.flatMap(({edge,points})=>[...(edge.central==='source'||edge.central==='both'?[points[0]!]:[]),...(edge.central==='target'||edge.central==='both'?[points[points.length-1]!]:[])]).map(p=>`<circle class="archmap-central-connection" cx="${p.x}" cy="${p.y}" r="4.5" fill="#fff" stroke="#7b8ba0" stroke-width="1.6"/>`).join('');
  const labels = layout.edges.map(({ edge, points, labelBox }) => {
    if (!labelBox || edge.invisible) return '';
    if (model.kind === 'sequence') {
      const rightToLeft = points[1]!.x < points[0]!.x;
      return `<g class="archmap-edge-label">${textLines(wrapText(edge.label, 166, LABEL_SIZE), rightToLeft ? labelBox.x + labelBox.width : labelBox.x, labelBox.y + 17, LABEL_SIZE, 16, '#53647a', 500, rightToLeft ? 'end' : 'start')}</g>`;
    }
    return `<g class="archmap-edge-label"><rect x="${labelBox.x}" y="${labelBox.y}" width="${labelBox.width}" height="${labelBox.height}" rx="5" fill="#fff" stroke="#e8edf4" stroke-width=".8"/>${textLines(wrapText(edge.label, 166, LABEL_SIZE), labelBox.x + labelBox.width / 2, labelBox.y + 17, LABEL_SIZE, 16, '#53647a', 500, 'middle')}</g>`;
  }).join('');
  const markerShapes: Record<string,string>={
    'solid-half-top':'<path d="M -9 -6 L 0 0 H -9 Z" fill="#7b8ba0"/>',
    'solid-half-bottom':'<path d="M -9 6 L 0 0 H -9 Z" fill="#7b8ba0"/>',
    'open-half-top':'<path d="M -9 -6 L 0 0"/>',
    'open-half-bottom':'<path d="M -9 6 L 0 0"/>',
    one:'<path d="M -5 -6 V 6 M -11 -6 V 6"/>',
    'zero-one':'<path d="M -5 -6 V 6"/><circle cx="-15" cy="0" r="4" fill="#fff"/>',
    many:'<path d="M 0 -6 L -10 0 L 0 6 M -15 -6 V 6"/>',
    'zero-many':'<path d="M 0 -6 L -10 0 L 0 6"/><circle cx="-17" cy="0" r="4" fill="#fff"/>',
    generalization:'<path d="M 0 0 L -13 -7 L -13 7 Z" fill="#fff"/>',
    circle:'<circle cx="-4" cy="0" r="4" fill="#fff"/>',cross:'<path d="M -8 -4 L 0 4 M -8 4 L 0 -4"/>',
  };
  const semanticMarkers=Object.entries(markerShapes).map(([id,shape])=>`<marker id="archmap-${id}" viewBox="-24 -9 26 18" markerWidth="26" markerHeight="18" refX="0" refY="0" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><g stroke="#526981" stroke-width="1.5" fill="none">${shape}</g></marker>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeXml(title)}" style="font-family:${escapeXml(FONT)};background:#fff"><title>${escapeXml(title)}</title><desc>${escapeXml(`${model.nodes.length} nodes and ${model.edges.length} connections. ${model.nodes.map(n => n.label).join(', ')}.`)}</desc><defs>${semanticMarkers}<marker id="archmap-arrow-filled" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M 0 0 L 8 4 L 0 8 Z" fill="#7b8ba0"/></marker><marker id="archmap-arrow" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#7b8ba0" stroke-width="1.7" stroke-linejoin="round"/></marker><marker id="archmap-arrow-start" viewBox="0 0 10 10" refX="8.7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#7b8ba0" stroke-width="1.7" stroke-linejoin="round"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>${model.title ? textLines(wrapText(model.title, layout.width - 72, 19), 36, 42, 19, 26, '#26364b', 650) : ''}${layerBands}${groups}${lifelines}${fragments}${activations}${connections}${centralConnections}${notes}${destructions}${layout.nodes.map(node => renderNode(node, model.kind, layout.edges)).join('')}${labels}</svg>`;
  const warnings = geometryWarnings(layout, model);
  const resultModel = warnings.length ? { ...model, diagnostics: [...model.diagnostics, ...warnings] } : model;
  return { svg, model: resultModel, layout, durationMs: Math.round((performance.now() - start) * 100) / 100 };
}
