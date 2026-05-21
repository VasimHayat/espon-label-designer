import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { Template, RenderedElement, ElementSelection } from './types';

@Component({
  selector: 'app-v5-label-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-white text-slate-900 p-8 overflow-hidden font-mono min-h-[400px] relative"
      style="width: 384px;"
      (click)="onBackgroundClick($event)">
      @for (line of lines(); track $index) {
        <div [class]="getLineAlignmentClass(line.align)">
          @for (el of line.elements; track $index) {
            @if (el.renderType === 'text') {
               <span
                  [class]="elClasses(el)"
                  (click)="selectFrom(el, $event)">{{ el.text }}</span>
            } @else if (el.renderType === 'hr') {
               <span
                  [class]="elClasses(el)"
                  (click)="selectFrom(el, $event)">{{ el.text }}</span>
            } @else if (el.renderType === 'cutter') {
               <div
                  class="w-full border-t-2 border-dashed border-slate-300 my-4 relative text-left cursor-pointer rounded"
                  [class.ring-2]="isSelected(el)"
                  [class.ring-blue-500]="isSelected(el)"
                  (click)="selectFrom(el, $event)">
                 <span class="absolute right-0 -top-3 text-slate-400 bg-white px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider">✂ Cut</span>
               </div>
            }
          }
        </div>
      }

      @if (lines().length === 0) {
        <div class="text-slate-400 text-center text-xs font-sans mt-10 uppercase tracking-widest font-bold">
          Empty Preview
        </div>
      }
    </div>
  `,
  styles: [`
    :host ::ng-deep .v5-clickable {
      cursor: pointer;
      transition: outline-color 0.12s, background-color 0.12s;
      outline: 1px dashed transparent;
      outline-offset: 1px;
      border-radius: 2px;
    }
    :host ::ng-deep .v5-clickable:hover {
      outline-color: rgb(124 31 92 / 0.45);
      background-color: rgb(251 230 240 / 0.5);
    }
    :host ::ng-deep .v5-selected {
      outline: 2px solid rgb(124 31 92);
      outline-offset: 2px;
      background-color: rgb(251 230 240 / 0.8);
    }
  `]
})
export class V5LabelPreviewComponent {
  template = input.required<Template>();
  data = input.required<Record<string, unknown>>();
  selection = input<ElementSelection | null>(null);

  elementSelected = output<ElementSelection | null>();

  lines = computed(() => {
    const tpl = this.template();
    const d = this.data();

    let sequence: string[] = [];
    if (tpl['itemPage']) {
       sequence = ['header', 'itemPage', 'modifier', 'page', 'footer'];
    } else if (tpl['item']) {
       sequence = ['header', 'guest', 'item', 'modifier', 'footer'];
    } else {
       sequence = Object.keys(tpl);
    }

    const linesArr: {align: string, elements: RenderedElement[]}[] = [];
    let currentLine: RenderedElement[] = [];
    const state: Record<string, string> = { font: 'narrow', color: 'black', align: 'left' };

    const processSection = (sectionName: string, frames = 0) => {
      if (frames > 50) return;
      const sec = tpl[sectionName];
      if (!sec) return;

      for (let idx = 0; idx < sec.length; idx++) {
        const item = sec[idx];
        if (item.type === 'token') {
          if (['narrow', 'wide', 'tiny', 'huge'].includes(item.value || '')) state['font'] = item.value!;
          if (['black', 'red', 'blue', 'green'].includes(item.value || '')) state['color'] = item.value!;
          if (['left', 'center', 'right'].includes(item.value || '')) state['align'] = item.value!;
          if (item.value === 'cutter') currentLine.push({ renderType: 'cutter', srcKey: sectionName, srcIdx: idx });
        } else if (item.type === 'text') {
          currentLine.push({ renderType: 'text', text: item.value, classes: getClasses(state), srcKey: sectionName, srcIdx: idx });
        } else if (item.type === 'newline') {
          linesArr.push({ align: state['align'], elements: currentLine });
          currentLine = [];
        } else if (item.type === 'hr') {
          const ch = item.value && item.value.length > 0 ? item.value : '*';
          const text = ch.repeat(Math.max(1, Math.ceil(40 / ch.length))).slice(0, 40);
          currentLine.push({ renderType: 'hr', text, classes: getClasses(state), srcKey: sectionName, srcIdx: idx });
        } else if (item.type === 'variable' && item.value) {
          const v = item.value;
          if (tpl[v]) {
            // A `variable` whose value matches another section name acts as an
            // *include*. Two naming conventions on the target section gate the
            // include on a data field:
            //   sectionName starts with 'if<Var>' -> rendered only when data[Var] is truthy
            //   sectionName starts with 'ef<Var>' -> rendered only when data[Var] is falsy
            //   otherwise                          -> always rendered
            // The frames cap in processSection guards against accidental cycles.
            if (v.startsWith('if')) {
              const checkVar = v.substring(2);
              if (d[checkVar]) processSection(v, frames + 1);
            } else if (v.startsWith('ef')) {
              const checkVar = v.substring(2);
              if (!d[checkVar]) processSection(v, frames + 1);
            } else {
              processSection(v, frames + 1);
            }
          } else {
            const val = d[v];
            if (val !== undefined && val !== null && val !== '') {
              currentLine.push({ renderType: 'text', text: String(val), classes: getClasses(state), srcKey: sectionName, srcIdx: idx });
            }
          }
        }
      }
    };

    for (const s of sequence) {
       processSection(s);
    }

    if (currentLine.length > 0) {
      linesArr.push({ align: state['align'], elements: currentLine });
    }

    return linesArr;
  });

  getLineAlignmentClass(align: string): string {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  }

  elClasses(el: RenderedElement): string {
    const parts = [el.classes || '', 'v5-clickable'];
    if (this.isSelected(el)) parts.push('v5-selected');
    return parts.join(' ');
  }

  isSelected(el: RenderedElement): boolean {
    const sel = this.selection();
    return !!sel && el.srcKey === sel.key && el.srcIdx === sel.index;
  }

  selectFrom(el: RenderedElement, event: Event) {
    event.stopPropagation();
    if (el.srcKey === undefined || el.srcIdx === undefined) return;
    this.elementSelected.emit({ key: el.srcKey, index: el.srcIdx });
  }

  onBackgroundClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.elementSelected.emit(null);
    }
  }
}

function getClasses(state: Record<string, unknown>) {
  const classes = ['whitespace-pre', 'transition-colors', 'duration-200'];

  if (state['font'] === 'wide') classes.push('text-lg', 'font-bold', 'tracking-wide');
  else if (state['font'] === 'huge') classes.push('text-2xl', 'font-black', 'tracking-widest', 'leading-none');
  else if (state['font'] === 'tiny') classes.push('text-xs', 'font-medium', 'tracking-tighter', 'cursor-default');
  else classes.push('text-sm', 'font-medium');

  if (state['color'] === 'red') classes.push('text-red-600');
  else if (state['color'] === 'blue') classes.push('text-blue-600');
  else if (state['color'] === 'green') classes.push('text-green-600');
  else classes.push('text-slate-900');

  return classes.join(' ');
}
