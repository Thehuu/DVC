
import {
  InputElement,
  SelectElement,
  TextareaElement,
  ButtonElement,
  LinkElement,
  FormElement,
  ExtractedData,
  SelectOption
} from '../types';

const getTextContent = (element: Element): string => {
  return element instanceof HTMLInputElement ? element.value : (element.textContent?.trim() || '');
};

const getAttributes = (el: Element) => {
  return {
    id: el.id || null,
    name: el.getAttribute('name') || null,
    class: el.className || null,
    title: el.getAttribute('title') || null,
    ariaLabel: el.getAttribute('aria-label') || null,
    role: el.getAttribute('role') || null,
  };
};

const findLabel = (element: HTMLElement): string | null => {
  const container = element.closest('.form-group, .select-linhvuc, .select-custom, .form-item, .field, .ant-form-item, .row');
  if (container) {
    const labelText = container.querySelector('.label-text, label, .title-input, b, .ant-form-item-label, .control-label');
    if (labelText && labelText !== element) return labelText.textContent?.replace(/\*/g, '').trim() || null;
  }

  const prev = element.previousElementSibling;
  if (prev && (prev.tagName === 'LABEL' || prev.classList.contains('label-text'))) {
     return prev.textContent?.trim() || null;
  }

  if (element.id) {
    const forLabel = document.querySelector(`label[for="${element.id}"]`);
    if (forLabel) return forLabel.textContent?.trim() || null;
  }

  const wrappingLabel = element.closest('label');
  if (wrappingLabel) return wrappingLabel.textContent?.trim() || null;

  return element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('title') || null;
};

const isLoginElement = (element: Element, textContent: string | null): boolean => {
    const loginKeywords = /login|auth|sign.?in|đăng.?nhập|dang.?nhap|vneid|vconnect|vnconnect/i;
    const attrString = (
        (element.getAttribute('onclick') || '') + 
        (element.id || '') + 
        (element.className || '') + 
        (element.getAttribute('href') || '')
    ).toLowerCase();

    return loginKeywords.test(attrString) || loginKeywords.test((textContent || '').toLowerCase());
};

export const scanDocument = (): ExtractedData => {
  const inputs: InputElement[] = [];
  const selects: SelectElement[] = [];
  const textareas: TextareaElement[] = [];
  const buttons: ButtonElement[] = [];
  const links: LinkElement[] = [];
  const forms: FormElement[] = [];

  document.querySelectorAll('input:not([type="hidden"])').forEach((el) => {
    const input = el as HTMLInputElement;
    inputs.push({
      ...getAttributes(el),
      tag: 'input',
      type: input.type || 'text',
      value: input.type === 'password' ? '********' : (input.value || null),
      checked: input.checked,
      placeholder: input.placeholder || null,
      required: input.required || input.getAttribute('required') === 'required',
      disabled: input.disabled,
      readonly: input.readOnly,
      maxlength: el.getAttribute('maxlength') || null,
      pattern: el.getAttribute('pattern') || null,
      label: findLabel(input),
    });
  });

  document.querySelectorAll('select').forEach((el) => {
    const select = el as HTMLSelectElement;
    const options: SelectOption[] = Array.from(select.options).map(opt => ({
      value: opt.value || null,
      text: opt.text,
      selected: opt.selected,
      disabled: opt.disabled
    }));

    selects.push({
      ...getAttributes(el),
      tag: 'select',
      disabled: select.disabled,
      required: select.required,
      onchange: el.getAttribute('onchange'),
      label: findLabel(select),
      options: options,
      optionsCount: options.length
    });
  });

  document.querySelectorAll('textarea').forEach((el) => {
    const textarea = el as HTMLTextAreaElement;
    textareas.push({
      ...getAttributes(el),
      tag: 'textarea',
      value: textarea.value,
      placeholder: textarea.placeholder || null,
      required: textarea.required,
      disabled: textarea.disabled,
      readonly: textarea.readOnly,
      rows: el.getAttribute('rows'),
      cols: el.getAttribute('cols'),
      label: findLabel(textarea)
    });
  });

  document.querySelectorAll('button, input[type="submit"], input[type="button"], .button, [role="button"], .dropdown, a.btn').forEach((el) => {
    const text = getTextContent(el);
    const className = el.className || '';
    buttons.push({
      ...getAttributes(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || null,
      value: el instanceof HTMLInputElement ? el.value : null,
      text: text,
      onclick: el.getAttribute('onclick'),
      disabled: (el as any).disabled || el.getAttribute('aria-disabled') === 'true',
      isLoginButton: isLoginElement(el, text),
      isDropdown: className.toLowerCase().includes('dropdown')
    });
  });

  document.querySelectorAll('a').forEach((el) => {
    const text = getTextContent(el);
    const onclick = el.getAttribute('onclick');
    const href = el.getAttribute('href');
    links.push({
      ...getAttributes(el),
      tag: 'a',
      href: href || null,
      text: text || null,
      onclick: onclick || null,
      target: el.getAttribute('target') || null,
      dataToggle: el.getAttribute('data-toggle') || null,
      dataTarget: el.getAttribute('data-target') || null,
      type: (onclick || href === '#' || (href && (href.startsWith('javascript:') || href.includes('choose_login')))) ? 'trigger' : 'navigation',
      disabled: el.getAttribute('aria-disabled') === 'true',
    });
  });

  document.querySelectorAll('form').forEach((el) => {
    forms.push({
        id: el.id || null,
        name: el.getAttribute('name') || null,
        action: el.getAttribute('action') || null,
        method: (el.getAttribute('method') || 'GET').toUpperCase(),
        enctype: el.getAttribute('enctype') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        elementCount: {
            inputs: el.querySelectorAll('input').length,
            selects: el.querySelectorAll('select').length,
            textareas: el.querySelectorAll('textarea').length,
            buttons: el.querySelectorAll('button, input[type="submit"]').length
        }
    });
  });

  return {
    url: window.location.href,
    inputs,
    selects,
    textareas,
    buttons,
    links,
    forms,
    extractedAt: new Date().toISOString()
  };
};
