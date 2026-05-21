import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-v5-json-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full rounded-xl overflow-hidden border bg-[#0f1014] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25),0_1px_3px_rgba(15,23,42,0.06)]"
         [class]="isValid() ? 'border-slate-800' : 'border-rose-500/40'">

      <!-- Header -->
      <div class="flex items-center justify-between bg-[#15161c] border-b border-slate-800/80 px-3.5 h-9 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
          <span class="ml-2 text-[11px] font-mono text-slate-400 truncate">{{ filename() }}</span>
          @if (isValid()) {
            <span class="ml-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/90">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              valid
            </span>
          } @else {
            <span class="ml-1 inline-flex items-center gap-1 text-[10px] font-medium text-rose-400">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              invalid
            </span>
          }
        </div>
        <div class="flex items-center gap-1">
          @if (canFormat()) {
            <button
              (click)="format()"
              class="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 px-2 py-1 rounded transition-colors"
              title="Format (pretty-print)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
              Format
            </button>
          }
          <button
            (click)="copy()"
            class="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 px-2 py-1 rounded transition-colors"
            [title]="copied() ? 'Copied!' : 'Copy to clipboard'">
            @if (copied()) {
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span class="text-emerald-400">Copied</span>
            } @else {
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              Copy
            }
          </button>
        </div>
      </div>

      <!-- Editor body -->
      <div class="relative flex-1 overflow-hidden flex">
        <!-- Gutter -->
        <div #gutter class="bg-[#0c0d11] border-r border-slate-800/60 text-right text-[11px] leading-[1.6] font-mono text-slate-600 select-none px-2.5 py-3 overflow-hidden shrink-0"
             style="min-width: 38px;">
          @for (n of lineNumbers(); track n) {
            <div class="tabular-nums">{{ n }}</div>
          }
        </div>

        <!-- Code area -->
        <div class="relative flex-1 overflow-hidden">
          <!-- Highlight layer -->
          <pre
            #highlight
            class="absolute inset-0 m-0 p-3 font-mono text-[12px] leading-[1.6] text-slate-300 overflow-auto whitespace-pre pointer-events-none"
            [innerHTML]="highlighted()"></pre>

          <!-- Input layer -->
          <textarea
            #input
            [value]="value()"
            (input)="onInput($event)"
            (scroll)="onScroll($event)"
            class="absolute inset-0 m-0 p-3 font-mono text-[12px] leading-[1.6] bg-transparent text-transparent caret-[#D946A0] whitespace-pre overflow-auto resize-none focus:outline-none w-full h-full"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
          ></textarea>
        </div>
      </div>

      <!-- Footer status -->
      <div class="flex items-center justify-between bg-[#15161c] border-t border-slate-800/80 px-3.5 h-6 shrink-0 text-[10px] font-mono">
        <div class="flex items-center gap-3 text-slate-500">
          <span><span class="text-slate-600">lines</span> {{ lineCount() }}</span>
          <span><span class="text-slate-600">bytes</span> {{ byteCount() }}</span>
          <span><span class="text-slate-600">type</span> JSON</span>
        </div>
        @if (!isValid()) {
          <span class="text-rose-400 truncate max-w-[60%]">{{ error() }}</span>
        } @else {
          <span class="text-slate-600">UTF-8</span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    :host ::ng-deep .jk { color: #D946A0; }    /* keys: plum/pink */
    :host ::ng-deep .js { color: #86efac; }    /* strings: emerald */
    :host ::ng-deep .jn { color: #fbbf24; }    /* numbers: amber */
    :host ::ng-deep .jb { color: #fb923c; }    /* booleans: orange */
    :host ::ng-deep .ju { color: #94a3b8; font-style: italic; } /* null */
    :host ::ng-deep .jp { color: #64748b; }    /* punctuation */
  `]
})
export class V5JsonViewerComponent {
  value = input.required<string>();
  filename = input<string>('data.json');
  canFormat = input<boolean>(true);
  // Optional error from the parent (e.g. schema-shape validation). Surfaced
  // in the footer/status row when the JSON itself parses fine.
  extraError = input<string>('');
  valueChange = output<string>();

  copied = signal<boolean>(false);

  constructor(private sanitizer: DomSanitizer) {}

  private parsed = computed<{ ok: boolean; err?: string }>(() => {
    try {
      JSON.parse(this.value());
      return { ok: true };
    } catch (e) {
      return { ok: false, err: e instanceof Error ? e.message : String(e) };
    }
  });

  isValid = computed(() => this.parsed().ok && !this.extraError());
  error = computed(() => this.parsed().err || this.extraError() || '');

  lineCount = computed(() => this.value().split('\n').length);
  byteCount = computed(() => new Blob([this.value()]).size);
  lineNumbers = computed(() => Array.from({ length: this.lineCount() }, (_, i) => i + 1));

  highlighted = computed<SafeHtml>(() => {
    const html = highlightJson(this.value());
    // append trailing newline so the layer matches the textarea's last empty line
    return this.sanitizer.bypassSecurityTrustHtml(html + '\n');
  });

  onInput(event: Event) {
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  }

  onScroll(event: Event) {
    const ta = event.target as HTMLTextAreaElement;
    const pre = ta.previousElementSibling as HTMLElement | null;
    const gutter = ta.parentElement?.previousElementSibling as HTMLElement | null;
    if (pre) {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }
    if (gutter) {
      gutter.scrollTop = ta.scrollTop;
    }
  }

  format() {
    try {
      const formatted = JSON.stringify(JSON.parse(this.value()), null, 2);
      if (formatted !== this.value()) this.valueChange.emit(formatted);
    } catch {
      // ignore — invalid JSON cannot be formatted
    }
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.value());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // clipboard may be unavailable
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, ch => ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;');
}

function highlightJson(src: string): string {
  const escaped = escapeHtml(src);
  return escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g,
    (m, str, colon, kw, num, punct) => {
      if (str !== undefined) {
        if (colon) return `<span class="jk">${str}</span><span class="jp">${colon}</span>`;
        return `<span class="js">${str}</span>`;
      }
      if (kw !== undefined) return `<span class="${kw === 'null' ? 'ju' : 'jb'}">${kw}</span>`;
      if (num !== undefined) return `<span class="jn">${num}</span>`;
      if (punct !== undefined) return `<span class="jp">${punct}</span>`;
      return m;
    }
  );
}
