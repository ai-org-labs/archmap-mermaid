import type {DiagramPaint} from './types.js';

/** Only literal CSS colors may reach SVG attributes; never URLs or arbitrary CSS. */
export function safePaint(value: string, text = false): boolean {
  if (!text && value === 'none') return true;
  if (!/^(#[\da-f]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d.%+, /-]+\))$/i.test(value)) return false;
  if (/^(inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(value)) return false;
  const style = document.createElement('span').style;
  style.color = value;
  return !!style.color;
}
export function resolvePaint(classes: Map<string, {styles?: string[]; textStyles?: string[]}>, names: string[], styles: string[], warn: (message:string)=>void): DiagramPaint | undefined {
  const declarations = [...['default', ...names.filter(n=>n!=='default')].flatMap(name => classes.get(name)?.styles ?? []), ...styles];
  const paint: DiagramPaint = {};
  for (const declaration of declarations) for (const part of declaration.split(';')) {
    if (!part.trim()) continue;
    const colon = part.indexOf(':');
    const key = part.slice(0,colon).trim(), value = part.slice(colon+1).trim();
    if (!['fill','stroke','color'].includes(key)) { warn(`装飾 ${key} は未対応です。色指定は fill / stroke / color を使用してください。`); continue; }
    if (!safePaint(value,key==='color')) { warn(`安全な色として解釈できない ${key} の指定を無視しました。`); continue; }
    paint[key as keyof DiagramPaint] = value;
  }
  return Object.keys(paint).length ? paint : undefined;
}
