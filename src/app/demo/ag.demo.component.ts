import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { AgColorPickerComponent } from "../color-picker/ag.color.picker.component";

@Component({
    selector: 'app-ag-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AgColorPickerComponent],
    template: `
        <div style="padding:24px; display:flex; flex-direction:column; gap:16px; align-items:flex-start; font-family: system-ui, sans-serif;">
            <div style="display:flex; gap:12px; align-items:center;">
                <span>Picked colour:</span>
                <span style="display:inline-block; width:32px; height:32px; border:1px solid #888;"
                      [style.background]="picked()"></span>
                <code>{{ picked() }}</code>
            </div>
            <ag-color-picker
                [initialColor]="'#831b53'"
                (colorChange)="onLive($event)"
                (accepted)="onAccept($event)"
                (cancelled)="onCancel()">
            </ag-color-picker>
            <div style="font-family: monospace; color:#555;">last event: {{ lastEvent() }}</div>
        </div>
    `,
})
export class AgDemoComponent {
    readonly picked    = signal<string>('#831b53');
    readonly lastEvent = signal<string>('—');

    onLive(hex: string)   { this.picked.set(hex); this.lastEvent.set('change ' + hex); }
    onAccept(hex: string) { this.picked.set(hex); this.lastEvent.set('accepted ' + hex); }
    onCancel()            { this.lastEvent.set('cancelled'); }
}
