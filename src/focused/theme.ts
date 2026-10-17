import type {DiagramColor} from './types.js';
/** Shared output styling. Explicit Mermaid paint always takes precedence. */
export const OUTPUT_THEME = {
  title: '#25384b', detail: '#586c80', edge: '#60758a', groupTitle: '#334e65',
  groupHeader: '#e8eff5', groupSurface: '#f6f8fb', surface: '#ffffff',
  groupFontSize: 14, bpmnHeaderWidth: 128,
} as const;
export const palette: Record<DiagramColor,{ink:string;fill:string;border:string}> = {
  blue:{ink:'#2867a5',fill:'#edf3fa',border:'#8da7bf'},
  green:{ink:'#247954',fill:'#eef8f2',border:'#83b19a'},
  orange:{ink:'#a56b18',fill:'#fff6e8',border:'#c6a268'},
  purple:{ink:'#7652ad',fill:'#f5f0fb',border:'#ac96c9'},
  gray:{ink:'#5d7286',fill:'#f1f4f7',border:'#98aaba'},
};
