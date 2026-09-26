/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FormsPage from './forms.js';
import { storage } from '../../shared/storage/StorageService.js';

vi.mock('../../shared/storage/StorageService.js', () => ({
  storage: {
    getForms: vi.fn().mockResolvedValue([]),
    saveForm: vi.fn().mockResolvedValue(undefined),
    deleteForm: vi.fn().mockResolvedValue(undefined),
    onChange: vi.fn(),
    offChange: vi.fn(),
  }
}));

describe('FormsPage', () => {
  let container: HTMLDivElement;
  let page: any;

  beforeEach(() => {
    document.body.innerHTML = '<div class="dashboard-main"></div>';
    container = document.querySelector('.dashboard-main') as HTMLDivElement;
    page = new FormsPage();
    container.appendChild(page.render());
  });

  afterEach(() => {
    if (page.unmount) page.unmount();
    vi.clearAllMocks();
  });

  it('validates form name requirement before saving (empty name)', async () => {
    await page.mount();
    
    page['createNewForm']();
    
    const nameInput = container.querySelector('#frm-name') as HTMLInputElement;
    nameInput.value = '';
    
    await page['handleSave']();
    
    expect(storage.saveForm).not.toHaveBeenCalled();
  });

  it('validates field name requirement before saving (empty field name)', async () => {
    await page.mount();
    
    page['createNewForm']();

    const nameInput = container.querySelector('#frm-name') as HTMLInputElement;
    nameInput.value = 'Valid Form Name';
    
    page.draftFields.push({ id: 'f1', name: '', type: 'text', value: { type: 'action', data: { content: '' } } });
    
    await page['handleSave']();
    
    expect(storage.saveForm).not.toHaveBeenCalled();
  });

  it('creates and saves a valid form successfully', async () => {
    await page.mount();
    
    page['createNewForm']();

    const nameInput = container.querySelector('#frm-name') as HTMLInputElement;
    nameInput.value = 'My Awesome Form';
    
    page.draftFields.push({ id: 'f1', name: 'My Field', type: 'text', value: { type: 'action', data: { content: '' } } });
    
    await page['handleSave']();
    
    expect(storage.saveForm).toHaveBeenCalledTimes(1);
    const savedForm = (storage.saveForm as any).mock.calls[0][0];
    expect(savedForm.name).toBe('My Awesome Form');
    expect(savedForm.fields[0].name).toBe('My Field');
  });

  it('edits an existing form successfully', async () => {
    const existingForm = { id: '1', name: 'Old Name', sites: [], fields: [], createdAt: 0, updatedAt: 0, stats: { usageCount: 0 } };
    (storage.getForms as any).mockResolvedValue([existingForm]);
    
    await page.mount();
    page['selectForm'](existingForm);
    
    const nameInput = container.querySelector('#frm-name') as HTMLInputElement;
    nameInput.value = 'New Name';
    
    await page['handleSave']();
    
    expect(storage.saveForm).toHaveBeenCalledTimes(1);
    expect((storage.saveForm as any).mock.calls[0][0].name).toBe('New Name');
  });

  it('preserves legacy field type when editing', async () => {
    const existingForm = { 
      id: '2', name: 'Legacy Form', sites: [], 
      fields: [
        { id: 'f1', name: 'Email Field', type: 'email', value: { format: 'plaintext', content: 'test', tokens: [] } },
        { id: 'f2', name: 'Rich Text Field', type: 'richtext', value: { format: 'richtext', content: 'hello', tokens: [] } }
      ], 
      createdAt: 0, updatedAt: 0, stats: { usageCount: 0 } 
    };
    (storage.getForms as any).mockResolvedValue([existingForm]);
    
    await page.mount();
    page['selectForm'](existingForm);
    
    await page['handleSave']();
    
    expect(storage.saveForm).toHaveBeenCalledTimes(1);
    const savedForm = (storage.saveForm as any).mock.calls[0][0];
    
    expect(savedForm.fields[0].type).toBe('email');
    expect(savedForm.fields[1].type).toBe('richtext');
  });

  it('syncs draft content when switching accordions before saving', async () => {
    await page.mount();
    page['createNewForm']();

    const nameInput = container.querySelector('#frm-name') as HTMLInputElement;
    nameInput.value = 'Sync Test';
    
    // Add Field A
    const addFieldBtn = container.querySelector('#btn-add-field') as HTMLButtonElement;
    addFieldBtn.click();
    
    // By default, the accordion for the newly added field (index 0) is open.
    const fieldNameInputs = container.querySelectorAll('.frm-field-name-input');
    (fieldNameInputs[0] as HTMLInputElement).value = 'Field A';
    
    // Mock the ActionBlock's getData since jsdom doesn't fully run ProseMirror
    page.activeActionBlock.getData = () => ({ format: 'plaintext', content: 'Content A', tokens: [] });
    
    // Add Field B (this will automatically close A's accordion, syncing it, and open B's)
    addFieldBtn.click();
    
    const fieldNameInputsAfter = container.querySelectorAll('.frm-field-name-input');
    (fieldNameInputsAfter[1] as HTMLInputElement).value = 'Field B';
    
    page.activeActionBlock.getData = () => ({ format: 'plaintext', content: 'Content B', tokens: [] });
    
    await page['handleSave']();
    
    expect(storage.saveForm).toHaveBeenCalledTimes(1);
    const savedForm = (storage.saveForm as any).mock.calls[0][0];
    
    expect(savedForm.fields.length).toBe(2);
    expect(savedForm.fields[0].name).toBe('Field A');
    expect(savedForm.fields[0].value.content).toBe('Content A'); // Proves A was synced on close
    expect(savedForm.fields[1].name).toBe('Field B');
    expect(savedForm.fields[1].value.content).toBe('Content B'); // Proves B was synced on save
  });
});
