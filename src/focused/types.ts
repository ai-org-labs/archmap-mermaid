/** The deliberately small ArchMap diagram model. Positions use a one-based grid. */
export const DIAGRAM_KINDS = ["system", "layers", "sequence", "screens", "activity", "er", "usecase"] as const;
export type DiagramKind = typeof DIAGRAM_KINDS[number];
export type DiagramDirection = "LR" | "TD" | "RL" | "BT";
export type DiagramColor = "blue" | "green" | "orange" | "purple" | "gray";
export type DiagramShape = "card" | "database" | "decision" | "start" | "end" | "fork" | "join" | "modal" | "note";
export interface DiagramPaint { fill?: string; stroke?: string; color?: string }
export interface DiagramNode {
  paint?: DiagramPaint;
  participantType?: string;
  links?: Array<{label:string;href:string}>;
  flowShape?: string;
  noteTarget?: string;
  notePosition?: "left" | "right";
  createdAt?: number;
  destroyedAt?: number;
  id: string;
  label: string;
  image?: {src:string; width?:number; height?:number; position:"t"|"b"; constraint:"on"|"off"; naturalWidth?:number; naturalHeight?:number; data?:string; error?:boolean};
  attributes?: Array<{name:string;type:string;keys:string[];comment:string}>;
  role?: "actor" | "usecase";
  description?: string;
  icon?: string;
  group?: string;
  at?: [number, number];
  shape: DiagramShape;
  color: DiagramColor;
  line: number;
}
export interface DiagramGroup { paint?: DiagramPaint; collapsed?: boolean; direction?: DiagramDirection; id: string; label: string; color: DiagramColor; line: number; parent?: string; concurrent?: boolean }
export interface DiagramScreenAction { node: string; label: string; to?: string; state?: string; effect?: string; when?: string; close?: boolean; line: number }
export interface DiagramEdge { central?: "source" | "target" | "both"; invisible?: boolean; thick?: boolean;  relationship?: "association" | "include" | "extend" | "generalization"; sourceMarker?: string; targetMarker?: string; arrow?: "none" | "open" | "filled"; actionLine?: number; from: string; to: string; label: string; style: "solid" | "dashed"; bidirectional: boolean; line: number }
export interface DiagramFragmentEvent { fill?: string; action: "alt" | "opt" | "loop" | "par" | "else" | "and" | "end" | "critical" | "option" | "break" | "rect"; label: string; afterEdge: number; line: number }
export interface DiagramNoteEvent { from: string; to: string; label: string; placement: "left" | "right" | "over"; afterEdge: number; line: number }
export interface DiagramActivationEvent { action: "activate" | "deactivate"; node: string; afterEdge: number; line: number }
export interface DiagramDiagnostic { line: number; severity: "error" | "warning"; message: string }
export interface DiagramModel {
  kind: DiagramKind;
  direction: DiagramDirection;
  style?: "cards" | "icons";
  title: string;
  nodes: DiagramNode[];
  groups: DiagramGroup[];
  edges: DiagramEdge[];
  diagnostics: DiagramDiagnostic[];
  screenActions?: DiagramScreenAction[];
  activationEvents?: DiagramActivationEvent[];
  fragmentEvents?: DiagramFragmentEvent[];
  noteEvents?: DiagramNoteEvent[];
}
export interface DiagramBox { x: number; y: number; width: number; height: number }
export interface DiagramPoint { x: number; y: number }
export interface DiagramScreenContent {
  title: string[];
  description: string[];
  image?: DiagramBox;
  titleY?: number;
  headerHeight: number;
  height: number;
  actions: Array<{ edge?: DiagramEdge; line: number; kind?: string; detail?: string[]; label: string; lines: string[]; top: number; height: number }>;
}
export interface DiagramLayoutNode extends DiagramBox { node: DiagramNode; iconMode?: boolean; junction?: DiagramBox; junctionLabel?: DiagramBox; screen?: DiagramScreenContent }
export interface DiagramLayoutEdge { edge: DiagramEdge; points: DiagramPoint[]; labelBox?: DiagramBox }
export interface DiagramLayout {
  width: number;
  height: number;
  nodes: DiagramLayoutNode[];
  groups: Array<DiagramBox & { group: DiagramGroup }>;
  edges: DiagramLayoutEdge[];
  notes?: Array<DiagramBox & {label: string; line: number}>;
  destructions?: Array<DiagramPoint & {node: string}>;
  fragments?: Array<DiagramBox & { fill?: string; kind: "alt" | "opt" | "loop" | "par" | "critical" | "break" | "rect"; label: string; line: number; depth: number; headerHeight: number; branches: Array<{ label: string; y: number; height: number }> }>;
  activations?: Array<DiagramBox & { node: string; depth: number; line: number }>;
}
export interface DiagramRenderResult { svg: string; model: DiagramModel; layout: DiagramLayout; durationMs: number }
export interface DiagramSample { id: DiagramKind; title: string; subtitle: string; source: string }

/** Rendering preference only; never changes Mermaid direction, content or font size. */
export interface DiagramLayoutOptions {
  balance?: 'auto' | 'off';
  /** Preferred width / height. A soft preference, not a fixed canvas size. */
  targetAspectRatio?: number;
}
