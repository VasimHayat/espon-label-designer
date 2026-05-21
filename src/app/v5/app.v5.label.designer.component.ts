import { Component, computed, effect, signal } from "@angular/core";
import { DesignerConfig, ElementSelection, Template, TemplateElement, TemplateKind } from "./types";
import { V5LabelPreviewComponent } from "./preview.component";
import { defaultLabel, defaultReceipt } from "./templates";
import { INITIAL_MOCK_DATA } from "./mock-data";
import { V5LabelEditorComponent } from "./editor.component";
import { V5JsonViewerComponent } from "./json-viewer.component";

@Component({
    selector: 'app-v5-label-designer',
    templateUrl: './app.v5.label.designer.component.html',
    styleUrls: ['./app.v5.label.designer.component.scss'],
    imports: [V5LabelPreviewComponent, V5LabelEditorComponent, V5JsonViewerComponent]
})
export class AppV5LabelDesignerComponent {
  labelTemplate = signal<Template>(structuredClone(defaultLabel as Template));
  receiptTemplate = signal<Template>(structuredClone(defaultReceipt as Template));

  activeTemplate = signal<TemplateKind>('label');
  activeTab = signal<'design' | 'data' | 'json'>('design');

  mockDataStr = signal<string>(JSON.stringify(INITIAL_MOCK_DATA, null, 2));
  mockDataObj = signal<Record<string, unknown>>(INITIAL_MOCK_DATA);

  selection = signal<ElementSelection | null>(null);

  currentTemplate = computed<Template>(() =>
    this.activeTemplate() === 'label' ? this.labelTemplate() : this.receiptTemplate()
  );

  selectedElement = computed<TemplateElement | null>(() => {
    const sel = this.selection();
    if (!sel) return null;
    const sec = this.currentTemplate()[sel.key];
    return sec && sec[sel.index] ? sec[sel.index] : null;
  });

  config = computed<DesignerConfig>(() => ({
    label: this.labelTemplate(),
    receipt: this.receiptTemplate(),
  }));

  configJson = computed(() => JSON.stringify(this.config(), null, 2));
  configJsonStr = signal<string>(JSON.stringify({ label: defaultLabel, receipt: defaultReceipt }, null, 2));

  constructor() {
    effect(() => {
      try {
        this.mockDataObj.set(JSON.parse(this.mockDataStr()));
      } catch {
        // invalid JSON — keep previous parsed value
      }
    }, { allowSignalWrites: true });

    effect(() => {
      // clear selection when switching templates so we don't point into the wrong tree
      this.activeTemplate();
      this.selection.set(null);
    }, { allowSignalWrites: true });

    // Keep raw config JSON in sync with templates when they're edited elsewhere.
    effect(() => {
      const cfg = this.config();
      const raw = this.configJsonStr();
      try {
        const parsedRaw = JSON.parse(raw);
        if (JSON.stringify(parsedRaw) !== JSON.stringify(cfg)) {
          this.configJsonStr.set(JSON.stringify(cfg, null, 2));
        }
      } catch {
        // raw is invalid — user is mid-edit, do not overwrite their typing
      }
    }, { allowSignalWrites: true });
  }

  setActiveTemplate(kind: TemplateKind) {
    this.activeTemplate.set(kind);
  }

  updateCurrentTemplate(tpl: Template) {
    if (this.activeTemplate() === 'label') this.labelTemplate.set(tpl);
    else this.receiptTemplate.set(tpl);
  }

  resetCurrentTemplate() {
    if (this.activeTemplate() === 'label') {
      this.labelTemplate.set(structuredClone(defaultLabel as Template));
    } else {
      this.receiptTemplate.set(structuredClone(defaultReceipt as Template));
    }
    this.selection.set(null);
  }

  updateMockData(event: Event) {
    this.mockDataStr.set((event.target as HTMLTextAreaElement).value);
  }

  onMockDataChange(value: string) {
    this.mockDataStr.set(value);
  }

  onConfigJsonChange(value: string) {
    this.configJsonStr.set(value);
    try {
      const parsed = JSON.parse(value) as Partial<DesignerConfig>;
      if (parsed && typeof parsed === 'object') {
        if (parsed.label) this.labelTemplate.set(parsed.label);
        if (parsed.receipt) this.receiptTemplate.set(parsed.receipt);
      }
    } catch {
      // invalid JSON — keep raw text in the editor but don't update templates
    }
  }

  onElementSelected(sel: ElementSelection | null) {
    this.selection.set(sel);
  }

  updateSelectedValue(event: Event) {
    const sel = this.selection();
    if (!sel) return;
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    const tpl = structuredClone(this.currentTemplate());
    if (!tpl[sel.key]?.[sel.index]) return;
    tpl[sel.key][sel.index].value = value;
    this.updateCurrentTemplate(tpl);
  }

  updateSelectedType(event: Event) {
    const sel = this.selection();
    if (!sel) return;
    const type = (event.target as HTMLSelectElement).value;
    const tpl = structuredClone(this.currentTemplate());
    const el = tpl[sel.key]?.[sel.index];
    if (!el) return;
    el.type = type;
    if (type === 'token') el.value = 'narrow';
    else if (type === 'newline') el.value = '10';
    else if (type === 'hr') el.value = '*';
    else el.value = '';
    this.updateCurrentTemplate(tpl);
  }

  moveSelected(direction: -1 | 1) {
    const sel = this.selection();
    if (!sel) return;
    const tpl = structuredClone(this.currentTemplate());
    const arr = tpl[sel.key];
    const target = sel.index + direction;
    if (!arr || target < 0 || target >= arr.length) return;
    [arr[sel.index], arr[target]] = [arr[target], arr[sel.index]];
    this.updateCurrentTemplate(tpl);
    this.selection.set({ key: sel.key, index: target });
  }

  deleteSelected() {
    const sel = this.selection();
    if (!sel) return;
    const tpl = structuredClone(this.currentTemplate());
    tpl[sel.key]?.splice(sel.index, 1);
    this.updateCurrentTemplate(tpl);
    this.selection.set(null);
  }

  insertAfterSelected() {
    const sel = this.selection();
    if (!sel) return;
    const tpl = structuredClone(this.currentTemplate());
    const arr = tpl[sel.key];
    if (!arr) return;
    arr.splice(sel.index + 1, 0, { type: 'text', value: '' });
    this.updateCurrentTemplate(tpl);
    this.selection.set({ key: sel.key, index: sel.index + 1 });
  }

  clearSelection() {
    this.selection.set(null);
  }

  resolveSelectedVariable(): string {
    const el = this.selectedElement();
    if (!el || el.type !== 'variable' || !el.value) return '';
    const v = this.mockDataObj()[el.value];
    if (v === undefined || v === null || v === '') return '—';
    return String(v);
  }

  exportJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.config(), null, 4));
    const dt = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `label-designer-config-${dt}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
