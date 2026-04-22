import { Component, computed, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';

// Epson ESC/POS constants
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;
const HT  = 0x09;

const CMD = {
  INIT:      [ESC, 0x40],
  BOLD_ON:   [ESC, 0x45, 0x01],
  BOLD_OFF:  [ESC, 0x45, 0x00],
  DBL_SIZE:  [GS,  0x21, 0x11],  // double width + double height
  NORMAL:    [GS,  0x21, 0x00],
  REV_ON:    [GS,  0x42, 0x01],  // white-on-black
  REV_OFF:   [GS,  0x42, 0x00],
  ALIGN_L:   [ESC, 0x61, 0x00],
  ALIGN_C:   [ESC, 0x61, 0x01],
  ALIGN_R:   [ESC, 0x61, 0x02],
  FEED:      [ESC, 0x64, 0x05],  // feed 5 lines before cut
  CUT:       [GS,  0x56, 0x42, 0x00],  // full cut
  // Tab stops at character positions 8, 24, 40, 56
  TAB_STOPS: [ESC, 0x44, 8, 24, 40, 56, 0x00],
};

// TM-L90 / TM-L100 label setup: set label length to 2" = 406 dots @ 203 DPI
// ESC ( L n1=4 n2=0 0x30 0x43 nL nH
const LABEL_DOTS_2IN = 406;
const CMD_LABEL_LENGTH = [
  ESC, 0x28, 0x4C, 0x04, 0x00, 0x30, 0x43,
  LABEL_DOTS_2IN & 0xFF, (LABEL_DOTS_2IN >> 8) & 0xFF,
];

// 4" paper @ 203 DPI, Font A (12 dots/char) = ~64 usable chars/line (with margins)
const CHARS_PER_LINE = 64;

@Component({
  imports: [ReactiveFormsModule, CommonModule, MatIconModule],
  templateUrl: 'app.v3.label.designer.component.html',
  styleUrl: 'app.v3.label.designer.component.scss'
})
export class AppV3LabelDesignerComponent {
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    labelSize: ['4x2'],
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
        itemName: ['Trantrum', Validators.required],
        modifiers: ['2 Salt'],
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

  get itemsFormArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 }).format(val);
  }

  addItem() {
    this.itemsFormArray.push(this.fb.group({
      itemName: ['', Validators.required],
      modifiers: [''],
    }));
  }

  removeItem(index: number) {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
    }
  }

  // ─── ESC/POS byte generation ────────────────────────────────────────────────

  generateEscPosBytes(): Uint8Array {
    const data = this.formData();
    const total = this.calculatedTotal();
    const bytes: number[] = [];

    const p = (...b: number[]) => bytes.push(...b);
    const t = (s: string) => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xFF); };
    const nl = () => bytes.push(LF);
    const sep = () => { t('-'.repeat(CHARS_PER_LINE)); nl(); };
    const fc = (v: number) => `$${this.formatCurrency(v)}`;
    const pad = (s: string, w: number) => String(s).padEnd(w).substring(0, w);
    const rpad = (s: string, w: number) => String(s).padStart(w).substring(0, w);

    // Initialize printer
    p(...CMD.INIT);

    // Set label length for TM-L90/L100 (2" = 406 dots)
    p(...CMD_LABEL_LENGTH);

    // Set tab stops
    p(...CMD.TAB_STOPS);

    // ── ROW 1: HEADER ──────────────────────────────────────────────────
    // Order ID (double size + bold)
    p(...CMD.DBL_SIZE, ...CMD.BOLD_ON);
    t(`#${data.id}`);
    p(...CMD.NORMAL, ...CMD.BOLD_OFF);
    p(HT);  // tab → phone column

    // Phone number
    t(pad(String(data.customerPhone), 16));
    p(HT);  // tab → customer name column

    // Customer name (bold)
    p(...CMD.BOLD_ON);
    t(String(data.customerName));
    p(...CMD.BOLD_OFF);
    nl();
    sep();

    // ── ROW 2: METRICS ─────────────────────────────────────────────────
    t(pad(`${data.itemIndex}/${data.itemCount}`, 8));
    p(HT);
    t(pad(String(data.createdTime), 16));
    p(HT);
    t(pad(String(data.createdDate), 8));
    p(HT);
    p(...CMD.ALIGN_C);
    t(String(data.branding));
    p(...CMD.ALIGN_L);
    nl();
    sep();

    // ── ROW 3: FINANCIALS ──────────────────────────────────────────────
    const finLabel = 18;
    const finVal   = 10;

    t(pad(String(data.labelSubtotal), finLabel));
    t(rpad(fc(Number(data.subtotal)), finVal));
    nl();

    t(pad(String(data.labelTax), finLabel));
    t(rpad(fc(Number(data.tax)), finVal));
    nl();

    t(pad(String(data.labelDelivery), finLabel));
    t(rpad(fc(Number(data.deliveryFee)), finVal));
    nl();

    // Total — white-on-black, double size, centered
    p(...CMD.ALIGN_C, ...CMD.REV_ON, ...CMD.BOLD_ON, ...CMD.DBL_SIZE);
    t(` TOTAL: ${fc(total)} `);
    p(...CMD.NORMAL, ...CMD.BOLD_OFF, ...CMD.REV_OFF, ...CMD.ALIGN_L);
    nl();

    // ── PROVIDER / ONLINE ID ───────────────────────────────────────────
    sep();
    p(...CMD.ALIGN_C);
    p(...CMD.BOLD_ON);
    t(String(data.onlineProvider));
    p(...CMD.BOLD_OFF);
    nl();
    t(`ID: ${data.onlineId}`);
    nl();
    p(...CMD.ALIGN_L);

    // ── ITEMS ─────────────────────────────────────────────────────────
    sep();
    const items: { itemName: string; modifiers?: string }[] = data.items || [];
    items.forEach((item) => {
      p(...CMD.BOLD_ON);
      t(`> ${item.itemName}`);
      p(...CMD.BOLD_OFF);
      nl();
      if (item.modifiers) {
        t(`  ${item.modifiers}`);
        nl();
      }
    });

    // ── RESTAURANT NAME (white-on-black banner) ───────────────────────
    sep();
    p(...CMD.ALIGN_C, ...CMD.REV_ON, ...CMD.BOLD_ON);
    t(` ${data.restaurantName} `);
    p(...CMD.BOLD_OFF, ...CMD.REV_OFF, ...CMD.ALIGN_L);
    nl();

    // Feed and cut
    p(...CMD.FEED, ...CMD.CUT);

    return new Uint8Array(bytes);
  }

  generateHexDump(): string {
    const bytes = this.generateEscPosBytes();
    const lines: string[] = [
      `; Epson ESC/POS — 4"×2" Label (203 DPI) — ${bytes.length} bytes`,
      `; Printer: TM-L90 / TM-L100 / TM-C compatible`,
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

  generateReadablePayload(): string {
    const data = this.formData();
    const total = this.calculatedTotal();
    const fc = (v: number) => `$${this.formatCurrency(v)}`;
    const sep = '-'.repeat(CHARS_PER_LINE);

    const lines = [
      `; ── Epson ESC/POS Readable Payload ──────────────────────────────────`,
      `; Label: 4"×2" Landscape | 203 DPI | TM-L90 / TM-L100 / TM-C series`,
      `; Generated: ${new Date().toISOString()}`,
      '',
      'ESC @                              ; Initialize',
      'ESC ( L [label length = 406 dots]  ; Set label length to 2" @ 203 DPI',
      'ESC D [8 24 40 56 0]               ; Set tab stops',
      '',
      '; ── ROW 1: HEADER ──────────────────────────────────────────────────',
      'GS ! 0x11                          ; Double width + double height',
      'ESC E 1                            ; Bold ON',
      `#${data.id}`,
      'GS ! 0x00 | ESC E 0                ; Normal size, Bold OFF',
      `HT | ${data.customerPhone}`,
      `HT | ESC E 1 | ${data.customerName} | ESC E 0 | LF`,
      `; ${sep}`,
      '',
      '; ── ROW 2: METRICS ─────────────────────────────────────────────────',
      `${data.itemIndex}/${data.itemCount}  HT  ${data.createdTime}  HT  ${data.createdDate}  HT  ESC a 1  ${data.branding}  ESC a 0  LF`,
      `; ${sep}`,
      '',
      '; ── ROW 3: FINANCIALS ──────────────────────────────────────────────',
      `${String(data.labelSubtotal).padEnd(18)}${fc(Number(data.subtotal)).padStart(10)}  LF`,
      `${String(data.labelTax).padEnd(18)}${fc(Number(data.tax)).padStart(10)}  LF`,
      `${String(data.labelDelivery).padEnd(18)}${fc(Number(data.deliveryFee)).padStart(10)}  LF`,
      '',
      'ESC a 1 | GS B 1 | ESC E 1 | GS ! 0x11  ; Center + Reverse + Bold + ×2',
      ` TOTAL: ${fc(total)} `,
      'GS ! 0x00 | ESC E 0 | GS B 0 | ESC a 0',
      '',
      `; ${sep}`,
      '; ── PROVIDER ───────────────────────────────────────────────────────',
      `ESC a 1 | ESC E 1 | ${data.onlineProvider} | ESC E 0 | LF`,
      `ID: ${data.onlineId}  LF`,
      'ESC a 0',
      `; ${sep}`,
      '',
      '; ── ITEMS ──────────────────────────────────────────────────────────',
      ...(data.items || []).flatMap((item: { itemName: string; modifiers?: string }) => [
        `ESC E 1 | > ${item.itemName} | ESC E 0 | LF`,
        ...(item.modifiers ? [`  ${item.modifiers}  LF`] : []),
      ]),
      `; ${sep}`,
      '',
      '; ── RESTAURANT NAME ─────────────────────────────────────────────────',
      `ESC a 1 | GS B 1 | ESC E 1 | ${data.restaurantName} | ESC E 0 | GS B 0 | ESC a 0 | LF`,
      '',
      '; ── CUT ─────────────────────────────────────────────────────────────',
      'ESC d 5                            ; Feed 5 lines',
      'GS V 66 0                          ; Full cut',
    ];

    return lines.join('\n');
  }

  copyPayload() {
    const mode = this.viewMode();
    const text = mode === 'hex' ? this.generateHexDump() : this.generateReadablePayload();
    navigator.clipboard.writeText(text).then(() => {
      alert(`${mode === 'hex' ? 'Hex dump' : 'Readable payload'} copied to clipboard!`);
    });
  }

  handlePrint() {
    const bytes = this.generateEscPosBytes();
    console.log(`[Epson ESC/POS] ${bytes.length} bytes ready for TM-L90/L100`);
    console.log('[Hex]', Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
    alert(`${bytes.length} ESC/POS bytes generated — see console.\nConnect via WebUSB or print server to send to printer.`);
  }
}
