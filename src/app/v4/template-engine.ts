/* ─────────────────────────────────────────────────────────────────────────
 * v4 Template Engine — per-item label renderer
 *
 * Render order (one physical label per item in order.items):
 *   for each item:
 *     header  →  item  →  modifiers  →  optional guest  →  footer
 *
 * Each iteration sees `currentPage` / `totalPages` injected in scope.
 *
 * Language ops:
 *   token    → directives: black, red, narrow, wide, center, left, right, cutter
 *   text     → literal text
 *   variable → resolves a key in scope; if the key has prefix if/ef/ar AND
 *              the template defines a section with that exact name, render
 *              that section conditionally (or iteratively for `ar`)
 *   newline  → flush line, value is line-feed spacing (dots)
 *   hr       → horizontal rule; repeats value char across the row
 *   pad      → pad current line with spaces up to column `value`
 * ───────────────────────────────────────────────────────────────────────── */

export type OpType = 'token' | 'text' | 'variable' | 'newline' | 'hr' | 'pad';

export interface Op {
  type: OpType;
  value: string;
}

export type Section = Op[];
export type Template = Record<string, Section>;

export type Color = 'black' | 'red';
export type Size = 'narrow' | 'wide';
export type Alignment = 'left' | 'center' | 'right';

export interface Segment {
  text: string;
  color: Color;
  size: Size;
}

export type RenderedLine =
  | { type: 'line'; spans: Segment[]; align: Alignment }
  | { type: 'newline'; value: number }
  | { type: 'hr'; value: string; color: Color; size: Size; align: Alignment }
  | { type: 'cutter' };

export interface OrderModifier {
  itemName: string;
  quantity?: number | string;
  indent?: string;
  text?: string;
}

export interface OrderItem {
  itemName: string;
  quantity?: number | string;
  indent?: string;
  text?: string;
  guest?: string;
  modifiers?: OrderModifier[];
}

export interface OrderTag {
  tag: string;
  tagValue?: string;
  style?: string;
}

export interface Order {
  alternate?: string;
  callnum?: string;
  created?: string;
  customer?: string;
  date?: string;
  destination?: string;
  email?: string;
  guest?: string;
  guests?: string;
  guestCount?: number | string;
  memo?: string;
  name?: string;
  onlineId?: string;
  onlineProvider?: string;
  originalReadyTime?: string;
  orderClass?: string;
  orderId?: string;
  owner?: string;
  paid?: boolean | string;
  phone?: string;
  poweredBy?: string;
  readyTime?: string;
  refcode?: string;
  source?: string;
  sourceId?: string;
  style?: string;
  tag?: string;
  tagValue?: string;
  tags?: OrderTag[];
  text?: string;
  time?: string;
  vprinterName?: string;
  currentPage?: number;
  totalPages?: number;
  items: OrderItem[];
  [key: string]: unknown;
}

export type PaperWidth = '80mm' | '58mm';

export interface EscPosCommand {
  hex: string;
  label: string;
  cmd: string;
}

/* ─────────────────────────── interpreter ─────────────────────────── */

const PREFIXES = ['if', 'ef', 'ar'] as const;
type Prefix = (typeof PREFIXES)[number];

function splitPrefix(name: string): [Prefix | null, string] {
  for (const p of PREFIXES) {
    if (name.startsWith(p) && name.length > p.length) return [p, name.slice(p.length)];
  }
  return [null, name];
}

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.length > 0;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return !Number.isNaN(v);
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function toStr(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

interface State {
  color: Color;
  size: Size;
  align: Alignment;
  lines: RenderedLine[];
  buffer: Segment[];
  stack: string[];
}

function newState(): State {
  return {
    color: 'black',
    size: 'narrow',
    align: 'left',
    lines: [],
    buffer: [],
    stack: [],
  };
}

/** Width in columns of a Segment list at narrow=1 / wide=2 spacing. */
function bufferWidth(buf: Segment[]): number {
  let w = 0;
  for (const s of buf) w += s.text.length * (s.size === 'wide' ? 2 : 1);
  return w;
}

function commitLine(state: State): void {
  if (state.buffer.length > 0) {
    state.lines.push({ type: 'line', spans: state.buffer, align: state.align });
    state.buffer = [];
  }
}

function evaluateBlock(
  template: Template,
  sectionName: string,
  scope: Record<string, unknown>,
  state: State,
): void {
  const ops = template[sectionName];
  if (!ops || !Array.isArray(ops)) return;
  if (state.stack.includes(sectionName)) return;
  state.stack.push(sectionName);

  try {
    for (const op of ops) {
      if (!op) continue;

      if (op.type === 'token') {
        const v = op.value;
        if (v === 'narrow' || v === 'wide') state.size = v;
        else if (v === 'black' || v === 'red') state.color = v;
        else if (v === 'center' || v === 'left' || v === 'right') state.align = v;
        else if (v === 'cutter') {
          commitLine(state);
          state.lines.push({ type: 'cutter' });
        }
      } else if (op.type === 'newline') {
        commitLine(state);
        state.lines.push({ type: 'newline', value: parseInt(op.value, 10) || 10 });
      } else if (op.type === 'hr') {
        commitLine(state);
        state.lines.push({
          type: 'hr',
          value: op.value || '*',
          color: state.color,
          size: state.size,
          align: state.align,
        });
      } else if (op.type === 'pad') {
        const target = parseInt(op.value, 10);
        if (Number.isFinite(target)) {
          const cur = bufferWidth(state.buffer);
          const need = Math.max(0, target - cur);
          if (need > 0) {
            state.buffer.push({
              text: ' '.repeat(need),
              color: state.color,
              size: 'narrow',
            });
          }
        }
      } else if (op.type === 'text') {
        state.buffer.push({ text: op.value, color: state.color, size: state.size });
      } else if (op.type === 'variable') {
        emitVariable(template, op.value, scope, state);
      }
    }
  } finally {
    state.stack.pop();
  }
}

function emitVariable(
  template: Template,
  name: string,
  scope: Record<string, unknown>,
  state: State,
): void {
  if (!name) return;
  const [prefix, base] = splitPrefix(name);

  if (prefix === 'if') {
    if (isPresent(scope[base])) {
      if (template[name]) evaluateBlock(template, name, scope, state);
    }
    return;
  }
  if (prefix === 'ef') {
    if (!isPresent(scope[base])) {
      if (template[name]) evaluateBlock(template, name, scope, state);
    }
    return;
  }
  if (prefix === 'ar') {
    const arr = scope[base];
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const sub: Record<string, unknown> = { ...scope };
        if (entry && typeof entry === 'object') Object.assign(sub, entry);
        else {
          sub['tag'] = String(entry);
          sub['tagValue'] = '';
        }
        if (template[name]) evaluateBlock(template, name, sub, state);
      }
    }
    return;
  }

  const resolved = toStr(scope[name]);
  if (resolved) {
    state.buffer.push({ text: resolved, color: state.color, size: state.size });
  }
}

/* ─────────────────────────── public render ───────────────────────── */

/**
 * Render the template for the given order.
 *
 * Items are paginated: one label per `order.items[]`. Each iteration runs:
 *   header → item → modifiers → optional guest → footer
 * with `currentPage` / `totalPages` injected into scope.
 */
export function renderLayout(template: Template, order: Order): RenderedLine[] {
  const state = newState();
  const items = Array.isArray(order.items) ? order.items : [];
  const totalPages = items.length || 1;
  const baseOrder = order as unknown as Record<string, unknown>;

  if (items.length === 0) {
    const scope: Record<string, unknown> = {
      ...baseOrder,
      currentPage: 1,
      totalPages: 1,
    };
    evaluateBlock(template, 'header', scope, state);
    commitLine(state);
    evaluateBlock(template, 'footer', scope, state);
    commitLine(state);
    return state.lines;
  }

  items.forEach((item, idx) => {
    const itemScope: Record<string, unknown> = {
      ...baseOrder,
      ...(item as unknown as Record<string, unknown>),
      currentPage: idx + 1,
      totalPages,
    };

    evaluateBlock(template, 'header', itemScope, state);
    commitLine(state);

    evaluateBlock(template, 'item', itemScope, state);
    commitLine(state);

    if (Array.isArray(item.modifiers)) {
      for (const mod of item.modifiers) {
        const modScope = { ...itemScope, ...(mod as unknown as Record<string, unknown>) };
        evaluateBlock(template, 'modifier', modScope, state);
        commitLine(state);
      }
    }

    if (item.guest) {
      evaluateBlock(template, 'guest', itemScope, state);
      commitLine(state);
    }

    evaluateBlock(template, 'footer', itemScope, state);
    commitLine(state);
  });

  return state.lines;
}

/** Split a flat rendered-line list at every `cutter` so each label is its own array. */
export function splitIntoPages(lines: RenderedLine[]): RenderedLine[][] {
  const pages: RenderedLine[][] = [];
  let current: RenderedLine[] = [];
  for (const line of lines) {
    if (line.type === 'cutter') {
      if (current.length > 0) {
        pages.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

/* ─────────────────────────── ESC/POS emit ────────────────────────── */

function columnsFor(paper: PaperWidth, size: Size): number {
  if (paper === '80mm') return size === 'wide' ? 24 : 48;
  return size === 'wide' ? 16 : 32;
}

function strToHex(s: string): string {
  return s
    .split('')
    .map((c) => (c.charCodeAt(0) & 0xff).toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

/**
 * Compile a rendered line list into a labelled ESC/POS command stream.
 */
export function compileEscPos(
  lines: RenderedLine[],
  paper: PaperWidth = '80mm',
): EscPosCommand[] {
  const stream: EscPosCommand[] = [];
  stream.push({ hex: '1B 40', label: 'ESC @', cmd: 'Initialize printer device' });

  let curSize: Size = 'narrow';
  let curColor: Color = 'black';
  let curAlign: Alignment = 'left';

  const setSize = (s: Size) => {
    if (s === curSize) return;
    curSize = s;
    const code = s === 'wide' ? '11' : '00';
    stream.push({
      hex: `1D 21 ${code}`,
      label: `GS ! ${code}`,
      cmd: `Switch text scale to ${s}`,
    });
  };
  const setColor = (c: Color) => {
    if (c === curColor) return;
    curColor = c;
    const code = c === 'red' ? '01' : '00';
    stream.push({
      hex: `1B 72 ${code}`,
      label: `ESC r ${code}`,
      cmd: `Toggle thermal head colour to ${c}`,
    });
  };
  const setAlign = (a: Alignment) => {
    if (a === curAlign) return;
    curAlign = a;
    const code = a === 'center' ? '01' : a === 'right' ? '02' : '00';
    stream.push({
      hex: `1B 61 ${code}`,
      label: `ESC a ${code}`,
      cmd: `Set text alignment: ${a}`,
    });
  };

  for (const line of lines) {
    if (line.type === 'newline') {
      const feed = Math.max(1, Math.min(6, Math.floor(line.value / 10)));
      const hex = feed.toString(16).toUpperCase().padStart(2, '0');
      stream.push({
        hex: `1B 64 ${hex}`,
        label: `ESC d ${feed}`,
        cmd: `Advance paper by ${feed} line(s)`,
      });
      continue;
    }

    if (line.type === 'cutter') {
      stream.push({ hex: '1D 56 01', label: 'GS V 1', cmd: 'Trigger paper cutter' });
      continue;
    }

    if (line.type === 'hr') {
      setAlign(line.align);
      setSize(line.size);
      setColor(line.color);
      const cols = columnsFor(paper, line.size);
      const filler = String(line.value).repeat(cols).substring(0, cols);
      stream.push({ hex: strToHex(filler), label: 'TEXT', cmd: `Draw divider: "${filler}"` });
      stream.push({ hex: '0A', label: 'LF', cmd: 'Line feed' });
      continue;
    }

    if (line.type === 'line') {
      setAlign(line.align);
      for (const span of line.spans) {
        setSize(span.size);
        setColor(span.color);
        if (span.text) {
          stream.push({
            hex: strToHex(span.text),
            label: 'TEXT',
            cmd: `Emit text: "${span.text}"`,
          });
        }
      }
      stream.push({ hex: '0A', label: 'LF', cmd: 'Line feed' });
    }
  }

  stream.push({ hex: '1B 64 02', label: 'ESC d 2', cmd: 'Trailer feed (2 lines)' });
  stream.push({ hex: '1D 56 01', label: 'GS V 1', cmd: 'Final paper cut' });
  return stream;
}

/** Pack the labelled stream into raw bytes for download / clipboard. */
export function escPosBytes(stream: EscPosCommand[]): Uint8Array {
  const flat = stream.map((c) => c.hex.replace(/\s+/g, '')).join('');
  const bytes = new Uint8Array(flat.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(flat.substr(i * 2, 2), 16);
  return bytes;
}

export function hexDump(stream: EscPosCommand[]): string {
  return stream.map((c) => c.hex).join(' ');
}
