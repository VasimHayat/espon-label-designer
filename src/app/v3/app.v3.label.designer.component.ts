import { Component, computed, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';

// ─── ESC/POS byte constants ────────────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;
const HT  = 0x09;   // Horizontal Tab

// ─── Epson standard-mode label constants (203 DPI) ────────────────────────
//
//  Physical label: 4" × 2" = 812 × 406 dots
//  Font A: 12 dots wide × 24 dots tall → 67 chars/line (use 64 with margins)
//
//  Dot budget (20-dot compact line spacing):
//    Header   (double-height, 48 dots)  →  48
//    Sep  ══  (20 dots)                 →  20
//    Metrics  (20 dots)                 →  20
//    Sep  ──  (20 dots)                 →  20
//    Financials (20 dots)               →  20
//    Sep  ──  (20 dots)                 →  20
//    TOTAL    (double-size, 48 dots)    →  48
//    Sep  ──  (20 dots)                 →  20
//    Provider + Online ID (20 dots)     →  20
//    Item name (20 dots each)           →  20
//    Modifier lines (20 dots each)      →  20
//    Sep  ──  (20 dots)                 →  20
//    Restaurant (double-height, 48 dots)→  48
//  ──────────────────────────────────────────
//    Base total (1 item, 1 modifier):   → 324 / 406 dots used ✓
//
const COLS = 64;  // safe chars per line on 4" paper (Font A, 203 DPI)

@Component({
  imports: [ReactiveFormsModule, CommonModule, MatIconModule],
  templateUrl: 'app.v3.label.designer.component.html',
  styleUrl: 'app.v3.label.designer.component.scss'
})
export class AppV3LabelDesignerComponent {
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    id: ['104'],
    orderClass: ['Delivery'],
    customerName: ['John Smith'],
    customerPhone: ['(734) 555-1212'],
    itemIndex: [1],
    itemCount: [2],
    createdTime: ['11:30 AM'],
    createdDate: ['09/25'],
    items: this.fb.array([
      this.fb.group({
        itemName: ['Spicy Chicken Sandwich', Validators.required],
        modifiers: [ 'No pickles\nExtra spicy\nCut in half'],
      })
    ]),
    subtotal: [10.99],
    tax: [0.48],
    deliveryFee: [1.00],
    onlineProvider: ['Olo DoorDash'],
    onlineId: ['12345678'],
    branding: ['Powered by Plum POS'],
    restaurantName: ['The Cube'],
    labelSubtotal: ['Subtotal :'],
    labelTax: ['Tax      :'],
    labelDelivery: ['Delv Chg :'],
  });

  viewMode = signal<'preview' | 'readable' | 'hex'>('preview');

  formData = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  calculatedTotal = computed(() => {
    const d = this.formData();
    return Number(d.subtotal || 0) + Number(d.tax || 0) + Number(d.deliveryFee || 0);
  });

  escPosBytes = computed(() => this.generateEscPosBytes());

  get itemsFormArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 }).format(val);
  }

  addItem() {
    this.itemsFormArray.push(this.fb.group({ itemName: ['', Validators.required], modifiers: [''] }));
  }

  removeItem(index: number) {
    if (this.itemsFormArray.length > 1) this.itemsFormArray.removeAt(index);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private fc(v: number): string {
    return `$${this.formatCurrency(v)}`;
  }

  /** Left string + right string separated to fill exactly COLS characters. */
  private lr(left: string, right: string, cols = COLS): string {
    const gap = cols - left.length - right.length;
    return left + (gap > 0 ? ' '.repeat(gap) : ' ') + right;
  }

  /** Split a string into COLS-wide chunks. */
  private wrap(s: string, cols = COLS): string[] {
    const lines: string[] = [];
    for (let i = 0; i < s.length; i += cols) lines.push(s.substring(i, i + cols));
    return lines.length ? lines : [''];
  }

  // ─── Standard ESC/POS generator ───────────────────────────────────────────
  //
  //  No Page Mode. Portrait line-by-line. All sections fit on 4"×2" die-cut.
  //
  generateEscPosBytes(): Uint8Array {
    const d     = this.formData();
    const total = this.calculatedTotal();
    const bytes: number[] = [];

    const p  = (...b: number[]) => bytes.push(...b);
    const t  = (s: string)      => { for (const c of s) bytes.push(c.charCodeAt(0) & 0xFF); };
    const nl = ()               => bytes.push(LF);
    const sep = (ch = '-')      => { t(ch.repeat(COLS)); nl(); };

    const bold     = (on: boolean) => p(ESC, 0x45, on ? 1 : 0);
    const dblSize  = (w: boolean, h: boolean) =>
      p(GS, 0x21, (w ? 0x10 : 0x00) | (h ? 0x01 : 0x00));
    const reverse  = (on: boolean) => p(GS, 0x42, on ? 1 : 0);
    const align    = (a: 0|1|2)   => p(ESC, 0x61, a);    // 0=L 1=C 2=R
    const spacing  = (dots: number) => p(ESC, 0x33, dots);
    const tabStops = (...cols: number[]) => p(ESC, 0x44, ...cols, 0x00);

    // ── Init ────────────────────────────────────────────────────────────────
    p(ESC, 0x40);  // ESC @ initialize

    // Set label length: 2" = 406 dots at 203 DPI (TM-L90/L100/TM-C)
    // ESC ( L  n1=4 n2=0  0x30 0x43  nL nH
    p(ESC, 0x28, 0x4C, 0x04, 0x00, 0x30, 0x43, 406 & 0xFF, (406 >> 8) & 0xFF);

    // ── SECTION 1: HEADER ───────────────────────────────────────────────────
    //  #ID..  │  PHONE  │  CUSTOMER NAME
    //  Double-height bold — 48 dots tall
    spacing(48);
    dblSize(false, true);  // GS ! 0x01: single-width, double-height
    bold(true);

    // Tab stops: ID field ends at col 9, phone ends at col 26
    tabStops(9, 26);

    const idTrunc = String(d.id).substring(0, 4) + '..';
    t(`#${idTrunc}`);
    p(HT);
    t(String(d.customerPhone));
    p(HT);
    t(String(d.customerName));

    bold(false);
    dblSize(false, false);
    nl();

    // ── SECTION 2: METRICS ──────────────────────────────────────────────────
    //  1 of 2  │  11:30 AM  │  09/25  │  Powered by Plum POS
    spacing(20);
    sep('=');

    tabStops(9, 20, 27);
    bold(true);
    t(`${d.itemIndex} of ${d.itemCount}`);
    p(HT);
    t(String(d.createdTime));
    p(HT);
    t(String(d.createdDate));
    p(HT);
    bold(false);
    t(String(d.branding).substring(0, COLS - 27));
    nl();
    sep();

    // ── SECTION 3: FINANCIALS ───────────────────────────────────────────────
    //  Three financial rows — label left-aligned, value right-aligned per field
    //  Each field: 21 chars wide (3 equal columns in 64-char line)
    const finW = Math.floor(COLS / 3);  // 21 chars each

    const finField = (label: string, val: string, width: number): string => {
      const l = String(label).padEnd(width - val.length - 1).substring(0, width - val.length - 1);
      return (l + ' ' + val).substring(0, width);
    };

    t(finField(d.labelSubtotal,  this.fc(Number(d.subtotal)),     finW));
    t(finField(d.labelTax,       this.fc(Number(d.tax)),          finW));
    t(finField(d.labelDelivery,  this.fc(Number(d.deliveryFee)),  finW));
    nl();
    sep();

    // ── SECTION 4: TOTAL ────────────────────────────────────────────────────
    //  Double-width + double-height, centered, white-on-black
    //  GS ! 0x11 = width×2 height×2 → 33 chars/line at double-width
    spacing(48);
    dblSize(true, true);
    align(1);
    reverse(true);
    bold(true);
    t(` TOTAL: ${this.fc(total)} `);
    bold(false);
    reverse(false);
    align(0);
    dblSize(false, false);
    nl();

    // ── SECTION 5: PROVIDER + ONLINE ID ─────────────────────────────────────
    spacing(20);
    sep();
    bold(true);
    t(this.lr(String(d.onlineProvider), `ID: ${d.onlineId}`));
    bold(false);
    nl();
    sep();

    // ── SECTION 6: ITEMS ────────────────────────────────────────────────────
    const items: { itemName: string; modifiers?: string }[] = d.items || [];
    items.forEach((item, idx) => {
      if (idx > 0) sep();
      bold(true);
      t(`> ${String(item.itemName).substring(0, COLS - 2)}`);
      bold(false);
      nl();
      if (item.modifiers) {
        String(item.modifiers).split('\n').filter(m => m.trim()).forEach(mod => {
          // Indent modifier lines; wrap if too long
          const line = `  ${mod.trim()}`;
          this.wrap(line, COLS).forEach(chunk => { t(chunk); nl(); });
        });
      }
    });
    sep();

    // ── SECTION 7: RESTAURANT NAME ──────────────────────────────────────────
    //  Double-height, centered, white-on-black banner
    spacing(48);
    dblSize(false, true);
    align(1);
    reverse(true);
    bold(true);
    t(` ${String(d.restaurantName).toUpperCase()} `);
    bold(false);
    reverse(false);
    align(0);
    dblSize(false, false);
    nl();

    // ── FEED + CUT ──────────────────────────────────────────────────────────
    spacing(20);          // reset to compact before feed
    p(ESC, 0x64, 0x03);  // ESC d 3 — feed 3 lines
    p(GS, 0x56, 0x42, 0x00);  // GS V 66 0 — full cut

    return new Uint8Array(bytes);
  }

  // ─── Hex dump (16 bytes/row + ASCII sidebar) ─────────────────────────────
  generateHexDump(): string {
    const bytes = this.escPosBytes();
    const lines: string[] = [
      `; Standard ESC/POS — Epson 4"×2" Label — ${bytes.length} bytes`,
      `; TM-L90 / TM-L100 / TM-C — Portrait, Line-by-Line`,
      `; Dot budget: Header(48) + 9×Normal(20) + Total(48) + Restaurant(48) = 324/406 dots`,
      '',
    ];
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = Array.from(bytes.slice(i, i + 16));
      const hex   = chunk.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      const ascii = chunk.map(b => (b >= 0x20 && b <= 0x7E) ? String.fromCharCode(b) : '.').join('');
      lines.push(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48)}  |${ascii}|`);
    }
    return lines.join('\n');
  }

  // ─── Human-readable annotated commands ───────────────────────────────────
  generateReadablePayload(): string {
    const d     = this.formData();
    const total = this.calculatedTotal();
    const fc    = (v: number) => this.fc(v);
    const S     = '='.repeat(COLS);
    const s     = '-'.repeat(COLS);
    const finW  = Math.floor(COLS / 3);

    const finField = (label: string, val: string, w: number) => {
      const l = String(label).padEnd(w - val.length - 1).substring(0, w - val.length - 1);
      return (l + ' ' + val).substring(0, w);
    };

    const items: { itemName: string; modifiers?: string }[] = d.items || [];
    const itemLines: string[] = [];
    items.forEach((item, idx) => {
      if (idx > 0) itemLines.push(s);
      itemLines.push(`> ${item.itemName}`);
      if (item.modifiers) {
        String(item.modifiers).split('\n').filter(m => m.trim()).forEach(m => itemLines.push(`  ${m.trim()}`));
      }
    });

    return [
      '; ── Standard ESC/POS — Epson 4"×2" Label ────────────────────────────',
      '; Mode: Portrait, line-by-line (no Page Mode)',
      '; Font: A (12×24 dots), 67 chars/line, margins → 64 safe chars',
      '; Line spacing: ESC 3 20 (20 dots) normal, ESC 3 48 for double-height',
      '',
      'ESC @                        ; Initialize',
      'ESC ( L ... 406 dots         ; Set label length = 2" @ 203 DPI',
      '',
      '; ── SECTION 1: HEADER ────── ESC 3 48 · GS ! 0x01 · ESC E 1 ─────────',
      `#${String(d.id).substring(0,4)}..`.padEnd(9) + String(d.customerPhone).padEnd(17) + d.customerName,
      '; GS ! 0x00 · ESC E 0',
      '',
      '; ── SECTION 2: METRICS ───── ESC 3 20 ──────────────────────────────',
      S,
      `${String(d.itemIndex)+' of '+String(d.itemCount)}`.padEnd(9) +
        String(d.createdTime).padEnd(11) +
        String(d.createdDate).padEnd(7) +
        String(d.branding).substring(0, COLS - 27),
      s,
      '',
      '; ── SECTION 3: FINANCIALS ───────────────────────────────────────────',
      finField(d.labelSubtotal, fc(Number(d.subtotal)), finW) +
      finField(d.labelTax,      fc(Number(d.tax)),      finW) +
      finField(d.labelDelivery, fc(Number(d.deliveryFee)), finW),
      s,
      '',
      '; ── SECTION 4: TOTAL ──── ESC 3 48 · GS ! 0x11 · ESC a 1 · GS B 1 ─',
      this.lr('', ` TOTAL: ${fc(total)} `, COLS).trim(),
      '; GS B 0 · GS ! 0x00 · ESC a 0',
      '',
      '; ── SECTION 5: PROVIDER + ID ─── ESC 3 20 ──────────────────────────',
      s,
      this.lr(String(d.onlineProvider), `ID: ${d.onlineId}`),
      s,
      '',
      '; ── SECTION 6: ITEMS ────────────────────────────────────────────────',
      ...itemLines,
      s,
      '',
      '; ── SECTION 7: RESTAURANT ─── ESC 3 48 · GS ! 0x01 · ESC a 1 · GS B 1',
      ` ${String(d.restaurantName).toUpperCase()} `.padStart(Math.floor((COLS + String(d.restaurantName).length + 2) / 2)),
      '; GS B 0 · GS ! 0x00 · ESC a 0',
      '',
      '; ── CUT ──────────────────────────────────────────────────────────────',
      'ESC d 3   ; Feed 3 lines',
      'GS V 66 0 ; Full cut',
    ].join('\n');
  }

  copyPayload() {
    const mode = this.viewMode();
    const text = mode === 'hex' ? this.generateHexDump() : this.generateReadablePayload();
    navigator.clipboard.writeText(text).then(() =>
      alert(`${mode === 'hex' ? 'Hex dump' : 'ESC/POS commands'} copied!`)
    );
  }

  handlePrint() {
    const bytes = this.escPosBytes();
    console.log(`[Standard ESC/POS] ${bytes.length} bytes — Epson TM-L90/L100`);
    console.log('[Hex]', Array.from(bytes).map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' '));
    alert(`${bytes.length} bytes ready.\nMode: Standard ESC/POS (portrait, line-by-line).\nSee console — send via WebUSB or HTTP print server.`);
  }
}
