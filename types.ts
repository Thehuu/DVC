
export interface BaseElement {
  tag: string;
  id: string | null;
  name: string | null;
  class: string | null;
  title: string | null;
  ariaLabel: string | null;
  role?: string | null;
  disabled: boolean;
  required?: boolean;
}

export interface InputElement extends BaseElement {
  type: string;
  value: string | null;
  checked?: boolean;
  placeholder: string | null;
  readonly: boolean;
  maxlength: string | null;
  pattern: string | null;
  label: string | null;
}

export interface SelectOption {
  value: string | null;
  text: string;
  selected: boolean;
  disabled: boolean;
}

export interface SelectElement extends BaseElement {
  onchange: string | null;
  label: string | null;
  options: SelectOption[];
  optionsCount: number;
}

export interface TextareaElement extends BaseElement {
  value: string;
  placeholder: string | null;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  rows: string | null;
  cols: string | null;
  label: string | null;
}

export interface ButtonElement extends BaseElement {
  type: string | null;
  value: string | null;
  text: string | null;
  onclick: string | null;
  isLoginButton?: boolean;
  isDropdown?: boolean;
}

export interface LinkElement extends BaseElement {
  href: string | null;
  text: string | null;
  onclick: string | null;
  target: string | null;
  dataToggle: string | null;
  dataTarget: string | null;
  type: 'javascript' | 'navigation' | 'trigger';
}

export interface FormElement {
  id: string | null;
  name: string | null;
  action: string | null;
  method: string;
  enctype: string | null;
  ariaLabel: string | null;
  elementCount: {
    inputs: number;
    selects: number;
    textareas: number;
    buttons: number;
  };
}

export interface UserAnswers {
  target: 'SELF' | 'BEHALF';
  behalfRelation?: string;
  behalfName?: string;
  documentType: 'CMND' | 'CCCD';
  idNumber: string;
  agencyLevel: 'PROVINCE' | 'COMMUNE';
  deliveryMethod: 'APP' | 'DIRECT' | 'POST';
  postAddress?: string;
}

export interface WebhookStep {
  step_id: number;
  ui_type?: string;
  selector: string;
  action: string;
  value?: string | null;
  description: string;
  audio_script?: string;
}

export interface PhaseResponse {
  status: 'continue' | 'finished';
  current_phase?: string;
  require_confirmation?: boolean;
  guide_message?: string;
  actions: WebhookStep[];
}

export interface ExtractedData {
  url: string;
  inputs: InputElement[];
  selects: SelectElement[];
  textareas: TextareaElement[];
  buttons: ButtonElement[];
  links: LinkElement[];
  forms: FormElement[];
  userAnswers?: UserAnswers;
  extractedAt?: string;
}
