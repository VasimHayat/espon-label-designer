import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    OnDestroy,
    OnInit,
    PLATFORM_ID,
    ViewChild,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

type SliderMode = 'H' | 'S' | 'V' | 'R' | 'G' | 'B';

interface HSV { h: number; s: number; v: number; }     // h 0-360, s/v 0-100
interface RGB { r: number; g: number; b: number; }     // 0-255

const DEFAULT_COLOR = '#000000';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hsvToRgb({ h, s, v }: HSV): RGB {
    const sn = s / 100, vn = v / 100;
    const c = vn * sn;
    const hh = (h % 360 + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hh < 1)      { r = c; g = x; }
    else if (hh < 2) { r = x; g = c; }
    else if (hh < 3) { g = c; b = x; }
    else if (hh < 4) { g = x; b = c; }
    else if (hh < 5) { r = x; b = c; }
    else             { r = c; b = x; }
    const m = vn - c;
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
    };
}

function rgbToHsv({ r, g, b }: RGB): HSV {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === rn)      h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else                 h = (rn - gn) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return { h, s, v };
}

function rgbToHex({ r, g, b }: RGB): string {
    const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return h(r) + h(g) + h(b);
}

function hexToRgb(hex: string): RGB | null {
    if (typeof hex !== 'string') return null;
    let s = hex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return {
        r: parseInt(s.slice(0, 2), 16),
        g: parseInt(s.slice(2, 4), 16),
        b: parseInt(s.slice(4, 6), 16),
    };
}

@Component({
    selector: 'ag-color-picker',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ag.color.picker.component.html',
    styleUrls: ['./ag.color.picker.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgColorPickerComponent implements OnInit, AfterViewInit, OnDestroy {

    // --- Inputs ---
    readonly initialColor = input<string>(DEFAULT_COLOR);
    readonly triggerSize  = input<number>(32);
    readonly triggerTitle = input<string>('Pick a colour');
    readonly disabled     = input<boolean>(false);

    // --- Outputs ---
    readonly colorChange = output<string>();   // live edits while open
    readonly accepted    = output<string>();   // user committed (OK / outside click)
    readonly cancelled   = output<void>();     // user cancelled (Cancel / Esc)
    readonly openChange  = output<boolean>();  // popover opened/closed

    // --- View refs (decorator form for Angular 18 stable API) ---
    @ViewChild('svCanvas')     private svCanvas?:     ElementRef<HTMLCanvasElement>;
    @ViewChild('sliderCanvas') private sliderCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild('popover')      private popover?:      ElementRef<HTMLElement>;

    private readonly host       = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly isBrowser  = isPlatformBrowser(this.platformId);

    // Unique radio group name so multiple pickers on the same page do not collide.
    private static _instanceSeq = 0;
    protected readonly radioGroupName = `ag-cp-mode-${++AgColorPickerComponent._instanceSeq}`;

    // --- State ---
    protected readonly mode   = signal<SliderMode>('H');
    protected readonly hsv    = signal<HSV>({ h: 0, s: 0, v: 0 });
    protected readonly isOpen = signal<boolean>(false);
    /** The "current" / committed color, preserved across edits until OK. Stored without leading '#'. */
    protected readonly originalHex = signal<string>(rgbToHex({ r: 0, g: 0, b: 0 }));

    /** Computed popover placement, set after the popover is mounted and measured. */
    protected readonly popoverPlacement = signal<{
        above: boolean;
        alignRight: boolean;
        ready: boolean;
    }>({ above: false, alignRight: false, ready: false });

    // --- Derived ---
    protected readonly rgb = computed<RGB>(() => hsvToRgb(this.hsv()));
    protected readonly hex = computed<string>(() => rgbToHex(this.rgb()));

    protected readonly hRound = computed(() => Math.round(this.hsv().h));
    protected readonly sRound = computed(() => Math.round(this.hsv().s));
    protected readonly vRound = computed(() => Math.round(this.hsv().v));

    protected readonly previewNewBg     = computed(() => '#' + this.hex());
    protected readonly previewCurrentBg = computed(() => '#' + this.originalHex());
    protected readonly triggerBg        = computed(() => '#' + this.originalHex());

    protected readonly svCursor = computed<{ x: number; y: number }>(() => {
        const cur = this.hsv();
        const rgb = this.rgb();
        switch (this.mode()) {
            case 'H': return { x: cur.s / 100, y: cur.v / 100 };
            case 'S': return { x: cur.h / 360, y: cur.v / 100 };
            case 'V': return { x: cur.h / 360, y: cur.s / 100 };
            case 'R': return { x: rgb.b / 255, y: rgb.g / 255 };
            case 'G': return { x: rgb.b / 255, y: rgb.r / 255 };
            case 'B': return { x: rgb.r / 255, y: rgb.g / 255 };
        }
    });

    protected readonly sliderCursor = computed<number>(() => {
        const cur = this.hsv();
        const rgb = this.rgb();
        switch (this.mode()) {
            case 'H': return 1 - cur.h / 360;
            case 'S': return 1 - cur.s / 100;
            case 'V': return 1 - cur.v / 100;
            case 'R': return 1 - rgb.r / 255;
            case 'G': return 1 - rgb.g / 255;
            case 'B': return 1 - rgb.b / 255;
        }
    });

    // --- Drag state ---
    private dragTarget: 'sv' | 'slider' | null = null;
    private readonly onPointerMoveBound = this.onPointerMove.bind(this);
    private readonly onPointerUpBound   = this.onPointerUp.bind(this);
    private rafHandle = 0;

    // --- Popover-position tracking ---
    private positionRaf = 0;
    private readonly onViewportChangeBound = this.scheduleReposition.bind(this);

    // --- Initial-emit suppression ---
    private skipInitialOpenEmit = true;

    constructor() {
        // Live re-render whenever state changes WHILE the popover is open and canvases
        // are mounted. The first render after opening is handled explicitly in open()
        // via requestAnimationFrame, since @ViewChild populates only after change detection.
        effect(() => {
            this.mode();
            this.hsv();
            if (!this.isOpen()) return;
            if (this.svCanvas && this.sliderCanvas) {
                this.renderSV(this.svCanvas.nativeElement);
                this.renderSlider(this.sliderCanvas.nativeElement);
            }
        });

        // Live colorChange emission, gated to "while open" so closed-state re-seeds
        // (parent updates [initialColor]) do not spam the consumer.
        effect(() => {
            const hexValue = this.hex();
            if (!this.isOpen()) return;
            queueMicrotask(() => this.colorChange.emit('#' + hexValue));
        });

        // openChange — skip the initial false to avoid surprising consumers on init.
        effect(() => {
            const open = this.isOpen();
            if (this.skipInitialOpenEmit) {
                this.skipInitialOpenEmit = false;
                return;
            }
            queueMicrotask(() => this.openChange.emit(open));
        });
    }

    ngOnInit(): void {
        this.seedFromInitial();
    }

    ngAfterViewInit(): void {
        // No-op: canvases are inside the @if and only mount when open.
    }

    ngOnDestroy(): void {
        this.detachDragListeners();
        this.detachViewportListeners();
        if (this.rafHandle)    cancelAnimationFrame(this.rafHandle);
        if (this.positionRaf)  cancelAnimationFrame(this.positionRaf);
    }

    private seedFromInitial(): void {
        const seed = hexToRgb(this.initialColor()) ?? hexToRgb(DEFAULT_COLOR)!;
        this.hsv.set(rgbToHsv(seed));
        this.originalHex.set(rgbToHex(seed));
    }

    // ---------- Open / close ----------

    protected toggle(): void {
        if (this.disabled()) return;
        if (this.isOpen()) this.close();
        else               this.open();
    }

    protected open(): void {
        if (this.disabled() || this.isOpen()) return;
        // Sync picker state to the committed value at the moment of opening.
        const rgb = hexToRgb(this.originalHex());
        if (rgb) this.hsv.set(rgbToHsv(rgb));
        this.popoverPlacement.set({ above: false, alignRight: false, ready: false });
        this.isOpen.set(true);
        // Render canvases and position the popover after CD has mounted the @if branch.
        if (this.isBrowser) {
            if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
            this.rafHandle = requestAnimationFrame(() => {
                this.rafHandle = 0;
                if (this.svCanvas && this.sliderCanvas) {
                    this.renderSV(this.svCanvas.nativeElement);
                    this.renderSlider(this.sliderCanvas.nativeElement);
                }
                this.positionPopover();
                this.attachViewportListeners();
            });
        }
    }

    protected close(): void {
        if (!this.isOpen()) return;
        this.isOpen.set(false);
        this.detachDragListeners();
        this.detachViewportListeners();
        this.dragTarget = null;
    }

    // ---------- Smart popover positioning ----------

    /**
     * Pick a placement that keeps the popover inside the viewport. Prefers below + left-aligned
     * with the trigger; flips above when the bottom would overflow and there is more space up,
     * and right-aligns when the popover would clip the viewport's right edge.
     */
    private positionPopover(): void {
        if (!this.isBrowser || !this.isOpen()) return;
        const popEl     = this.popover?.nativeElement;
        const triggerEl = this.host.nativeElement.querySelector('.ag-cp-trigger') as HTMLElement | null;
        if (!popEl || !triggerEl) return;

        const trigRect = triggerEl.getBoundingClientRect();
        const popRect  = popEl.getBoundingClientRect();
        const vw = window.innerWidth  || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const gap = 6;

        // Vertical: prefer below, flip up only if it actually fits better there.
        const popH       = popRect.height;
        const spaceBelow = vh - trigRect.bottom - gap;
        const spaceAbove = trigRect.top - gap;
        const above      = popH > spaceBelow && spaceAbove > spaceBelow;

        // Horizontal: prefer left-aligned with trigger; flip to right-aligned if overflow.
        const popW         = popRect.width;
        const spaceFromLeftEdge = vw - trigRect.left;
        const alignRight        = popW > spaceFromLeftEdge && trigRect.right >= popW;

        this.popoverPlacement.set({ above, alignRight, ready: true });
    }

    private scheduleReposition(): void {
        if (!this.isOpen() || !this.isBrowser) return;
        if (this.positionRaf) return;
        this.positionRaf = requestAnimationFrame(() => {
            this.positionRaf = 0;
            this.positionPopover();
        });
    }

    private attachViewportListeners(): void {
        if (!this.isBrowser) return;
        window.addEventListener('resize', this.onViewportChangeBound, { passive: true });
        // Capture phase to catch scrolls on any ancestor (page or scroll container).
        window.addEventListener('scroll', this.onViewportChangeBound, { capture: true, passive: true });
    }

    private detachViewportListeners(): void {
        if (!this.isBrowser) return;
        window.removeEventListener('resize', this.onViewportChangeBound);
        window.removeEventListener('scroll', this.onViewportChangeBound, { capture: true } as EventListenerOptions);
    }

    // ---------- Outside-click & ESC ----------

    @HostListener('document:pointerdown', ['$event'])
    protected onDocPointerDown(ev: PointerEvent): void {
        if (!this.isOpen()) return;
        const target = ev.target as Node | null;
        if (!target) return;
        const hostEl = this.host.nativeElement;
        const popEl  = this.popover?.nativeElement;
        const insideHost    = hostEl.contains(target);
        const insidePopover = popEl?.contains(target) ?? false;
        if (!insideHost && !insidePopover) {
            // Outside-click commits (industry convention; live preview already shown).
            this.confirm();
        }
    }

    @HostListener('document:keydown.escape')
    protected onEscape(): void {
        if (this.isOpen()) this.cancel();
    }

    // ---------- Rendering ----------

    private renderSV(canvas: HTMLCanvasElement): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width, h = canvas.height;
        const img = ctx.createImageData(w, h);
        const data = img.data;
        const mode = this.mode();
        const cur = this.hsv();
        const curRgb = this.rgb();

        for (let y = 0; y < h; y++) {
            const v = 1 - y / (h - 1);
            for (let x = 0; x < w; x++) {
                const u = x / (w - 1);
                let r = 0, g = 0, b = 0;
                switch (mode) {
                    case 'H': { const o = hsvToRgb({ h: cur.h, s: u * 100, v: v * 100 }); r = o.r; g = o.g; b = o.b; break; }
                    case 'S': { const o = hsvToRgb({ h: u * 360, s: cur.s, v: v * 100 }); r = o.r; g = o.g; b = o.b; break; }
                    case 'V': { const o = hsvToRgb({ h: u * 360, s: v * 100, v: cur.v }); r = o.r; g = o.g; b = o.b; break; }
                    case 'R': { r = curRgb.r; g = Math.round(v * 255); b = Math.round(u * 255); break; }
                    case 'G': { g = curRgb.g; r = Math.round(v * 255); b = Math.round(u * 255); break; }
                    case 'B': { b = curRgb.b; r = Math.round(u * 255); g = Math.round(v * 255); break; }
                }
                const i = (y * w + x) * 4;
                data[i]     = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    private renderSlider(canvas: HTMLCanvasElement): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width, h = canvas.height;
        const img = ctx.createImageData(w, h);
        const data = img.data;
        const mode = this.mode();
        const cur = this.hsv();
        const curRgb = this.rgb();

        for (let y = 0; y < h; y++) {
            const t = 1 - y / (h - 1);
            let r = 0, g = 0, b = 0;
            switch (mode) {
                case 'H': { const o = hsvToRgb({ h: t * 360, s: 100, v: 100 }); r = o.r; g = o.g; b = o.b; break; }
                case 'S': { const o = hsvToRgb({ h: cur.h, s: t * 100, v: cur.v || 100 }); r = o.r; g = o.g; b = o.b; break; }
                case 'V': { const o = hsvToRgb({ h: cur.h, s: cur.s, v: t * 100 }); r = o.r; g = o.g; b = o.b; break; }
                case 'R': { r = Math.round(t * 255); g = curRgb.g; b = curRgb.b; break; }
                case 'G': { g = Math.round(t * 255); r = curRgb.r; b = curRgb.b; break; }
                case 'B': { b = Math.round(t * 255); r = curRgb.r; g = curRgb.g; break; }
            }
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                data[i]     = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    // ---------- Pointer interactions ----------

    protected onSvPointerDown(ev: PointerEvent): void {
        if (ev.button !== 0) return;
        ev.preventDefault();
        try { (ev.target as Element).setPointerCapture(ev.pointerId); } catch { /* ignore */ }
        this.dragTarget = 'sv';
        this.attachDragListeners();
        this.applySvPointer(ev);
    }

    protected onSliderPointerDown(ev: PointerEvent): void {
        if (ev.button !== 0) return;
        ev.preventDefault();
        try { (ev.target as Element).setPointerCapture(ev.pointerId); } catch { /* ignore */ }
        this.dragTarget = 'slider';
        this.attachDragListeners();
        this.applySliderPointer(ev);
    }

    private onPointerMove(ev: PointerEvent): void {
        if (this.dragTarget === 'sv')          this.applySvPointer(ev);
        else if (this.dragTarget === 'slider') this.applySliderPointer(ev);
    }

    private onPointerUp(_ev: PointerEvent): void {
        this.dragTarget = null;
        this.detachDragListeners();
    }

    private attachDragListeners(): void {
        if (!this.isBrowser) return;
        window.addEventListener('pointermove',   this.onPointerMoveBound);
        window.addEventListener('pointerup',     this.onPointerUpBound);
        window.addEventListener('pointercancel', this.onPointerUpBound);
    }

    private detachDragListeners(): void {
        if (!this.isBrowser) return;
        window.removeEventListener('pointermove',   this.onPointerMoveBound);
        window.removeEventListener('pointerup',     this.onPointerUpBound);
        window.removeEventListener('pointercancel', this.onPointerUpBound);
    }

    private applySvPointer(ev: PointerEvent): void {
        if (!this.svCanvas) return;
        const rect = this.svCanvas.nativeElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const u = clamp((ev.clientX - rect.left) / rect.width,  0, 1);
        const v = clamp(1 - (ev.clientY - rect.top)  / rect.height, 0, 1);
        this.applySv(u, v);
    }

    private applySliderPointer(ev: PointerEvent): void {
        if (!this.sliderCanvas) return;
        const rect = this.sliderCanvas.nativeElement.getBoundingClientRect();
        if (rect.height === 0) return;
        const t = clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1);
        this.applySlider(t);
    }

    private applySv(u: number, v: number): void {
        const cur = this.hsv();
        const rgb = this.rgb();
        switch (this.mode()) {
            case 'H': this.hsv.set({ h: cur.h, s: u * 100, v: v * 100 }); break;
            case 'S': this.hsv.set({ h: u * 360, s: cur.s, v: v * 100 }); break;
            case 'V': this.hsv.set({ h: u * 360, s: v * 100, v: cur.v }); break;
            case 'R': this.setFromRgb({ r: rgb.r, g: Math.round(v * 255), b: Math.round(u * 255) }); break;
            case 'G': this.setFromRgb({ r: Math.round(v * 255), g: rgb.g, b: Math.round(u * 255) }); break;
            case 'B': this.setFromRgb({ r: Math.round(u * 255), g: Math.round(v * 255), b: rgb.b }); break;
        }
    }

    private applySlider(t: number): void {
        const cur = this.hsv();
        const rgb = this.rgb();
        switch (this.mode()) {
            case 'H': this.hsv.set({ ...cur, h: t * 360 }); break;
            case 'S': this.hsv.set({ ...cur, s: t * 100 }); break;
            case 'V': this.hsv.set({ ...cur, v: t * 100 }); break;
            case 'R': this.setFromRgb({ ...rgb, r: Math.round(t * 255) }); break;
            case 'G': this.setFromRgb({ ...rgb, g: Math.round(t * 255) }); break;
            case 'B': this.setFromRgb({ ...rgb, b: Math.round(t * 255) }); break;
        }
    }

    private setFromRgb(rgb: RGB): void {
        const next = rgbToHsv(rgb);
        const cur = this.hsv();
        // Preserve hue when chroma collapses, so the hue UI does not jump to 0.
        if (next.s === 0) next.h = cur.h;
        if (next.v === 0) next.h = cur.h;
        this.hsv.set(next);
    }

    // ---------- Numeric input handlers ----------

    protected onHInput(value: string | number): void {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.hsv.set({ ...this.hsv(), h: clamp(n, 0, 360) });
    }
    protected onSInput(value: string | number): void {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.hsv.set({ ...this.hsv(), s: clamp(n, 0, 100) });
    }
    protected onVInput(value: string | number): void {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.hsv.set({ ...this.hsv(), v: clamp(n, 0, 100) });
    }
    protected onRInput(value: string | number): void {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.setFromRgb({ ...this.rgb(), r: clamp(Math.round(n), 0, 255) });
    }
    protected onGInput(value: string | number): void {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.setFromRgb({ ...this.rgb(), g: clamp(Math.round(n), 0, 255) });
    }
    protected onBInput(value: string | number): void {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.setFromRgb({ ...this.rgb(), b: clamp(Math.round(n), 0, 255) });
    }
    protected onHexInput(value: string): void {
        const rgb = hexToRgb(value);
        if (rgb) this.setFromRgb(rgb);
        // Invalid / partial input is intentionally ignored; the input keeps user text
        // until they reach a valid 3- or 6-digit hex.
    }

    protected setMode(mode: SliderMode): void {
        this.mode.set(mode);
    }

    // ---------- Buttons ----------

    protected confirm(): void {
        const fullHex = '#' + this.hex();
        this.originalHex.set(this.hex());
        this.accepted.emit(fullHex);
        this.close();
    }

    protected cancel(): void {
        // Order matters: close first so the in-flight hsv reset does not emit a
        // colorChange (gated on isOpen) and the consumer sees a clean cancel.
        this.close();
        this.restoreOriginal();
        this.cancelled.emit();
    }

    protected restoreOriginal(): void {
        const rgb = hexToRgb(this.originalHex());
        if (rgb) this.hsv.set(rgbToHsv(rgb));
    }
}
