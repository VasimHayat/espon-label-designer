import { Component, computed, effect, signal } from "@angular/core";
import { Template } from "./types";
import { LabelPreviewComponent } from "./preview.component";
import { defaultLabel, defaultReceipt } from "./templates";
import { INITIAL_MOCK_DATA } from "./mock-data";
import { LabelEditorComponent } from "./editor.component";

@Component({
    selector: 'app-label-designer',
    templateUrl: './app.label.designer.component.html',
    styleUrls: ['./app.label.designer.component.scss'],
    imports: [LabelPreviewComponent,LabelEditorComponent]
})
export class AppLabelDesignerComponent {
   template = signal<Template>(defaultLabel as Template);
  mockDataStr = signal<string>(JSON.stringify(INITIAL_MOCK_DATA, null, 2));
  mockDataObj = signal<Record<string, unknown>>(INITIAL_MOCK_DATA);
  
  activeTemplate = signal<'label' | 'receipt'>('label');
  activeTab = signal<'design' | 'data' | 'json'>('design');

  templateJson = computed(() => JSON.stringify(this.template(), null, 2));

  constructor() {
    effect(() => {
      try {
        const parsed = JSON.parse(this.mockDataStr());
        // Small delay or directly set
        this.mockDataObj.set(parsed);
      } catch {
        // Invalid JSON, don't update mockDataObj
      }
    }, { allowSignalWrites: true });
  }

  loadLabel() {
    this.template.set(structuredClone(defaultLabel as Template));
    this.activeTemplate.set('label');
  }

  loadReceipt() {
    this.template.set(structuredClone(defaultReceipt as Template));
    this.activeTemplate.set('receipt');
  }
  
  updateMockData(event: Event) {
    this.mockDataStr.set((event.target as HTMLTextAreaElement).value);
  }

  updateTemplateJson(event: Event) {
    try {
      const val = (event.target as HTMLTextAreaElement).value;
      const parsed = JSON.parse(val);
      this.template.set(parsed);
    } catch {
      // Invalid JSON, ignore
    }
  }

  exportJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.template(), null, 4));
    const dt = new Date().toISOString().replace(/[:.]/g, '-');
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `label-template-${dt}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
}