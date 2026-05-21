export interface TemplateElement {
    type: string;
    value?: string;
}

export type Template = Record<string, TemplateElement[]>;

export interface RenderedElement {
    renderType: 'text' | 'newline' | 'hr' | 'cutter';
    text?: string;
    classes?: string;
}
