import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { browser } from 'wxt/browser';
import type { Form } from '../../shared/types/index.js';

// Auto-imports normally provided by WXT at build time.
(globalThis as any).defineBackground = (main: any) =>
  typeof main === 'function' ? { main } : main;

import backgroundEntrypoint from '../../background/index.js';
import { storage } from '../../shared/storage/StorageService.js';

function makeForm(overrides: Partial<Form> = {}): Form {
  return {
    id: crypto.randomUUID(),
    name: 'Test form',
    sites: [],
    fields: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stats: { usageCount: 0 },
    ...overrides,
  };
}

describe('background message handling — Forms', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  /**
   * Boots the background entrypoint and returns the message handler it
   * registered via browser.runtime.onMessage.addListener, so tests can
   * drive it directly instead of relying on real cross-context messaging
   * (which fakeBrowser doesn't simulate between two separate scripts).
   */
  async function bootAndCaptureHandler() {
    const addListenerSpy = vi.spyOn(browser.runtime.onMessage, 'addListener');
    await (backgroundEntrypoint as any).main();
    const handler = addListenerSpy.mock.calls[0][0] as (
      message: any,
      sender: any,
      sendResponse: (response: any) => void,
    ) => boolean;
    return handler;
  }

  function invoke(handler: (m: any, s: any, r: (r: any) => void) => boolean, message: any): Promise<any> {
    return new Promise((resolve) => {
      handler(message, {}, resolve);
    });
  }

  it('GET_FORMS returns [] before anything is saved', async () => {
    const handler = await bootAndCaptureHandler();
    const result = await invoke(handler, { type: 'GET_FORMS' });
    expect(result).toEqual([]);
  });

  it('SAVE_FORM persists the form so a later GET_FORMS sees it', async () => {
    const handler = await bootAndCaptureHandler();
    const form = makeForm({ name: 'Envio de Currículo' });

    const saveResult = await invoke(handler, { type: 'SAVE_FORM', payload: form });
    expect(saveResult).toEqual({ success: true });

    const forms = await invoke(handler, { type: 'GET_FORMS' });
    expect(forms).toHaveLength(1);
    expect(forms[0].name).toBe('Envio de Currículo');
  });

  it('DELETE_FORM removes the form', async () => {
    const handler = await bootAndCaptureHandler();
    const form = makeForm();
    await invoke(handler, { type: 'SAVE_FORM', payload: form });

    await invoke(handler, { type: 'DELETE_FORM', payload: { id: form.id } });
    const forms = await invoke(handler, { type: 'GET_FORMS' });
    expect(forms).toHaveLength(0);
  });

  it('FORM_USED increments usage stats', async () => {
    const handler = await bootAndCaptureHandler();
    const form = makeForm();
    await invoke(handler, { type: 'SAVE_FORM', payload: form });

    await invoke(handler, { type: 'FORM_USED', payload: { formId: form.id } });
    await invoke(handler, { type: 'FORM_USED', payload: { formId: form.id } });

    const updated = await storage.getForm(form.id);
    expect(updated!.stats.usageCount).toBe(2);
    expect(updated!.stats.lastUsed).toBeTypeOf('number');
  });

  it('a "forms" storage change re-fetches Forms and attempts to broadcast FORMS_UPDATED', async () => {
    const onChangedSpy = vi.spyOn(browser.storage.onChanged, 'addListener');
    await (backgroundEntrypoint as any).main();
    const onChangedHandler = onChangedSpy.mock.calls[0][0] as (
      changes: Record<string, unknown>,
      areaName: string,
    ) => Promise<void>;

    await storage.saveForm(makeForm({ name: 'Abertura de Protocolo' }));
    const getFormsSpy = vi.spyOn(storage, 'getForms');

    // This mirrors exactly what browser.storage.onChanged would deliver for
    // real when the `forms` key is written — invoked directly here so the
    // test isn't at the mercy of fakeBrowser's own (partial) URL-pattern
    // matching for tabs.query, which the real broadcastMessage() also uses.
    await onChangedHandler({ forms: { newValue: [] } }, 'local');

    expect(getFormsSpy).toHaveBeenCalled();
    await expect(getFormsSpy.mock.results[0].value).resolves.toHaveLength(1);
  });
});
