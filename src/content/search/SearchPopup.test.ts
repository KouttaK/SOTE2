/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SearchPopup } from './SearchPopup.js';

describe('SearchPopup', () => {
  let popup: SearchPopup;
  let anchor: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    anchor = document.createElement('div');
    document.body.appendChild(anchor);
    popup = new SearchPopup();
  });

  afterEach(() => {
    popup.close();
  });

  it('should render an empty state message when drilling down into a Form with 0 fields', () => {
    popup.open(anchor);

    const mockForm = {
      id: 'f1', name: 'Test Form', sites: [], fields: [], createdAt: 0, updatedAt: 0, stats: { usageCount: 0 }
    };
    popup.update([{ kind: 'form', form: mockForm as any, matchLevel: 1 }]);

    // @ts-ignore
    popup.activate(0);

    // @ts-ignore
    const shadow = popup.shadow;
    const emptyState = shadow.querySelector('.sp-empty');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain('Esta macro ainda n\u00E3o tem campos.');
  });

  it('should list fields when drilling down into a Form with fields (happy path)', () => {
    popup.open(anchor);

    const mockForm = {
      id: 'f1', name: 'Test Form', sites: [], 
      fields: [
        { name: 'Greeting', type: 'text', value: { type: 'action', data: { content: 'Hello' } } }
      ],
      createdAt: 0, updatedAt: 0, stats: { usageCount: 0 }
    };

    popup.update([{ kind: 'form', form: mockForm as any, matchLevel: 1 }]);
    
    // Drill down
    // @ts-ignore
    popup.activate(0);

    // @ts-ignore
    const shadow = popup.shadow;
    const rows = shadow.querySelectorAll('.sp-row');
    expect(rows.length).toBe(1);
    
    const title = shadow.querySelector('.sp-row-title');
    expect(title?.textContent).toBe('Greeting');
  });
});
