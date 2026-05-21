import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { Template, TemplateElement } from './types';

@Component({
  selector: 'app-v5-label-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full overflow-hidden bg-white">

      <div class="px-5 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
        <div class="flex items-baseline gap-2">
          <h2 class="text-[11px] font-bold tracking-wider text-slate-700 uppercase">Sections</h2>
          <span class="text-[10px] text-slate-300">·</span>
          <span class="text-[11px] text-slate-500 font-mono">{{ orderedSections().length }}</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#F5F6F8]">
        @for (kv of orderedSections(); track kv.key) {
           <div class="group relative rounded-lg bg-white overflow-hidden transition-all border"
                [class]="expanded()[kv.key]
                  ? 'border-[#EFD5E2] shadow-[0_2px_8px_-2px_rgba(124,31,92,0.12)]'
                  : 'border-slate-200 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'">

              <!-- Accent strip -->
              <div class="absolute left-0 top-0 bottom-0 w-[3px]" [class]="sectionAccentBg(kv.key)"></div>

              <!-- Section header -->
              <div
                class="pl-4 pr-3 py-2.5 cursor-pointer flex justify-between items-center transition-colors"
                [class]="expanded()[kv.key] ? 'bg-[#FBE6F0]/40 hover:bg-[#FBE6F0]/60' : 'hover:bg-slate-50'"
                (click)="toggleSection(kv.key)" (keydown.enter)="toggleSection(kv.key)" tabindex="0">
                <div class="flex items-center gap-2.5">
                  <svg
                     class="transition-transform duration-150"
                     [class]="expanded()[kv.key] ? 'rotate-90 text-[#7C1F5C]' : 'text-slate-400'"
                     width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span class="text-[13px] font-semibold tracking-tight capitalize" [class]="expanded()[kv.key] ? 'text-[#7C1F5C]' : 'text-slate-900'">{{ kv.key }}</span>
                  <span
                     class="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
                     [class]="expanded()[kv.key]
                       ? 'text-[#7C1F5C] bg-white border-[#EFD5E2]'
                       : 'text-slate-500 bg-slate-100 border-slate-200/60'">{{ kv.value.length }}</span>
                </div>
              </div>

              <!-- Section body -->
              @if (expanded()[kv.key]) {
                <div class="pl-4 pr-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100 bg-[#F5F6F8]/60">
                  @for (el of kv.value; track $index) {
                     @let locked = isLocked(el.type);
                     <div
                        class="flex gap-2 items-start border px-2.5 py-2 rounded-md transition-colors"
                        [class]="locked
                          ? 'bg-slate-50/60 border-slate-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'">

                        <!-- Type indicator + selector -->
                        <div class="flex flex-col w-24 gap-1 shrink-0">
                          <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full ring-2 ring-white shadow-sm" [class]="typeDotClass(el.type)"></span>
                            Type
                            @if (locked) {
                              <svg class="ml-auto text-slate-400" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            }
                          </span>
                          @if (locked) {
                            <div class="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-500 font-medium capitalize cursor-not-allowed select-none">
                              {{ el.type }}
                            </div>
                          } @else {
                            <select
                               [value]="el.type"
                               (change)="updateElementType(kv.key, $index, $event)"
                               class="text-[11px] border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-900 focus:ring-2 focus:ring-[#7C1F5C]/20 focus:border-[#7C1F5C] focus:outline-none w-full transition-all">
                               <option value="token">Token</option>
                               <option value="text">Text</option>
                               <option value="hr">Divider</option>
                            </select>
                          }
                        </div>

                        <!-- Value editor / read-only display -->
                        <div class="flex flex-col flex-1 gap-1 min-w-0">
                          <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Value</span>
                          @if (el.type === 'variable') {
                             <div class="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white cursor-not-allowed select-none flex items-center gap-2 justify-between">
                               <span class="font-mono text-slate-700 truncate" [class.italic]="resolveVariable(el.value) === '—'" [class.text-slate-400]="resolveVariable(el.value) === '—'">{{ resolveVariable(el.value) }}</span>
                               <span class="text-[9px] font-mono text-slate-400 shrink-0 truncate uppercase tracking-wider">{{ el.value }}</span>
                             </div>
                          } @else if (el.type === 'newline') {
                             <div class="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-500 font-mono cursor-not-allowed select-none w-24 flex items-center justify-between">
                               <span>{{ el.value || '10' }}</span>
                               <span class="text-slate-400 text-[10px]">px</span>
                             </div>
                          } @else if (el.type === 'token') {
                             <select
                                [value]="el.value || ''"
                                (change)="updateElementValue(kv.key, $index, $event)"
                                class="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 focus:ring-2 focus:ring-[#7C1F5C]/20 focus:border-[#7C1F5C] focus:outline-none w-full transition-all">
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
                                <optgroup label="Alignment">
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </optgroup>
                                <optgroup label="Commands">
                                  <option value="cutter">Cutter</option>
                                </optgroup>
                             </select>
                          } @else {
                             <input
                                [value]="el.value || ''"
                                (input)="updateElementValue(kv.key, $index, $event)"
                                type="text"
                                [placeholder]="el.type === 'hr' ? '*' : 'Enter value'"
                                class="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-900 placeholder:text-slate-400 font-mono focus:ring-2 focus:ring-[#7C1F5C]/20 focus:border-[#7C1F5C] focus:outline-none w-full transition-all">
                          }
                        </div>

                        <!-- Row actions -->
                        <div class="flex items-end gap-0.5 pt-[18px] shrink-0">
                           <button
                             (click)="moveUp(kv.key, $index)"
                             [disabled]="$index === 0"
                             class="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-1 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                             title="Move up">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                           </button>
                           <button
                             (click)="moveDown(kv.key, $index)"
                             [disabled]="$index === kv.value.length - 1"
                             class="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-1 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                             title="Move down">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                           </button>
                           <button
                             (click)="removeElement(kv.key, $index)"
                             class="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                             title="Remove">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                           </button>
                        </div>
                     </div>
                  }

                  @if (kv.value.length === 0) {
                    <div class="text-center py-3 text-[11px] text-slate-400 bg-white rounded-md border border-dashed border-slate-200">
                      No elements in this section
                    </div>
                  }
                </div>
              }
           </div>
        }

        @if (!tpl() || Object.keys(tpl()).length === 0) {
            <div class="text-center py-10 text-slate-500 text-sm">
              No sections defined.
            </div>
        }
      </div>
    </div>
  `
})
export class V5LabelEditorComponent {
  template = input.required<Template>();
  data = input<Record<string, unknown>>({});
  templateChange = output<Template>();

  expanded = signal<Record<string, boolean>>({});
  Object = Object;

  private readonly labelOrder = ['header', 'itemPage', 'modifier', 'page', 'footer'];
  private readonly receiptOrder = ['header', 'guest', 'item', 'modifier', 'footer'];

  // Accent strip per section — plum-led palette.
  private readonly sectionAccent: Record<string, string> = {
    header:   'bg-[#7C1F5C]',
    guest:    'bg-indigo-600',
    item:     'bg-[#7C1F5C]',
    itemPage: 'bg-indigo-600',
    modifier: 'bg-amber-500',
    page:     'bg-indigo-600',
    footer:   'bg-slate-400',
  };

  // Type dots — small, scan-friendly indicators.
  private readonly typeDot: Record<string, string> = {
    token:    'bg-indigo-500',
    text:     'bg-slate-400',
    variable: 'bg-[#7C1F5C]',
    newline:  'bg-amber-500',
    hr:       'bg-rose-500',
  };

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

  sectionAccentBg(key: string) {
    return this.sectionAccent[key] || 'bg-slate-300';
  }

  typeDotClass(type: string) {
    return this.typeDot[type] || 'bg-slate-400';
  }

  isLocked(type: string) {
    return type === 'variable' || type === 'newline';
  }

  resolveVariable(key: string | undefined): string {
    if (!key) return '';
    const v = this.data()[key];
    if (v === undefined || v === null || v === '') return '—';
    return String(v);
  }

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
