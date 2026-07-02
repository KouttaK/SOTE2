/**
 * src/content.ts
 */

import { browser } from 'wxt/browser';
import { TextMonitor } from './content/engine/TextMonitor.js';
import { TriggerDetector, TriggerMatch } from './content/engine/TriggerDetector.js';
import { TextInjector } from './content/engine/TextInjector.js';
import { ChoicePopup } from './content/engine/ChoicePopup.js';
import { CommandPalette } from './content/palette/CommandPalette.js';
import { applyCasing } from './content/engine/SmartCase.js';
import { expandToken, ExpansionContext } from './content/engine/tokenExpander.js';
import { sendMessage, onMessage } from './shared/messaging/client.js';
import type { ActionBlock, Token, Flow, Block, Settings, ClipboardEntry } from './shared/types/index.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('[SOTE] Content Script Loaded');
    try {

    const detector = new TriggerDetector();
    const choicePopup = new ChoicePopup();
    const commandPalette = new CommandPalette();

    const isBlocked = (hostname: string, blocklist: string[]): boolean => {
      for (const b of blocklist) {
        if (b.startsWith('*.')) {
          const domain = b.slice(2);
          if (hostname === domain || hostname.endsWith('.' + domain)) return true;
        } else {
          if (hostname === b) return true;
        }
      }
      return false;
    };

    // 1. Initial Load of Data via Messaging
    let flows: Flow[] = await sendMessage({ type: 'GET_FLOWS' });
    let settings: Settings = await sendMessage({ type: 'GET_SETTINGS' });

    // Clipboard history, newest item first — text-only mirror of what's
    // persisted in the background (see StorageService.getClipboardHistory).
    let clipboardHistory: string[] = ((await sendMessage({ type: 'GET_CLIPBOARD_HISTORY' })) as ClipboardEntry[])
      .map((entry) => entry.text);
    console.log('[SOTE][clipboard] initial history fetched on page load:', clipboardHistory, '(url:', window.location.href, ')');

    if (isBlocked(window.location.hostname, settings.blocklist || []) || !settings.globalEnabled) {
      console.log('[SOTE] Disabled on this site by blocklist or global settings.');
      // Do not initialize monitor, but we still need to listen for settings updates
      // in case it gets unblocked or re-enabled.
    }

    detector.updateData(flows, settings);
    commandPalette.updateFlows(flows);

    // 2. Listen for Broadcasts from Background
    onMessage((msg) => {
      if (msg.type === 'SETTINGS_UPDATED') {
        settings = msg.payload as Settings;
        if (isBlocked(window.location.hostname, settings.blocklist || []) || !settings.globalEnabled) {
          monitor.pause();
        } else {
          monitor.resume();
        }
        detector.updateData(flows, settings);
        monitor.triggerKeys = settings.triggerKeys;
      }
      
      if (msg.type === 'FLOWS_UPDATED') {
        flows = msg.payload as Flow[];
        detector.updateData(flows, settings);
        commandPalette.updateFlows(flows);
      }

      if (msg.type === 'CLIPBOARD_HISTORY_UPDATED') {
        clipboardHistory = (msg.payload as ClipboardEntry[]).map((entry) => entry.text);
        console.log('[SOTE][clipboard] authoritative history from background:', clipboardHistory);
      }
    });

    /**
     * Extracts the plain text a 'copy'/'cut' event just placed on the
     * clipboard, without waiting on navigator.clipboard.readText()
     * (which needs an extra permission prompt/focus check and would race
     * with the OS actually writing the clipboard).
     *
     * Order of attempts:
     * 1. Native <input>/<textarea> selection — window.getSelection()
     *    doesn't see into form control values, so this has to be read
     *    from the field's own selectionStart/selectionEnd.
     * 2. Regular DOM selection (contentEditable, page text, etc.).
     * 3. event.clipboardData, in case the page itself wrote a custom
     *    payload during the copy (rare, but a valid fallback).
     */
    const getCopiedText = (e: ClipboardEvent): string => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const field = active as HTMLInputElement | HTMLTextAreaElement;
        if (
          typeof field.selectionStart === 'number' &&
          typeof field.selectionEnd === 'number' &&
          field.selectionStart !== field.selectionEnd
        ) {
          return field.value.substring(field.selectionStart, field.selectionEnd);
        }
      }

      const selectionText = window.getSelection()?.toString();
      if (selectionText) return selectionText;

      return e.clipboardData?.getData('text/plain') ?? '';
    };

    /**
     * Looks up a token's full definition (type + config) for a pill element
     * found in the saved HTML. Reads config straight off the pill's own
     * `data-token-config` attribute first — that's the source of truth
     * written at save time (see TokenPill.createHTML) — and only falls
     * back to the flow's `tokens` array (older saved flows, before this
     * attribute existed) or to inferring the bare type from the pill's
     * `token-<type>` class as a last resort. This way a choice/input popup
     * always has its real options/label instead of silently falling back
     * to an empty config if the array and the HTML were ever out of sync.
     */
    /**
     * Invisible marker used to remember where a Cursor token sat in the
     * expanded content. It's inserted as plain text in place of the first
     * Cursor token's pill, and after all Smart Case processing is done we
     * locate it, compute how many plain-text characters precede it, strip
     * it out, and tell TextInjector to land the caret at that offset
     * instead of at the end of the inserted text (the old, unimplemented
     * behavior — the token was just deleted with nothing done with it).
     * Wrapped in U+2063 (invisible separator) on both sides so it can't
     * collide with anything a user would plausibly type or paste.
     */
    const CURSOR_MARKER = '\u2063\u2063SOTE_CURSOR\u2063\u2063';

    const resolveTokenForPill = (pillEl: Element, tokens: Token[]): Token | null => {
      const tokenId = pillEl.getAttribute('data-token-id') || crypto.randomUUID();

      const typeClass = Array.from(pillEl.classList).find(c => c.startsWith('token-') && c !== 'token-pill');
      const classType = typeClass?.replace('token-', '') as Token['type'] | undefined;

      const configAttr = pillEl.getAttribute('data-token-config');
      if (configAttr) {
        try {
          const config = JSON.parse(configAttr);
          const arrayMatch = tokens.find(t => t.id === pillEl.getAttribute('data-token-id'));
          const type = classType || arrayMatch?.type;
          if (type) {
            console.log('[SOTE][token-resolve] via data-token-config attribute', { tokenId, type, config });
            return { id: tokenId, type, config };
          }
        } catch (err) {
          console.warn('[SOTE][token-resolve] data-token-config found but failed to JSON.parse it', { raw: configAttr, err });
        }
      } else {
        console.log('[SOTE][token-resolve] pill has no data-token-config attribute (older saved flow?) — falling back', { pillOuterHTML: (pillEl as HTMLElement).outerHTML });
      }

      const arrayMatch = tokens.find(t => t.id === pillEl.getAttribute('data-token-id'));
      if (arrayMatch) {
        console.log('[SOTE][token-resolve] via tokens array match', arrayMatch);
        return arrayMatch;
      }

      if (!classType) {
        console.warn('[SOTE][token-resolve] could not resolve token at all (no config attr, no array match, no class type)', { pillOuterHTML: (pillEl as HTMLElement).outerHTML, tokens });
        return null;
      }
      console.warn('[SOTE][token-resolve] falling back to bare type from class, config will be EMPTY', { tokenId, classType });
      return { id: tokenId, type: classType, config: {} };
    };

    // 3. Orchestrator Logic
    // match parameter allows full match context, or just pass the Flow directly for palette
    const handleTrigger = async (flow: Flow, shortcutTyped: string, element: HTMLElement) => {
      monitor.pause(); // Stop monitoring while expanding

      try {
        const actionBlock = detector.resolveActionBlock(flow) as ActionBlock;
        if (!actionBlock) {
          monitor.resume();
          return;
        }

        const isRichText = actionBlock.format === 'richtext';
        let rawContent = actionBlock.content;
        console.log('[SOTE][handleTrigger] raw action content loaded at runtime:', rawContent);
        console.log('[SOTE][handleTrigger] actionBlock.tokens array:', actionBlock.tokens);

        const context: ExpansionContext = {
          tabUrl: window.location.href,
          tabTitle: document.title,
          clipboardHistory,
        };
        console.log('[SOTE][clipboard] history at trigger time (index 0 = most recent):', clipboardHistory);

        // Resolve Tokens sequentially.
        // We parse the saved HTML into a detached DOM and walk the actual
        // <span class="token-pill" data-token-id="..."> elements present in
        // it (via resolveTokenForPill), instead of iterating
        // actionBlock.tokens and trying to find/replace each one back in
        // the HTML string with a regex. This guarantees every pill that's
        // really in the content gets resolved — and for 'choice'/'input'
        // tokens, that the popup actually opens — even if the tokens array
        // and the saved HTML were ever slightly out of sync.
        const container = document.createElement('div');
        container.innerHTML = rawContent;
        const pillEls = Array.from(container.querySelectorAll('.token-pill'));

        let cancelled = false;
        let cursorMarkerPlaced = false;

        for (const pillEl of pillEls) {
          const token = resolveTokenForPill(pillEl, actionBlock.tokens || []);
          if (!token) continue;

          if (token.type === 'cursor') {
            // The Cursor token doesn't need async resolution — it just
            // marks where the caret should end up after expansion. Only
            // the first one found actually gets used (multi cursor
            // "tab stops" aren't supported yet); any extra ones are simply
            // removed, same as before.
            if (!cursorMarkerPlaced) {
              pillEl.replaceWith(document.createTextNode(CURSOR_MARKER));
              cursorMarkerPlaced = true;
            } else {
              pillEl.replaceWith(document.createTextNode(''));
            }
            continue;
          }

          let expandedValue = await expandToken(token, context);

          if (expandedValue === null) {
            // Needs popup (choice / input)
            expandedValue = await choicePopup.showForToken(token, element);
            if (expandedValue === null) {
              cancelled = true; // User cancelled (Esc / click outside / etc.)
              break;
            }
          }

          // Insert as a text node (not raw HTML) so any "<" or "&" the user
          // typed into an Input token can't be misinterpreted as markup.
          pillEl.replaceWith(document.createTextNode(expandedValue));
        }

        let expandedContent = container.innerHTML;

        if (cancelled) {
          monitor.resume();
          return;
        }

        // Locate the Cursor token's marker (if any) and translate it into a
        // plain-text character offset, then strip it out of the content —
        // done *before* Smart Case runs so the marker can never be mistaken
        // for/interfere with finding the real first visible letter.
        let cursorOffset: number | null = null;
        const markerIndex = expandedContent.indexOf(CURSOR_MARKER);
        if (markerIndex !== -1) {
          const before = expandedContent.slice(0, markerIndex);
          const beforeTmp = document.createElement('div');
          beforeTmp.innerHTML = before;
          cursorOffset = (beforeTmp.textContent || '').length;
          expandedContent = expandedContent.split(CURSOR_MARKER).join('');
        }

        // Apply Smart Case / Force Capitalize.
        // These are independent toggles: Force Capitalize must work even
        // when Smart Case is turned off, and both must work for richtext
        // actions too (richtext is the default format for new flows) — the
        // old code silently skipped both whenever isRichText was true.
        const triggerBlock = flow.blocks.find((b: Block) => b.type === 'trigger')?.data as any;
        if (triggerBlock && (triggerBlock.smartCase || triggerBlock.forceCapitalize)) {
          expandedContent = applyCasing(shortcutTyped, expandedContent, !!triggerBlock.forceCapitalize, isRichText);
        }

        // Inject
        TextInjector.inject(element, shortcutTyped, expandedContent, isRichText, cursorOffset);

        // The 'input'/'change' events dispatched by TextInjector fire while
        // the monitor is still paused (its listeners were removed above),
        // so TextMonitor's internal buffer never gets refreshed to reflect
        // the just-inserted expansion text. Without this, the buffer keeps
        // holding the OLD shortcut (e.g. "i2"), so the next trigger key
        // (Space/Tab/Enter) — even one pressed much later, just to keep
        // typing — matches the stale buffer again and re-expands the same
        // shortcut on top of itself (e.g. "boa noite" -> "boa noiboa noite").
        // Clearing it here forces a fresh read from the DOM on the next
        // real keystroke instead of reusing this stale snapshot.
        monitor.clearBuffer();
        
        // Track stats
        const plainTextLength = isRichText ? expandedContent.replace(/<[^>]+>/g, '').length : expandedContent.length;
        const keysSaved = Math.max(0, plainTextLength - shortcutTyped.length);
        sendMessage({ type: 'FLOW_USED', payload: { flowId: flow.id, keysSaved } });
        
      } catch (e) {
        console.error('[SOTE] Expansion Error:', e);
      } finally {
        monitor.resume();
      }
    };

    // 4. Setup Text Monitor
    let exactMatchTimeout: any = null;

    const monitor = new TextMonitor(
      (e, buffer, element) => {
        if (exactMatchTimeout) {
          clearTimeout(exactMatchTimeout);
          exactMatchTimeout = null;
        }

        const match = detector.detectExactMatchMode(buffer);
        if (match) {
          const delay = settings.exactMatchDelay || 0;
          if (delay > 0) {
            exactMatchTimeout = setTimeout(() => {
              exactMatchTimeout = null;
              if (document.activeElement !== element) return;
              
              const currentBuffer = monitor.getBuffer();
              const reMatch = detector.detectExactMatchMode(currentBuffer);
              if (reMatch && reMatch.shortcutTyped === match.shortcutTyped && reMatch.flow.id === match.flow.id) {
                handleTrigger(reMatch.flow, reMatch.shortcutTyped, element);
              }
            }, delay);
          } else {
            handleTrigger(match.flow, match.shortcutTyped, element);
          }
        }
      },
      (e, keyName, buffer, element) => {
        const match = detector.detectTriggerMode(buffer);
        if (match) {
          e.preventDefault(); 
          handleTrigger(match.flow, match.shortcutTyped, element);
        }
      }
    );
    monitor.triggerKeys = settings.triggerKeys;
    monitor.start();

    // 5. Clipboard History Capture
    // Every 'copy' or 'cut' on the page pushes the copied text to the
    // background, which persists it and re-broadcasts CLIPBOARD_HISTORY_UPDATED
    // to all tabs (including this one) so `clipboardHistory` above stays fresh.
    // Note: this only sees copies that happen through the DOM copy/cut events
    // — text copied via navigator.clipboard.writeText() by some other script,
    // or copied outside the browser entirely, won't be captured (there's no
    // event to listen for in either case).
    //
    // We also update `clipboardHistory` locally right away (optimistically),
    // instead of only waiting for the background round-trip to broadcast it
    // back. Copying something and immediately triggering an expansion in the
    // same tab is a very normal flow, and the background round-trip
    // (content -> background -> storage write -> onChanged -> broadcast ->
    // content) can easily take longer than that. The optimistic value gets
    // silently reconciled the moment the real CLIPBOARD_HISTORY_UPDATED
    // broadcast for this same copy arrives, so it never drifts for long.
    const addToLocalClipboardHistory = (text: string) => {
      if (clipboardHistory[0] === text) return;
      const max = Math.max(1, Math.min(50, settings.clipboardHistoryMax || 10));
      clipboardHistory = [text, ...clipboardHistory].slice(0, max);
    };

    const handleClipboardEvent = (e: ClipboardEvent) => {
      try {
        const text = getCopiedText(e);
        if (text) {
          addToLocalClipboardHistory(text);
          console.log('[SOTE][clipboard] captured', JSON.stringify(text), '-> local history now:', clipboardHistory);
          sendMessage({ type: 'CLIPBOARD_COPY', payload: { text } });
        } else {
          console.log('[SOTE][clipboard] copy/cut event fired but no text could be extracted (empty selection?)');
        }
      } catch (err) {
        console.warn('[SOTE] Failed to capture clipboard event:', err);
      }
    };
    document.addEventListener('copy', handleClipboardEvent, true);
    document.addEventListener('cut', handleClipboardEvent, true);
    console.log('[SOTE][clipboard] copy/cut listeners attached on', window.location.href);

    // 6. Command Palette Global Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && exactMatchTimeout) {
        clearTimeout(exactMatchTimeout);
        exactMatchTimeout = null;
      }

      // Check shortcut. Default: Ctrl+Shift+Space
      const conf = settings.commandPaletteShortcut || 'Ctrl+Shift+Space';
      
      const requiresCtrl = conf.includes('Ctrl') || conf.includes('Cmd');
      const requiresShift = conf.includes('Shift');
      const requiresAlt = conf.includes('Alt');
      const keyPart = conf.split('+').pop()?.toLowerCase();

      let keyMatches = false;
      if (keyPart === 'space' && e.code === 'Space') keyMatches = true;
      else if (e.key.toLowerCase() === keyPart) keyMatches = true;

      const ctrlMatches = requiresCtrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const shiftMatches = requiresShift ? e.shiftKey : !e.shiftKey;
      const altMatches = requiresAlt ? e.altKey : !e.altKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        e.preventDefault();
        
        commandPalette.open(
          (flow) => {
            const active = document.activeElement as HTMLElement;
            handleTrigger(flow, '', active);
          },
          () => {
            // onClose callback
          }
        );
      }
    }, true);
    } catch (e) {
      console.error('[SOTE] Content script init failed:', e);
    }
  }
});
