export type TemplateElementType = 'token' | 'text' | 'variable' | 'newline' | 'hr';

export interface TemplateElement {
    type: TemplateElementType;
    value?: string;
}

export type Template = Record<string, TemplateElement[]>;

export interface RenderedElement {
    renderType: 'text' | 'hr' | 'cutter';
    text?: string;
    classes?: string;
    srcKey?: string;
    srcIdx?: number;
}

export interface ElementSelection {
    key: string;
    index: number;
}

export type TemplateKind = 'label' | 'receipt';

export interface DesignerConfig {
    label: Template;
    receipt: Template;
}

const ELEMENT_TYPES: readonly TemplateElementType[] = ['token', 'text', 'variable', 'newline', 'hr'];

// Variable and newline rows are not user-editable in either the row editor or the inspector.
// Centralised here so both call sites agree.
export function isElementLocked(type: TemplateElementType): boolean {
    return type === 'variable' || type === 'newline';
}

export function isTemplate(value: unknown): value is Template {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    for (const section of Object.values(value as Record<string, unknown>)) {
        if (!Array.isArray(section)) return false;
        for (const el of section) {
            if (!el || typeof el !== 'object') return false;
            const t = (el as { type?: unknown }).type;
            if (typeof t !== 'string' || !ELEMENT_TYPES.includes(t as TemplateElementType)) return false;
            const v = (el as { value?: unknown }).value;
            if (v !== undefined && typeof v !== 'string') return false;
        }
    }
    return true;
}

export function isDesignerConfig(value: unknown): value is DesignerConfig {
    if (!value || typeof value !== 'object') return false;
    const v = value as Partial<DesignerConfig>;
    return isTemplate(v.label) && isTemplate(v.receipt);
}
