import { ChangeDetectionStrategy, Component, computed, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

/**
 * Epson TM-L90 @ 203 DPI — 80mm roll = 576 dots wide.
 * At normal character size (12×24 dot cell): 48 chars/line.
 * At double-width (GS ! 0x10): 24 chars/line.
 * At double-width + double-height (GS ! 0x11): 24 chars/line.
 *
 * Tag contract (consumed by the print bridge / ESC-POS translator):
 *   [INIT]             → ESC @            (0x1B 0x40)  printer reset
 *   [CODEPAGE CP437]   → ESC t 0          (0x1B 0x74 0x00)  set char table
 *   [LEFT]             → ESC a 0          (0x1B 0x61 0x00)
 *   [CENTER]           → ESC a 1          (0x1B 0x61 0x01)
 *   [RIGHT]            → ESC a 2          (0x1B 0x61 0x02)
 *   [BOLD ON]          → ESC E 1          (0x1B 0x45 0x01)
 *   [BOLD OFF]         → ESC E 0          (0x1B 0x45 0x00)
 *   [GS_SIZE 0x11]     → GS ! 0x11        (0x1D 0x21 0x11)  double-W + double-H
 *   [GS_SIZE 0x01]     → GS ! 0x01        (0x1D 0x21 0x01)  double-H only
 *   [GS_SIZE 0x00]     → GS ! 0x00        (0x1D 0x21 0x00)  normal size
 *   [LABEL SIZE WxH GAP|BMARK|CONT]
 *                      → configure label media in bridge
 *   [FORM FEED]        → FF               (0x0C)  advance to next label (label stock)
 *   [FEED 3]           → ESC d 3          (0x1B 0x64 0x03)  feed N lines (continuous)
 *   [FULL CUT]         → GS V 1           (0x1D 0x56 0x01)  full cut (continuous only)
 *   [PARTIAL CUT]      → GS V 66 0        (0x1D 0x56 0x42 0x00)  partial cut
 *
 * Template line format (bridge processes line-by-line):
 *   Lines matching /^\[.+\]$/ are command lines (no paper output).
 *   All other lines are text lines (printed + LF).
 *   [BOLD ON] / [BOLD OFF] may wrap multiple text lines.
 */

interface LayoutSection {
  id: string;
  label: string;
  hidden: boolean;
}

// 80mm TM-L90 at normal size: 48 chars per line
const PRINTER_LINE_WIDTH = 48;
const SEPARATOR = `[LEFT]\n${'-'.repeat(PRINTER_LINE_WIDTH)}`;

type LabelGapType = 'GAP' | 'BMARK' | 'CONT';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, MatIconModule, DragDropModule],
  templateUrl: 'app.v2.label.designer.comoponent.html',
  styleUrl: 'app.v2.label.designer.comoponent.scss'
})
export class AppV2LabelDesignerComponent {
  private fb = inject(FormBuilder);

  defaultLayout: LayoutSection[] = [
    { id: 'header',     label: 'Order ID',            hidden: false },
    { id: 'customer',   label: 'Customer Info',        hidden: false },
    { id: 'metrics',    label: 'Metrics (Time/Date)',  hidden: false },
    { id: 'branding',   label: 'Branding (Powered by)',hidden: false },
    { id: 'subtotals',  label: 'Subtotal & Tax',       hidden: false },
    { id: 'total',      label: 'Total Amount',         hidden: false },
    { id: 'provider',   label: 'Provider Info',        hidden: false },
    { id: 'items',      label: 'Items List',           hidden: false },
    { id: 'orderClass', label: 'Order Type',           hidden: false }
  ];

  layoutState = signal<LayoutSection[]>([...this.defaultLayout]);

  /** Full ordered list — used in the layout panel for drag+reorder and visibility toggle */
  layoutOptions = computed<LayoutSection[]>(() => {
    return this.formData()?.enableCustomLayout ? this.layoutState() : this.defaultLayout;
  });

  /** Only visible sections — used in the receipt preview and ESC/POS payload */
  visibleSections = computed<LayoutSection[]>(() =>
    this.layoutOptions().filter(s => !s.hidden)
  );

  toggleSectionVisibility(id: string) {
    this.layoutState.update(sections =>
      sections.map(s => s.id === id ? { ...s, hidden: !s.hidden } : s)
    );
    // Also sync defaultLayout so visibility persists when custom layout is off
    const target = this.defaultLayout.find(s => s.id === id);
    if (target) target.hidden = !target.hidden;
  }

  dropSection(event: CdkDragDrop<{id: string, label: string}[]>) {
    const newArr = [...this.layoutState()];
    moveItemInArray(newArr, event.previousIndex, event.currentIndex);
    this.layoutState.set(newArr);
  }

  form: FormGroup = this.fb.group({
    enableCustomLayout: [false],
    labelSize:    ['continuous'],
    labelGapType: ['GAP'],          // GAP | BMARK | CONT — media gap detection
    id:           ['7829', Validators.required],
    orderClass:   ['Delivery'],
    customerName: ['John Doe'],
    customerPhone:['(555) 123-4567'],
    itemIndex:    [1],
    itemCount:    [3],
    createdTime:  ['14:30'],
    createdDate:  ['10/12/2023'],
    items: this.fb.array([
      this.fb.group({
        itemName:  ['Spicy Chicken Sandwich', Validators.required],
        modifiers: ['- No Mayo\n- Add Extra Pickles\n- Toasted Bun'],
        align:     ['left'],
        isBold:    [true]
      })
    ]),
    subtotal:     [24.50],
    tax:          [2.10],
    deliveryFee:  [5.00],
    onlineProvider: ['UberEats'],
    onlineId:       ['UBW-9921D'],
    branding:       ['Powered by Plum POS'],
    labelItem:      ['Item:'],
    labelTime:      ['Time:'],
    labelDate:      ['Date:'],
    labelSubtotal:  ['Subtotal:'],
    labelTax:       ['Tax     :'],
    labelDelivery:  ['Delv Chg:'],
    labelTotal:     ['TOTAL:'],
    labelItems:     ['ITEMS:'],
    labelOrderType: ['ORDER TYPE:'],
    formats: this.fb.group({
      id:            this.fb.group({ align: ['center'], isBold: [true]  }),
      customerName:  this.fb.group({ align: ['center'], isBold: [false] }),
      customerPhone: this.fb.group({ align: ['center'], isBold: [false] }),
      itemIndex:     this.fb.group({ align: ['left'],   isBold: [false] }),
      itemCount:     this.fb.group({ align: ['left'],   isBold: [false] }),
      createdTime:   this.fb.group({ align: ['left'],   isBold: [false] }),
      createdDate:   this.fb.group({ align: ['left'],   isBold: [false] }),
      total:         this.fb.group({ align: ['left'],   isBold: [true]  }),
      onlineProvider:this.fb.group({ align: ['center'], isBold: [false] }),
      onlineId:      this.fb.group({ align: ['center'], isBold: [false] }),
      orderClass:    this.fb.group({ align: ['center'], isBold: [false] }),
      branding:      this.fb.group({ align: ['center'], isBold: [false] }),
    })
  });

  viewMode       = signal<'preview' | 'escpos' | 'hex'>('preview');
  feedbackStatus = signal<'copied' | 'printed' | null>(null);

  formData = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  labelDimensions = computed(() => {
    const size = this.formData()?.labelSize || 'continuous';
    const pxPerInch = 120;
    if (size === 'continuous') return { width: '380px', minHeight: '650px' };
    const [w, h] = size.split('x').map(Number);
    return { width: `${w * pxPerInch}px`, height: `${h * pxPerInch}px` };
  });

  calculatedTotal = computed(() => {
    const d = this.formData();
    return Number(d.subtotal || 0) + Number(d.tax || 0) + Number(d.deliveryFee || 0);
  });

  /** Recomputes only when reactive form data changes — never on CD cycle */
  rawPayload = computed(() => this._buildEscPosPayload());

  /** Hex dump: converts each template tag to its real ESC/POS byte sequence */
  hexPayload = computed(() => this._buildHexDump());

  get itemsFormArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  getFormatGroup(field: string): FormGroup {
    return this.form.get(`formats.${field}`) as FormGroup;
  }

  getFormat(field: string, prop: 'align' | 'isBold'): string | boolean | undefined {
    if (field.startsWith('item_')) {
      const idx = parseInt(field.split('_')[1], 10);
      return this.formData()?.items[idx]?.[prop];
    }
    return this.formData()?.formats?.[field]?.[prop];
  }

  setFormat(field: string, prop: 'align' | 'isBold', value: string | boolean) {
    if (field.startsWith('item_')) {
      const idx = parseInt(field.split('_')[1], 10);
      const fg = this.itemsFormArray.at(idx);
      fg?.patchValue({ [prop]: value });
      return;
    }
    this.form.get(`formats.${field}.${prop}`)?.setValue(value);
  }

  getAlignClass(field: string): string {
    const a = this.getFormat(field, 'align');
    return a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';
  }

  getJustifyClass(field: string): string {
    const a = this.getFormat(field, 'align');
    return a === 'center' ? 'justify-center' : a === 'right' ? 'justify-end' : 'justify-start';
  }

  getBoldClass(field: string): string {
    return this.getFormat(field, 'isBold') ? 'font-bold' : 'font-normal';
  }

  addItem() {
    this.itemsFormArray.push(this.fb.group({
      itemName:  ['', Validators.required],
      modifiers: [''],
      align:     ['left'],
      isBold:    [false]
    }));
  }

  copyItem(index: number) {
    const item = this.itemsFormArray.at(index).value;
    this.itemsFormArray.push(this.fb.group({
      itemName:  [item.itemName, Validators.required],
      modifiers: [item.modifiers],
      align:     [item.align  ?? 'left'],
      isBold:    [item.isBold ?? false]
    }));
  }

  removeItem(index: number) {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
    }
  }

  copyRawPayload() {
    navigator.clipboard.writeText(this.rawPayload()).then(() => this._showFeedback('copied'));
  }

  handlePrint() {
    const payload = this.rawPayload();
    console.log('[ESC/POS Payload for Epson TM-L90]', payload);
    // TODO: pass payload to your ESC/POS print bridge/service, e.g.:
    // this.printerService.send(payload);
    this._showFeedback('printed');
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 }).format(val);
  }

  private _showFeedback(status: 'copied' | 'printed') {
    this.feedbackStatus.set(status);
    setTimeout(() => this.feedbackStatus.set(null), 2000);
  }

  // ─── ESC/POS helpers ──────────────────────────────────────────────────────

  private _align(field: string): string {
    const a = this.getFormat(field, 'align');
    return a === 'center' ? '[CENTER]' : a === 'right' ? '[RIGHT]' : '[LEFT]';
  }

  /**
   * Wraps text in [BOLD ON]/[BOLD OFF] if the field has isBold=true.
   * The bridge must NOT emit a line-feed for command lines (lines matching /^\[.+\]$/).
   * Multiple text lines inside a bold block are all printed in bold.
   */
  private _bold(field: string, text: string): string {
    return this.getFormat(field, 'isBold')
      ? `[BOLD ON]\n${text}\n[BOLD OFF]`
      : text;
  }

  /**
   * Wraps each text line individually in bold — use this when targeting a
   * strict line-by-line bridge that cannot handle multi-line bold blocks.
   */
  private _boldPerLine(field: string, text: string): string {
    if (!this.getFormat(field, 'isBold')) return text;
    return text.split('\n').map(l => `[BOLD ON]\n${l}\n[BOLD OFF]`).join('\n');
  }

  // ─── Hex dump ─────────────────────────────────────────────────────────────

  /**
   * Maps every [TAG] line in the template payload to its real ESC/POS bytes.
   * Text lines are encoded as CP437 bytes (ASCII-compatible for standard chars).
   * Output: classic hex-dump format — offset | hex bytes (16/row) | ASCII glyph
   */
  private _buildHexDump(): string {
    // Tag → ESC/POS byte sequences (Epson TM-L90 command set)
    const TAG_BYTES: Record<string, number[]> = {
      '[INIT]':             [0x1B, 0x40],
      '[CODEPAGE CP437]':   [0x1B, 0x74, 0x00],
      '[LEFT]':             [0x1B, 0x61, 0x00],
      '[CENTER]':           [0x1B, 0x61, 0x01],
      '[RIGHT]':            [0x1B, 0x61, 0x02],
      '[BOLD ON]':          [0x1B, 0x45, 0x01],
      '[BOLD OFF]':         [0x1B, 0x45, 0x00],
      '[GS_SIZE 0x11]':     [0x1D, 0x21, 0x11],   // double-W + double-H
      '[GS_SIZE 0x01]':     [0x1D, 0x21, 0x01],   // double-H only
      '[GS_SIZE 0x00]':     [0x1D, 0x21, 0x00],   // normal size
      '[FEED 3]':           [0x1B, 0x64, 0x03],   // ESC d 3
      '[FULL CUT]':         [0x1D, 0x56, 0x01],   // GS V 1
      '[PARTIAL CUT]':      [0x1D, 0x56, 0x42, 0x00],
      '[FORM FEED]':        [0x0C],               // FF — advance to next label
    };

    const bytes: number[] = [];

    for (const line of this.rawPayload().split('\n')) {
      const trimmed = line.trim();

      // Dynamic tag: [LABEL SIZE 4x6 GAP] — bridge-only, no ESC/POS bytes
      if (/^\[LABEL SIZE .+\]$/.test(trimmed)) {
        // Emit a comment marker so the hex viewer shows intent
        // No actual bytes sent to printer — bridge handles this
        continue;
      }

      if (TAG_BYTES[trimmed] !== undefined) {
        bytes.push(...TAG_BYTES[trimmed]);
      } else if (trimmed === '') {
        // Empty line = LF
        bytes.push(0x0A);
      } else {
        // Text line: encode as bytes + LF
        for (let i = 0; i < line.length; i++) {
          bytes.push(line.charCodeAt(i) & 0xFF);
        }
        bytes.push(0x0A);
      }
    }

    // Format as hex dump: offset | 16 hex bytes | ASCII
    const ROW = 16;
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += ROW) {
      const chunk  = bytes.slice(i, i + ROW);
      const offset = i.toString(16).toUpperCase().padStart(4, '0');
      const hex    = chunk.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
                         .padEnd(ROW * 3 - 1, ' ');
      const ascii  = chunk.map(b => (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.').join('');
      lines.push(`${offset}  ${hex}  ${ascii}`);
    }
    return lines.join('\n');
  }

  // ─── Payload builder ──────────────────────────────────────────────────────

  private _buildEscPosPayload(): string {
    const data  = this.formData();
    const total = this.calculatedTotal();
    const isLabel = data.labelSize !== 'continuous';

    // ── Items block ──
    let itemsBlock = '';
    if (data.items?.length) {
      for (const item of data.items as { itemName: string; modifiers?: string; align?: string; isBold?: boolean }[]) {
        const align    = item.align === 'center' ? '[CENTER]' : item.align === 'right' ? '[RIGHT]' : '[LEFT]';
        const itemText = item.modifiers ? `${item.itemName}\n${item.modifiers}` : item.itemName;
        itemsBlock += `\n${align}\n`;
        itemsBlock += item.isBold !== false
          ? `[BOLD ON]\n${itemText}\n[BOLD OFF]\n`
          : `${itemText}\n`;
      }
      itemsBlock += '[LEFT]';
    }

    // ── Header ──
    // [INIT] = ESC @ resets printer. [CODEPAGE CP437] = ESC t 0 must follow
    // immediately so any subsequent text uses the correct character table.
    let payload = `[INIT]\n[CODEPAGE CP437]\n`;

    if (isLabel) {
      // [LABEL SIZE WxH GAP|BMARK|CONT] — bridge converts to Epson label config
      const gapType: LabelGapType = (data.labelGapType as LabelGapType) || 'GAP';
      payload += `[LABEL SIZE ${data.labelSize} ${gapType}]\n\n`;
    }

    // ── Sections ──
    let lastAlign = '';   // track active alignment to suppress redundant [ALIGN] tags

    const emitAlign = (tag: string): string => {
      if (tag === lastAlign) return '';
      lastAlign = tag;
      return `${tag}\n`;
    };

    const sections = this.visibleSections();
    sections.forEach((section, index) => {
      switch (section.id) {

        case 'header':
          // GS ! 0x11 = double-width + double-height (header needs maximum impact)
          payload += emitAlign(this._align('id'));
          payload += `[GS_SIZE 0x11]\n${this._bold('id', '#' + (data.id ?? ''))}\n[GS_SIZE 0x00]\n`;
          break;

        case 'customer':
          payload += emitAlign(this._align('customerPhone'));
          payload += `${this._bold('customerPhone', data.customerPhone ?? '')}\n`;
          payload += emitAlign(this._align('customerName'));
          payload += `${this._bold('customerName', data.customerName ?? '')}\n`;
          break;

        case 'metrics':
          // Only emit [ALIGN] when it actually changes between lines
          payload += emitAlign(this._align('itemIndex'));
          payload += `${this._bold('itemIndex', `${data.labelItem ?? ''} ${data.itemIndex} of ${data.itemCount}`)}\n`;
          payload += emitAlign(this._align('createdTime'));
          payload += `${this._bold('createdTime', `${data.labelTime ?? ''} ${data.createdTime ?? ''}`)}\n`;
          payload += emitAlign(this._align('createdDate'));
          payload += `${this._bold('createdDate', `${data.labelDate ?? ''} ${data.createdDate ?? ''}`)}\n`;
          break;

        case 'branding':
          payload += emitAlign(this._align('branding'));
          payload += `${this._bold('branding', data.branding ?? '')}\n`;
          break;

        case 'subtotals': {
          // Three-line block; all lines share the same bold state — wrap once
          const block =
            `${data.labelSubtotal ?? ''} $${this.formatCurrency(data.subtotal)}\n` +
            `${data.labelTax      ?? ''} $${this.formatCurrency(data.tax)}\n` +
            `${data.labelDelivery ?? ''} $${this.formatCurrency(data.deliveryFee)}`;
          payload += emitAlign(this._align('total'));
          payload += `${this._bold('total', block)}\n`;
          break;
        }

        case 'total':
          // GS ! 0x01 = double-height only — total row stands out without being too wide
          payload += emitAlign(this._align('total'));
          payload += `[GS_SIZE 0x01]\n${this._bold('total', `${data.labelTotal ?? ''} $${this.formatCurrency(total)}`)}\n[GS_SIZE 0x00]\n`;
          break;

        case 'provider': {
          // Combine on one string so bold tags never straddle the separator
          const providerLine = `${data.onlineProvider ?? ''} - ${data.onlineId ?? ''}`;
          payload += emitAlign(this._align('onlineProvider'));
          payload += `${this._bold('onlineProvider', providerLine)}\n`;
          break;
        }

        case 'items':
          // Always left-align items section header
          if (lastAlign !== '[LEFT]') { lastAlign = '[LEFT]'; payload += '[LEFT]\n'; }
          payload += `${data.labelItems ?? ''}\n${itemsBlock}\n`;
          break;

        case 'orderClass':
          payload += emitAlign(this._align('orderClass'));
          payload += `${this._bold('orderClass', `${data.labelOrderType ?? ''} ${data.orderClass ?? ''}`)}\n`;
          break;
      }

      if (index < sections.length - 1) {
        // Always reset to LEFT before separator so it prints full-width regardless of last section alignment
        lastAlign = '[LEFT]';
        payload += `${SEPARATOR}\n\n`;
      }
    });

    // ── Footer ──
    if (isLabel) {
      // FF (0x0C) advances to the start of the next label on label stock.
      // Never use [FULL CUT] on label media — it severs the label in two.
      payload += `\n[FORM FEED]`;
    } else {
      // Continuous receipt: feed 3 blank lines then full cut.
      payload += `\n[LEFT]\n[FEED 3]\n[FULL CUT]`;
    }

    return payload;
  }
}
