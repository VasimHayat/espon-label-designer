export interface TemplateElement {
    type: string;
    value?: string;
}

export type Template = Record<string, TemplateElement[]>;

export interface RenderedElement {
    renderType: 'text' | 'newline' | 'hr' | 'cutter';
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
