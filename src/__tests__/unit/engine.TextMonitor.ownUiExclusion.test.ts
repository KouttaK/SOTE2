/**
 * Regression test for a bug where typing inside SOTE's own overlays (the
 * Command Palette, and — critically — the "Input"/"Choice" token popup)
 * could leak keystrokes to TextMonitor's global document-level listeners.
 *
 * Root cause: TextMonitor ignores keydown/input events targeting its own
 * UI via `target.closest('.sote-palette-host')`, but ChoicePopup's host
 * element had no such marker class. So pressing a trigger key (Space/Tab/
 * Enter) while typing a value into the Input-token popup would:
 *   1. leak through to TextMonitor.handleKeydown using a STALE buffer
 *      (whatever the user had typed on the real page before the popup
 *      opened),
 *   2. get matched against that stale buffer and preventDefault()'d —
 *      silently eating the space/tab the user just typed,
 *   3. potentially re-fire the same Flow, popping open a *second* token
 *      popup whose own auto-focus() steals focus away from the field the
 *      user was actively typing into.
 *
 * From the user's point of view this looked like "every keystroke, the
 * field loses focus and I have to click back into it."
 */
import { describe, it, expect } from 'vitest';
import { TextMonitor } from '../../content/engine/TextMonitor';
import { ChoicePopup } from '../../content/engine/ChoicePopup';
import { CommandPalette } from '../../content/palette/CommandPalette';
import type { Token } from '../../shared/types/index';

describe('TextMonitor ignores keystrokes typed into SOTE\'s own overlays', () => {
  it('does not leak a trigger-key (Space) typed inside the ChoicePopup input field', async () => {
    const triggerEvents: unknown[] = [];
    const charEvents: unknown[] = [];

    const monitor = new TextMonitor(
      (_e, buffer, element) => { charEvents.push({ buffer, tag: element?.tagName }); },
      (_e, keyName, buffer, element) => { triggerEvents.push({ keyName, buffer, tag: element?.tagName }); }
    );
    monitor.start();

    // Simulate a buffer left over from the real page field that triggered
    // this flow (e.g. the user typed "/greeting" right before the popup
    // opened to ask for the "Input" token's value).
    (monitor as unknown as { buffer: string }).buffer = '/greeting';

    const pageField = document.createElement('div');
    document.body.appendChild(pageField);

    const popup = new ChoicePopup();
    const token: Token = { id: 't1', type: 'input', config: { label: 'Name' } } as unknown as Token;
    void popup.showForToken(token, pageField);

    // let the popup's own setTimeout(() => input.focus(), 10) run
    await new Promise((r) => setTimeout(r, 20));

    const shadow = (popup as unknown as { shadow: ShadowRoot }).shadow;
    const input = shadow.querySelector('.input-field') as HTMLInputElement;
    expect(shadow.activeElement).toBe(input);

    // Type a regular character — should never reach TextMonitor at all.
    input.value = 'J';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect(charEvents).toEqual([]);

    // Press Space (a trigger key) while the popup's own input is focused.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, composed: true }));

    expect(triggerEvents).toEqual([]);
    monitor.stop();
  });

  it('still ignores keystrokes typed into the Command Palette search input (no regression)', async () => {
    const triggerEvents: unknown[] = [];
    const monitor = new TextMonitor(
      () => {},
      (_e, keyName, buffer, element) => { triggerEvents.push({ keyName, buffer, tag: element?.tagName }); }
    );
    monitor.start();

    const palette = new CommandPalette();
    palette.updateFlows([]);
    palette.updateForms([]);
    await new Promise<void>((resolve) => {
      palette.open(() => {}, () => {});
      setTimeout(resolve, 20);
    });

    const host = document.querySelector('.sote-palette-host') as HTMLElement;
    const shadow = host.shadowRoot!;
    const input = shadow.querySelector('.search-input') as HTMLInputElement;
    expect(shadow.activeElement).toBe(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, composed: true }));

    expect(triggerEvents).toEqual([]);
    monitor.stop();
  });
});
