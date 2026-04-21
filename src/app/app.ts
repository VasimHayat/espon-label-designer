import { ChangeDetectionStrategy, Component, computed, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [MatIconModule, ReactiveFormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    labelSize: ['continuous'],
    id: ['7829', Validators.required],
    orderClass: ['Delivery'],
    customerName: ['John Doe'],
    customerPhone: ['(555) 123-4567'],
    itemIndex: [1],
    itemCount: [3],
    createdTime: ['14:30'],
    createdDate: ['10/12/2023'],
    items: this.fb.array([
      this.fb.group({
        itemName: ['Spicy Chicken Sandwich', Validators.required],
        modifiers: ['- No Mayo\n- Add Extra Pickles\n- Toasted Bun'],
        align: ['left'],
        isBold: [true]
      })
    ]),
    subtotal: [24.50],
    tax: [2.10],
    deliveryFee: [5.00],
    onlineProvider: ['UberEats'],
    onlineId: ['UBW-9921D'],
    formats: this.fb.group({
      id: this.fb.group({ align: ['center'], isBold: [true] }),
      customerName: this.fb.group({ align: ['center'], isBold: [false] }),
      customerPhone: this.fb.group({ align: ['center'], isBold: [false] }),
      itemIndex: this.fb.group({ align: ['left'], isBold: [false] }),
      itemCount: this.fb.group({ align: ['left'], isBold: [false] }),
      createdTime: this.fb.group({ align: ['left'], isBold: [false] }),
      createdDate: this.fb.group({ align: ['left'], isBold: [false] }),
      total: this.fb.group({ align: ['left'], isBold: [true] }),
      onlineProvider: this.fb.group({ align: ['center'], isBold: [false] }),
      onlineId: this.fb.group({ align: ['center'], isBold: [false] }),
      orderClass: this.fb.group({ align: ['center'], isBold: [false] }),
    })
  });
  
  viewRaw = signal(false);

  formData = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  labelDimensions = computed(() => {
    const size = this.formData()?.labelSize || 'continuous';
    const pxPerInch = 120; // Scale factor for previewing on screen
    
    if (size === 'continuous') {
      return { width: '380px', minHeight: '650px' };
    }
    
    const [w, h] = size.split('x').map(Number);
    return {
      width: `${w * pxPerInch}px`,
      height: `${h * pxPerInch}px`
    };
  });

  get itemsFormArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  getFormatGroup(field: string): FormGroup {
    return this.form.get(`formats.${field}`) as FormGroup;
  }

  getFormat(field: string, prop: 'align' | 'isBold'): string | boolean | undefined {
    return this.formData()?.formats?.[field]?.[prop];
  }

  setFormat(field: string, prop: 'align' | 'isBold', value: string | boolean) {
    this.form.get(`formats.${field}.${prop}`)?.setValue(value);
  }

  getAlignClass(field: string): string {
    const align = this.getFormat(field, 'align');
    return align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  }

  getBoldClass(field: string): string {
    const isBold = this.getFormat(field, 'isBold');
    return isBold ? 'font-bold' : 'font-normal';
  }

  getEscPosAlign(field: string): string {
    const align = this.getFormat(field, 'align');
    return align === 'center' ? '[CENTER]' : align === 'right' ? '[RIGHT]' : '[LEFT]';
  }

  getEscPosBoldText(field: string, text: string): string {
    const isBold = this.getFormat(field, 'isBold');
    return isBold ? `[BOLD ON]\n${text}\n[BOLD OFF]` : text;
  }

  addItem() {
    this.itemsFormArray.push(this.fb.group({
      itemName: ['', Validators.required],
      modifiers: [''],
      align: ['left'],
      isBold: [false]
    }));
  }

  copyItem(index: number) {
    const item = this.itemsFormArray.at(index).value;
    this.itemsFormArray.push(this.fb.group({
      itemName: [item.itemName, Validators.required],
      modifiers: [item.modifiers],
      align: [item.align || 'left'],
      isBold: [item.isBold !== undefined ? item.isBold : false]
    }));
  }

  removeItem(index: number) {
    if (this.itemsFormArray.length > 1) {
      this.itemsFormArray.removeAt(index);
    }
  }

  copyRawPayload() {
    navigator.clipboard.writeText(this.generateRawPayload()).then(() => {
      alert("Raw payload copied to clipboard!");
    });
  }

  calculatedTotal = computed(() => {
    const data = this.formData();
    return Number(data.subtotal || 0) + Number(data.tax || 0) + Number(data.deliveryFee || 0);
  });

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 }).format(val);
  }

  generateRawPayload(): string {
    const data = this.formData();
    const total = this.calculatedTotal();

    let itemsString = '';
    if (data.items && data.items.length) {
      data.items.forEach((item: { itemName: string, modifiers?: string, align?: string, isBold?: boolean }) => {
        let alignStr = '[LEFT]';
        if (item.align === 'center') alignStr = '[CENTER]';
        else if (item.align === 'right') alignStr = '[RIGHT]';
        
        itemsString += `\n${alignStr}\n`;
        let itemText = item.itemName;
        if (item.modifiers) {
          itemText += `\n${item.modifiers}`;
        }
        
        if (item.isBold !== false) {
          itemsString += `[BOLD ON]\n${itemText}\n[BOLD OFF]\n`;
        } else {
          itemsString += `${itemText}\n`;
        }
      });
      itemsString += '[LEFT]';
    }

    return `[INIT]
ESC @
${data.labelSize !== 'continuous' ? `\n[LABEL CONFIG]\nSIZE: ${data.labelSize} inches\n` : ''}
${this.getEscPosAlign('id')}
DOUBLE HEIGHT + DOUBLE WIDTH
${this.getEscPosBoldText('id', '#' + data.id)}

[NORMAL SIZE]
--------------------------------

${this.getEscPosAlign('customerPhone')}
${this.getEscPosBoldText('customerPhone', data.customerPhone)}
${this.getEscPosAlign('customerName')}
${this.getEscPosBoldText('customerName', data.customerName)}

--------------------------------

${this.getEscPosAlign('itemIndex')}
${this.getEscPosBoldText('itemIndex', 'Item: ' + data.itemIndex + ' of ' + data.itemCount)}
${this.getEscPosAlign('createdTime')}
${this.getEscPosBoldText('createdTime', 'Time: ' + data.createdTime)}
${this.getEscPosAlign('createdDate')}
${this.getEscPosBoldText('createdDate', 'Date: ' + data.createdDate)}

[CENTER]
Powered by Plum POS

--------------------------------

${this.getEscPosAlign('total')}
${this.getEscPosBoldText('total', 'Subtotal : $' + this.formatCurrency(data.subtotal) + '\\nTax      : $' + this.formatCurrency(data.tax) + '\\nDelv Chg : $' + this.formatCurrency(data.deliveryFee))}

--------------------------------

${this.getEscPosAlign('total')}
[BIG FONT ON]
${this.getEscPosBoldText('total', 'TOTAL: $' + this.formatCurrency(total))}
[BIG FONT OFF]

--------------------------------

${this.getEscPosAlign('onlineProvider')}
${this.getEscPosBoldText('onlineProvider', data.onlineProvider)} - ${this.getEscPosBoldText('onlineId', data.onlineId)}

--------------------------------

[LEFT]
ITEMS:${itemsString}
--------------------------------

${this.getEscPosAlign('orderClass')}
${this.getEscPosBoldText('orderClass', 'ORDER TYPE: ' + data.orderClass)}

[FEED + CUT]
ESC d 3
GS V 1`;
  }

  handlePrint() {
    console.log("Printing RAW payload:", this.generateRawPayload());
    // Since we are in an iframe setting, a standard alert works but might be blocked in some previews,
    // so let's log and alert.
    alert("Payload sent to printer! Check console for the RAW ESC/POS data.");
  }
}
