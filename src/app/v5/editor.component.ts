import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { Template, TemplateElement } from './types';

@Component({
  selector: 'app-v5-label-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full overflow-hidden bg-white">
      <div class="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Template structure</h2>
        <button
          (click)="addSection()"
          class="flex items-center gap-1 text-xs uppercase font-bold tracking-wider bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 px-3 py-1.5 rounded transition-colors shadow-sm">
          + Add Section
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        @for (kv of orderedSections(); track kv.key) {
           <div class="border border-slate-200 rounded group hover:border-slate-300 bg-white overflow-hidden transition-all duration-200">
              <div
                class="font-medium p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center group transition-colors"
                (click)="toggleSection(kv.key)" (keydown.enter)="toggleSection(kv.key)" tabindex="0">
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full transition-colors" [class.bg-blue-500]="expanded()[kv.key]" [class.bg-slate-300]="!expanded()[kv.key]"></div>
                  <span class="text-sm font-medium" [class.text-blue-900]="expanded()[kv.key]" [class.text-slate-600]="!expanded()[kv.key]">{{ kv.key }}</span>
                  <span class="text-[10px] font-mono text-slate-400">[{{ kv.value.length }}]</span>
                </div>

                <div class="flex flex-row gap-2">
                  <button
                    (click)="addElement(kv.key, $event)"
                    class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase font-bold tracking-wider bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 px-2 py-1 rounded"
                    title="Add new element to this section">
                    + Add token
                  </button>
                  <button
                    (click)="removeSection(kv.key, $event)"
                    class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase font-bold tracking-wider bg-white border border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                    title="Delete section">
                    Delete
                  </button>
                </div>
              </div>

              @if (expanded()[kv.key]) {
                <div class="p-3 bg-slate-50/50 space-y-2 border-t border-slate-100">
                  @for (el of kv.value; track $index) {
                     <div class="flex gap-2 items-center bg-white border border-slate-200 p-2 rounded hover:border-blue-300 hover:shadow-sm transition-all group">

                        <div class="flex flex-col w-28 gap-1">
                          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                          <select
                             [value]="el.type"
                             (change)="updateElementType(kv.key, $index, $event)"
                             class="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow">
                             <option value="token">Token</option>
                             <option value="text">Text</option>
                             <option value="variable">Variable</option>
                             <option value="newline">Newline</option>
                             <option value="hr">Divider</option>
                          </select>
                        </div>

                        <div class="flex flex-col flex-1 gap-1">
                          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Value</span>
                          @if (el.type === 'token') {
                             <select
                                [value]="el.value || ''"
                                (change)="updateElementValue(kv.key, $index, $event)"
                                class="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow w-full">
                                <optgroup label="Fonts & Sizes">
                                  <option value="tiny">Tiny</option>
                                  <option value="narrow">Narrow (normal)</option>
                                  <option value="wide">Wide</option>
                                  <option value="huge">Huge</option>
                                </optgroup>
                                <optgroup label="Colors">
                                  <option value="black">Black</option>
                                  <option value="red">Red</option>
                                  <option value="blue">Blue</option>
                                  <option value="green">Green</option>
                                </optgroup>
                                <optgroup label="Commands">
                                  <option value="cutter">✂️ Cutter</option>
                                </optgroup>
                             </select>
                          } @else if (el.type === 'newline') {
                             <input
                                [value]="el.value || '10'"
                                (input)="updateElementValue(kv.key, $index, $event)"
                                type="number"
                                min="0"
                                placeholder="Space..."
                                class="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow w-24">
                          } @else if (el.type === 'hr') {
                             <input
                                [value]="el.value || '*'"
                                (input)="updateElementValue(kv.key, $index, $event)"
                                type="text"
                                placeholder="*"
                                class="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow w-full">
                          } @else {
                             <input
                                [value]="el.value || ''"
                                (input)="updateElementValue(kv.key, $index, $event)"
                                type="text"
                                placeholder="Enter value..."
                                class="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-800 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow w-full">
                          }
                        </div>

                        <div class="flex items-end h-full pt-[22px] justify-end gap-1 shrink-0">
                           <button
                             (click)="moveUp(kv.key, $index)"
                             [disabled]="$index === 0"
                             class="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                             title="Move Up">
                             ▲
                           </button>
                           <button
                             (click)="moveDown(kv.key, $index)"
                             [disabled]="$index === kv.value.length - 1"
                             class="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors"
                             title="Move Down">
                             ▼
                           </button>
                           <button
                             (click)="removeElement(kv.key, $index)"
                             class="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors ml-1"
                             title="Remove Element">
                             ✕
                           </button>
                        </div>
                     </div>
                  }

                  @if (kv.value.length === 0) {
                    <div class="text-center py-4 text-xs text-slate-400 font-bold uppercase tracking-widest bg-white rounded border border-dashed border-slate-200">
                      Empty section
                    </div>
                  }
                </div>
              }
           </div>
        }

        @if (!tpl() || Object.keys(tpl()).length === 0) {
            <div class="text-center py-10 text-slate-500 font-medium text-sm">
              No sections defined in template.
            </div>
        }
      </div>
    </div>
  `
})
export class V5LabelEditorComponent {
  template = input.required<Template>();
  templateChange = output<Template>();

  expanded = signal<Record<string, boolean>>({});
  Object = Object;

  private readonly labelOrder = ['header', 'itemPage', 'modifier', 'page', 'footer'];
  private readonly receiptOrder = ['header', 'guest', 'item', 'modifier', 'footer'];

  tpl() {
     return this.template();
  }

  orderedSections = computed<{ key: string; value: TemplateElement[] }[]>(() => {
    const tpl = this.template();
    const keys = Object.keys(tpl);
    const preferred = tpl['itemPage'] ? this.labelOrder : tpl['item'] ? this.receiptOrder : [];
    const ordered = preferred.filter(k => keys.includes(k));
    const extras = keys.filter(k => !ordered.includes(k));
    return [...ordered, ...extras].map(key => ({ key, value: tpl[key] }));
  });

  toggleSection(key: string) {
    this.expanded.update(e => ({ ...e, [key]: !e[key] }));
  }

  addSection() {
    const name = prompt('Enter new section name:');
    if (name && !this.template()[name]) {
      const newTpl = { ...this.template(), [name]: [] };
      this.templateChange.emit(newTpl);
      this.expanded.update(e => ({ ...e, [name]: true }));
    }
  }

  removeSection(key: string, event: Event) {
    event.stopPropagation();
    if (confirm('Delete section "' + key + '" and all its elements?')) {
      const newTpl = { ...this.template() };
      delete newTpl[key];
      this.templateChange.emit(newTpl);
    }
  }

  addElement(key: string, event: Event) {
    event.stopPropagation();
    const newTpl = structuredClone(this.template());
    newTpl[key].push({ type: 'text', value: '' });
    this.templateChange.emit(newTpl);
    this.expanded.update(e => ({ ...e, [key]: true }));
  }

  updateElementType(key: string, index: number, event: Event) {
    const select = event.target as HTMLSelectElement;
    const type = select.value;
    const newTpl = structuredClone(this.template());
    const el = newTpl[key][index];
    el.type = type;

    if (type === 'token') el.value = 'narrow';
    else if (type === 'newline') el.value = '10';
    else if (type === 'hr') el.value = '*';
    else el.value = '';

    this.templateChange.emit(newTpl);
  }

  updateElementValue(key: string, index: number, event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const newTpl = structuredClone(this.template());
    newTpl[key][index].value = input.value;
    this.templateChange.emit(newTpl);
  }

  moveUp(key: string, index: number) {
    if (index > 0) {
      const newTpl = structuredClone(this.template());
      const arr = newTpl[key];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      this.templateChange.emit(newTpl);
    }
  }

  moveDown(key: string, index: number) {
    const newTpl = structuredClone(this.template());
    const arr = newTpl[key];
    if (index < arr.length - 1) {
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      this.templateChange.emit(newTpl);
    }
  }

  removeElement(key: string, index: number) {
    const newTpl = structuredClone(this.template());
    newTpl[key].splice(index, 1);
    this.templateChange.emit(newTpl);
  }
}
