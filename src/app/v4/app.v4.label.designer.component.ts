import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  compileEscPos,
  hexDump,
  renderLayout,
  splitIntoPages,
  type EscPosCommand,
  type Op,
  type OpType,
  type Order,
  type OrderItem,
  type OrderModifier,
  type PaperWidth,
  type RenderedLine,
  type Template,
} from './template-engine';
import {
  CORE_SECTIONS,
  DEFAULT_LAYOUT,
  INITIAL_MOCK_ORDER,
  PRESETS,
  PRESET_LABELS,
  VARIABLE_CATALOG,
  type VariableSpec,
} from './default-data';

type LeftTab = 'editor' | 'sandbox' | 'variables';
type EditorMode = 'visual' | 'raw';
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  text: string;
  type: ToastType;
}

const TOKEN_OPTIONS: { value: string; label: string }[] = [
  { value: 'narrow', label: 'narrow (NormalMonospace)' },
  { value: 'wide', label: 'wide (DoubleWidthBold)' },
  { value: 'black', label: 'black (Thermal Colour: Black)' },
  { value: 'red', label: 'red (Thermal Colour: Red)' },
  { value: 'left', label: 'left (Align Left)' },
  { value: 'center', label: 'center (Align Center)' },
  { value: 'right', label: 'right (Align Right)' },
  { value: 'cutter', label: 'cutter (Hardware Cut Line)' },
];

@Component({
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: 'app.v4.label.designer.component.html',
  styleUrl: 'app.v4.label.designer.component.scss',
})
export class AppV4LabelDesignerComponent {
  readonly variableCatalog: VariableSpec[] = VARIABLE_CATALOG;
  readonly coreSections = CORE_SECTIONS;
  readonly tokenOptions = TOKEN_OPTIONS;
  readonly presetKeys = Object.keys(PRESETS);
  readonly presetLabels = PRESET_LABELS;

  // ── State ──────────────────────────────────────────────────────────────
  layoutConfig = signal<Template>(structuredClone(DEFAULT_LAYOUT));
  mockOrder = signal<Order>(structuredClone(INITIAL_MOCK_ORDER));

  activeLeftTab = signal<LeftTab>('editor');
  activeEditorMode = signal<EditorMode>('visual');
  selectedSection = signal<string>('header');
  paperWidth = signal<PaperWidth>('80mm');

  jsonText = signal<string>(JSON.stringify(DEFAULT_LAYOUT, null, 4));
  jsonError = signal<string | null>(null);

  toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Derived ────────────────────────────────────────────────────────────
  sectionNames = computed(() => Object.keys(this.layoutConfig()));

  activeOps = computed<Op[]>(() => this.layoutConfig()[this.selectedSection()] ?? []);

  renderedLines = computed<RenderedLine[]>(() =>
    renderLayout(this.layoutConfig(), this.mockOrder()),
  );

  /** Rendered lines split by cutter into one array per physical label. */
  pages = computed<RenderedLine[][]>(() => splitIntoPages(this.renderedLines()));

  escPosStream = computed<EscPosCommand[]>(() =>
    compileEscPos(this.renderedLines(), this.paperWidth()),
  );

  conditionalSectionNames = computed(() =>
    this.sectionNames().filter(
      (n) => n.startsWith('if') || n.startsWith('ef') || n.startsWith('ar'),
    ),
  );

  // ── Toasts ─────────────────────────────────────────────────────────────
  private showToast(text: string, type: ToastType = 'info'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ text, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }

  // ── Section / op editing ───────────────────────────────────────────────
  setActiveLeftTab(tab: LeftTab): void {
    this.activeLeftTab.set(tab);
  }

  setEditorMode(mode: EditorMode): void {
    this.activeEditorMode.set(mode);
    if (mode === 'raw') {
      this.jsonText.set(JSON.stringify(this.layoutConfig(), null, 4));
      this.jsonError.set(null);
    }
  }

  setSelectedSection(name: string): void {
    this.selectedSection.set(name);
  }

  setPaperWidth(w: PaperWidth): void {
    this.paperWidth.set(w);
  }

  private mutateLayout(mut: (t: Template) => void): void {
    const next = structuredClone(this.layoutConfig());
    mut(next);
    this.layoutConfig.set(next);
    if (this.activeEditorMode() !== 'raw') {
      this.jsonText.set(JSON.stringify(next, null, 4));
      this.jsonError.set(null);
    }
  }

  addOperation(type: OpType): void {
    const defaults: Record<OpType, string> = {
      text: 'New Text ',
      variable: 'itemName',
      token: 'narrow',
      newline: '10',
      hr: '-',
      pad: '32',
    };
    this.mutateLayout((t) => {
      const list = t[this.selectedSection()] ?? [];
      list.push({ type, value: defaults[type] });
      t[this.selectedSection()] = list;
    });
    this.showToast(`Added ${type} block to [${this.selectedSection()}]`, 'success');
  }

  updateOperation(index: number, patch: Partial<Op>): void {
    this.mutateLayout((t) => {
      const list = t[this.selectedSection()];
      if (!list || !list[index]) return;
      list[index] = { ...list[index], ...patch };
    });
  }

  deleteOperation(index: number): void {
    this.mutateLayout((t) => {
      const list = t[this.selectedSection()];
      if (!list) return;
      list.splice(index, 1);
    });
    this.showToast('Removed format operation block', 'info');
  }

  moveOperation(index: number, dir: -1 | 1): void {
    this.mutateLayout((t) => {
      const list = t[this.selectedSection()];
      if (!list) return;
      const j = index + dir;
      if (j < 0 || j >= list.length) return;
      [list[index], list[j]] = [list[j], list[index]];
    });
  }

  addNewSection(): void {
    const name = window.prompt(
      'Enter a custom section/conditional identifier (e.g. ifcustomer, ifdestination):',
    );
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (this.layoutConfig()[trimmed]) {
      this.showToast('Section identifier already exists!', 'error');
      this.selectedSection.set(trimmed);
      return;
    }
    this.mutateLayout((t) => {
      t[trimmed] = [];
    });
    this.selectedSection.set(trimmed);
    this.showToast(`Created empty section: [${trimmed}]`, 'success');
  }

  // ── Presets ────────────────────────────────────────────────────────────
  loadPreset(key: string): void {
    const preset = PRESETS[key];
    if (!preset) return;
    const clone = structuredClone(preset);
    this.layoutConfig.set(clone);
    this.jsonText.set(JSON.stringify(clone, null, 4));
    this.jsonError.set(null);
    if (!clone[this.selectedSection()]) {
      this.selectedSection.set(Object.keys(clone)[0] ?? 'header');
    }
    this.showToast(`Loaded preset: ${PRESET_LABELS[key] ?? key}`, 'success');
  }

  // ── Raw JSON editor ────────────────────────────────────────────────────
  onJsonInput(raw: string): void {
    this.jsonText.set(raw);
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Layout configuration must be a JSON object of section arrays.');
      }
      for (const [k, v] of Object.entries(parsed)) {
        if (!Array.isArray(v)) throw new Error(`Section "${k}" must be an array.`);
      }
      this.layoutConfig.set(parsed as Template);
      this.jsonError.set(null);
    } catch (err) {
      this.jsonError.set(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  beautifyJson(): void {
    try {
      const parsed = JSON.parse(this.jsonText());
      this.jsonText.set(JSON.stringify(parsed, null, 4));
      this.jsonError.set(null);
      this.showToast('JSON formatted successfully', 'success');
    } catch (err) {
      this.jsonError.set(err instanceof Error ? err.message : 'Invalid JSON');
      this.showToast('Failed to format: syntax error', 'error');
    }
  }

  // ── Export / Import ────────────────────────────────────────────────────
  exportLayout(): void {
    const data = encodeURIComponent(JSON.stringify(this.layoutConfig(), null, 4));
    const a = document.createElement('a');
    a.href = `data:text/json;charset=utf-8,${data}`;
    a.download = `thermal_layout_${this.selectedSection()}.json`;
    a.click();
    this.showToast('JSON layout downloaded', 'success');
  }

  importLayout(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result ?? ''));
        this.layoutConfig.set(parsed);
        this.jsonText.set(JSON.stringify(parsed, null, 4));
        this.jsonError.set(null);
        this.showToast('Layout imported', 'success');
      } catch {
        this.showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  // ── Sandbox edits ──────────────────────────────────────────────────────
  updateMock<K extends keyof Order>(key: K, value: Order[K]): void {
    this.mockOrder.update((o) => ({ ...o, [key]: value }));
  }

  setMockField(key: string, value: unknown): void {
    this.mockOrder.update((o) => ({ ...o, [key]: value } as Order));
  }

  updateMockItem(index: number, patch: Partial<OrderItem>): void {
    this.mockOrder.update((o) => {
      const items = o.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...o, items };
    });
  }

  updateMockModifier(itemIdx: number, modIdx: number, patch: Partial<OrderModifier>): void {
    this.mockOrder.update((o) => {
      const items = o.items.map((it, i) => {
        if (i !== itemIdx) return it;
        const modifiers = (it.modifiers ?? []).map((m, j) =>
          j === modIdx ? { ...m, ...patch } : m,
        );
        return { ...it, modifiers };
      });
      return { ...o, items };
    });
  }

  addMockItem(): void {
    const o = this.mockOrder();
    const newItem: OrderItem = {
      itemName: 'Artisan Woodfired Pizza',
      quantity: 1,
      indent: '  ',
      text: 'Extra crust charring requested',
      guest: String(o.items.length + 1),
      modifiers: [{ itemName: 'Hot Honey Drizzle', quantity: 1, indent: '    ' }],
    };
    this.mockOrder.set({ ...o, items: [...o.items, newItem] });
    this.showToast('Added mock menu item', 'success');
  }

  removeMockItem(index: number): void {
    this.mockOrder.update((o) => ({
      ...o,
      items: o.items.filter((_, i) => i !== index),
    }));
    this.showToast('Mock item removed', 'info');
  }

  addMockModifier(itemIdx: number): void {
    this.mockOrder.update((o) => {
      const items = o.items.map((it, i) => {
        if (i !== itemIdx) return it;
        const modifiers = [
          ...(it.modifiers ?? []),
          { itemName: 'Extra Cheese', quantity: 1, indent: '    ' },
        ];
        return { ...it, modifiers };
      });
      return { ...o, items };
    });
  }

  removeMockModifier(itemIdx: number, modIdx: number): void {
    this.mockOrder.update((o) => {
      const items = o.items.map((it, i) => {
        if (i !== itemIdx) return it;
        const modifiers = (it.modifiers ?? []).filter((_, j) => j !== modIdx);
        return { ...it, modifiers };
      });
      return { ...o, items };
    });
  }

  // ── Print / Hex ────────────────────────────────────────────────────────
  testPrint(): void {
    const bytes = this.escPosStream().length;
    this.showToast(`Generating print stream (${bytes} ops)…`, 'success');
  }

  copyHex(): void {
    const text = hexDump(this.escPosStream());
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => this.showToast('Hex byte-stream copied', 'success'),
        () => this.showToast('Clipboard copy failed', 'error'),
      );
    } else {
      this.showToast('Clipboard API unavailable', 'error');
    }
  }

  // ── Template helpers for the view ──────────────────────────────────────
  isCoreSection(name: string): boolean {
    return CORE_SECTIONS.includes(name);
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByName(_index: number, name: string): string {
    return name;
  }

  /** Width in columns for the live preview at the active paper size. */
  columnsForPreview(size: 'narrow' | 'wide'): number {
    const p = this.paperWidth();
    if (p === '80mm') return size === 'wide' ? 24 : 48;
    return size === 'wide' ? 16 : 32;
  }

  /** Build the divider string for an hr line at the current paper width. */
  hrText(line: Extract<RenderedLine, { type: 'hr' }>): string {
    const cols = this.columnsForPreview(line.size);
    return String(line.value).repeat(cols).substring(0, cols);
  }
}
