const fs = require('fs');

let css = fs.readFileSync('src/dashboard/pages/forms.css', 'utf8');
css += `
.frm-field-wrapper {
  background-color: var(--color-panel);
  border: 1px solid var(--color-hair);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
  transition: all 0.2s ease;
}
.frm-field-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none; /* override previous border since wrapper handles it */
  margin-bottom: 0;
}
.frm-field-row.dragging {
  opacity: 0.5;
  background-color: var(--color-raise);
}

.frm-field-accordion-body {
  border-top: 1px solid var(--color-hair);
  padding: 1rem;
  background-color: var(--color-bg);
}
.frm-field-accordion-body .block-header {
  display: none;
}
.frm-field-accordion-body .block-card {
  border: none;
  padding: 0;
}
`;

css = css.replace('.frm-field-row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 0.75rem;\r\n  background-color: var(--color-panel);\r\n  border: 1px solid var(--color-hair);\r\n  border-radius: 0.5rem;\r\n  padding: 0.75rem 1rem;\r\n  margin-bottom: 0.5rem;\r\n}', 
'.frm-field-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background-color: var(--color-panel); }');

css = css.replace('.frm-field-row {\n  display: flex;\n  align-items: center;\n  gap: 0.75rem;\n  background-color: var(--color-panel);\n  border: 1px solid var(--color-hair);\n  border-radius: 0.5rem;\n  padding: 0.75rem 1rem;\n  margin-bottom: 0.5rem;\n}', 
'.frm-field-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background-color: var(--color-panel); }');


fs.writeFileSync('src/dashboard/pages/forms.css', css);

let ts = fs.readFileSync('src/dashboard/pages/forms.ts', 'utf8');

ts = ts.replace('private dragFieldIndex: number | null = null;', 'private dragFieldIndex: number | null = null;\n  private activeAccordionIndex: number | null = null;\n  private activeActionBlock: any = null;');

ts = ts.replace(/private openFieldValueModal\([\s\S]*?\n\n  \/\/ 🚀/m, '// 🚀');

const accordionLogic = `
  private closeActiveAccordion() {
    if (this.activeAccordionIndex !== null && this.activeActionBlock) {
      this.draftFields[this.activeAccordionIndex].value = this.activeActionBlock.getData();
      
      const wrapper = this.el.querySelector(\`.frm-field-wrapper[data-index="\${this.activeAccordionIndex}"]\`);
      if (wrapper) {
        const body = wrapper.querySelector('.frm-field-accordion-body');
        if (body) {
          body.innerHTML = '';
          (body as HTMLElement).style.display = 'none';
        }
        const btn = wrapper.querySelector('[data-action="edit-value"]');
        if (btn) btn.innerHTML = ICONS.chevron_down;
      }
      this.activeAccordionIndex = null;
      this.activeActionBlock = null;
    }
  }

  private toggleAccordion(index: number, wrapper: HTMLElement) {
    if (this.activeAccordionIndex === index) {
      this.closeActiveAccordion();
      return;
    }
    
    this.closeActiveAccordion();
    
    this.activeAccordionIndex = index;
    const field = this.draftFields[index];
    this.activeActionBlock = new ActionBlock(field.value, () => {});
    
    const body = wrapper.querySelector('.frm-field-accordion-body') as HTMLElement;
    body.style.display = 'block';
    body.appendChild(this.activeActionBlock.getElement());
    
    const btn = wrapper.querySelector('[data-action="edit-value"]');
    if (btn) btn.innerHTML = ICONS.chevron_up;
  }
`;
ts = ts.replace('private async handleSave()', accordionLogic + '\n\n  private async handleSave()');

let renderHtml = `
            <div class="frm-field-wrapper" data-index="\${i}">
            <div class="frm-field-row" draggable="true" data-index="\${i}">
              <span class="frm-field-drag-handle" title="\${t('forms.editor.drag_hint')}">\${ICONS.grip}</span>
              <input type="text" class="frm-field-name-input" value="\${escapeHtml(field.name)}" placeholder="\${t('forms.editor.field_name_placeholder')}" />
              <div class="frm-field-actions">
                <button class="frm-field-btn" data-action="edit-value" data-index="\${i}" title="\${t('forms.editor.edit_value')}">\${this.activeAccordionIndex === i ? ICONS.chevron_up : ICONS.chevron_down}</button>
                <button class="frm-field-btn danger" data-action="remove" data-index="\${i}" title="\${t('forms.editor.remove_field')}">\${ICONS.trash}</button>
              </div>
            </div>
            <div class="frm-field-accordion-body" style="display: \${this.activeAccordionIndex === i ? 'block' : 'none'};"></div>
            </div>
`;

ts = ts.replace(/<div class="frm-field-row" draggable="true"[\s\S]*?<\/div>\n            <\/div>/, renderHtml.trim());

ts = ts.replace(/container\.querySelectorAll<HTMLElement>\('\.frm-field-row'\)\.forEach\(\(row\) => \{[\s\S]*?this\.bindDragEvents\(row\);\n      \}\);/, 
`container.querySelectorAll<HTMLElement>('.frm-field-wrapper').forEach((wrapper) => {
        const row = wrapper.querySelector('.frm-field-row') as HTMLElement;
        row.querySelector('[data-action="edit-value"]')?.addEventListener('click', () => {
          this.syncFieldInputsToDraft();
          this.toggleAccordion(Number(wrapper.dataset.index), wrapper);
        });
        row.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
          this.syncFieldInputsToDraft();
          if (this.activeAccordionIndex === Number(wrapper.dataset.index)) {
             this.activeAccordionIndex = null;
             this.activeActionBlock = null;
          } else if (this.activeAccordionIndex !== null && this.activeAccordionIndex > Number(wrapper.dataset.index)) {
             this.activeAccordionIndex--; // shift index
          }
          this.draftFields.splice(Number(wrapper.dataset.index), 1);
          this.renderFieldsList();
        });
  
        this.bindDragEvents(row);
      });
      // Re-mount active block if it was re-rendered
      if (this.activeAccordionIndex !== null && this.activeActionBlock) {
         const wrapper = container.querySelector(\`.frm-field-wrapper[data-index="\${this.activeAccordionIndex}"]\`);
         if (wrapper) {
            const body = wrapper.querySelector('.frm-field-accordion-body');
            if (body) {
              body.innerHTML = '';
              body.appendChild(this.activeActionBlock.getElement());
            }
         }
      }
`);

ts = ts.replace(/if \(typeSelect\) this\.draftFields\[i\]\.type = typeSelect\.value as FormFieldType;/g, '');

ts = ts.replace(/private syncFieldInputsToDraft\(\) \{[\s\S]*?\}\n\n  private renderFieldsList/, 
`private syncFieldInputsToDraft() {
    const wrappers = this.el.querySelectorAll('.frm-field-wrapper');
    wrappers.forEach((wrapper, i) => {
      const nameInput = wrapper.querySelector('.frm-field-name-input') as HTMLInputElement;
      if (nameInput) this.draftFields[i].name = nameInput.value;
    });
    if (this.activeAccordionIndex !== null && this.activeActionBlock) {
      this.draftFields[this.activeAccordionIndex].value = this.activeActionBlock.getData();
    }
  }

  private renderFieldsList`);

ts = ts.replace(/private async handleSave\(\) \{\n    this\.syncFieldInputsToDraft\(\);/g, 
`private async handleSave() {
    this.closeActiveAccordion();
    this.syncFieldInputsToDraft();`);

// Remove type column logic from creating/adding fields
ts = ts.replace(/this\.draftFields\.push\(\{\n      id: Date\.now\(\)\.toString\(\),\n      name: '',\n      type: 'text',\n      value: \{ type: 'action', data: \{ content: '', format: 'plaintext', tokens: \[\] \} \},\n    \}\);/g, 
`this.draftFields.push({
      id: Date.now().toString(),
      name: '',
      type: 'text',
      value: { type: 'action', data: { content: '', format: 'plaintext', tokens: [] } },
    });
    // Open accordion for new field
    this.activeAccordionIndex = this.draftFields.length - 1;
    this.activeActionBlock = new ActionBlock(this.draftFields[this.activeAccordionIndex].value, () => {});`);

fs.writeFileSync('src/dashboard/pages/forms.ts', ts);
