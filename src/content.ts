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
import { resolveActionBlockContent } from './content/engine/ActionContentResolver.js';
import { detectSearchTrigger, buildSearchResults, SearchScope } from './content/engine/SearchTriggerDetector.js';
import { SearchPopup } from './content/search/SearchPopup.js';
import { sendMessage, onMessage } from './shared/messaging/client.js';
import { domainMatchesAny } from './shared/storage/helpers.js';
import type { ActionBlock, Token, Flow, Form, Block, Settings, ClipboardEntry, Variable } from './shared/types/index.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('[SOTE] Content Script Loaded');
    try {

    const detector = new TriggerDetector();
    const choicePopup = new ChoicePopup();
    const commandPalette = new CommandPalette();

    const isBlocked = domainMatchesAny;

    // 1. Initial Load of Data via Messaging
    let flows: Flow[] = await sendMessage({ type: 'GET_FLOWS' });
    let settings: Settings = await sendMessage({ type: 'GET_SETTINGS' });

    // Forms ("Formulários") — per-site fill-in profiles, consumed by the
    // Gatilho de Busca (search trigger) and the Palette. Kept in sync the
    // same way Flows are (initial fetch here + FORMS_UPDATED below).
    let forms: Form[] = (await sendMessage({ type: 'GET_FORMS' })) || [];

    // Clipboard history, newest item first — text-only mirror of what's
    // persisted in the background (see StorageService.getClipboardHistory).
    let clipboardHistory: string[] = ((await sendMessage({ type: 'GET_CLIPBOARD_HISTORY' })) as ClipboardEntry[])
      .map((entry) => entry.text);
    console.log('[SOTE][clipboard] initial history fetched on page load:', clipboardHistory, '(url:', window.location.href, ')');

    // Global Variables ({{KEY}} -> value), used to resolve variable tokens
    // typed directly into action text at expansion time (see resolveVariablesInText below).
    let variables: Variable[] = (await sendMessage({ type: 'GET_VARIABLES' })) || [];

    if (isBlocked(window.location.hostname, settings.blocklist || []) || !settings.globalEnabled) {
      console.log('[SOTE] Disabled on this site by blocklist or global settings.');
      // Do not initialize monitor, but we still need to listen for settings updates
      // in case it gets unblocked or re-enabled.
    }

    detector.updateData(flows, settings);
    commandPalette.updateFlows(flows);
    commandPalette.updateForms(forms);
    commandPalette.updateContext(window.location.hostname, settings.searchTrigger?.includeFlows !== false);

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
        commandPalette.updateContext(window.location.hostname, settings.searchTrigger?.includeFlows !== false);
      }
      
      if (msg.type === 'FLOWS_UPDATED') {
        flows = msg.payload as Flow[];
        detector.updateData(flows, settings);
        commandPalette.updateFlows(flows);
      }

      if (msg.type === 'FORMS_UPDATED') {
        forms = (msg.payload as Form[]) || [];
        commandPalette.updateForms(forms);
      }

      if (msg.type === 'CLIPBOARD_HISTORY_UPDATED') {
        clipboardHistory = (msg.payload as ClipboardEntry[]).map((entry) => entry.text);
        console.log('[SOTE][clipboard] authoritative history from background:', clipboardHistory);
      }

      if (msg.type === 'VARIABLES_UPDATED') {
        variables = (msg.payload as Variable[]) || [];
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

    // 3. Orchestrator Logic
    // match parameter allows full match context, or just pass the Flow directly for palette
    const handleTrigger = async (flow: Flow, shortcutTyped: string, element: HTMLElement) => {
      monitor.pause(); // Stop monitoring while expanding

      try {
        const actionBlock = await detector.resolveActionBlock(flow, element, variables);
        if (!actionBlock) {
          monitor.resume();
          return;
        }

        const isRichText = actionBlock.format === 'richtext';

        const context: ExpansionContext = {
          tabUrl: window.location.href,
          tabTitle: document.title,
          clipboardHistory,
        };

        // Resolve tokens + variables + cursor position — shared pipeline,
        // see ActionContentResolver.ts (also used by Forms' field insertion).
        // `flows` lets any `flow_ref` ("Incluir Fluxo") token look up its
        // target; seeding the cycle-guard with this flow's own id means a
        // flow that (directly or indirectly) includes itself is caught
        // immediately instead of only on the second time around the loop.
        const resolved = await resolveActionBlockContent(actionBlock, element, {
          choicePopup,
          variables,
          context,
          flows,
        }, new Set([flow.id]));

        if (resolved === null) {
          // User cancelled a choice/input token popup (Esc / click outside).
          monitor.resume();
          return;
        }

        let expandedContent = resolved.content;
        const cursorOffset = resolved.cursorOffset;

        // Apply Smart Case / Force Capitalize.
        // These are independent toggles: Force Capitalize must work even
        // when Smart Case is turned off, and both must work for richtext
        // actions too (richtext is the default format for new flows) — the
        // old code silently skipped both whenever isRichText was true.
        const triggerBlock = flow.blocks.find((b: Block) => b.type === 'trigger')?.data as any;
        // `smartCase` defaults to ON when the field is missing/undefined
        // (flows saved before this option existed, or imported from an
        // older backup) — same default TriggerDetector.matchesShortcut()
        // already documents and relies on for the *matching* half of Smart
        // Case. Checking `triggerBlock.smartCase` truthily here broke that
        // promise for the *casing* half: such a flow would still match
        // "ATT"/"Att" case-insensitively, but then expand with whatever
        // casing was saved, un-capitalized, instead of mirroring what was
        // typed.
        const smartCaseOn = !!triggerBlock && triggerBlock.smartCase !== false;
        if (triggerBlock && (smartCaseOn || triggerBlock.forceCapitalize)) {
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

    /**
     * Formulários (Forms) — inserts a single field's value, resolved
     * through the exact same pipeline as a Flow's action (see spec §2/§3).
     * `searchTyped` is whatever the user had typed for the Gatilho de
     * Busca (prefix + query) — it gets deleted and replaced by the
     * resolved content, the same way a Flow shortcut is.
     */
    const handleFormFieldInsert = async (form: Form, field: Form['fields'][number], searchTyped: string, element: HTMLElement) => {
      monitor.pause();
      try {
        const context: ExpansionContext = {
          tabUrl: window.location.href,
          tabTitle: document.title,
          clipboardHistory,
        };

        const resolved = await resolveActionBlockContent(field.value, element, {
          choicePopup,
          variables,
          context,
          flows,
        });

        if (resolved === null) {
          monitor.resume();
          return;
        }

        const isRichText = field.value.format === 'richtext';
        TextInjector.inject(element, searchTyped, resolved.content, isRichText, resolved.cursorOffset);
        monitor.clearBuffer();

        sendMessage({ type: 'FORM_USED', payload: { formId: form.id } });
      } catch (e) {
        console.error('[SOTE] Form field insertion error:', e);
      } finally {
        monitor.resume();
      }
    };

    // 4. Setup Text Monitor
    let exactMatchTimeout: any = null;

    // ── Gatilho de Busca ("Search Trigger") — spec §3/§4 ────────────────────
    const searchPopup = new SearchPopup();
    let searchSession: { element: HTMLElement; typed: string } | null = null;
    // Sticks for the remainder of the current session once the user clicks
    // the "tente ///" footer suggestion (spec §4.3), so they don't have to
    // retype the prefix. Reset whenever a brand new session starts.
    let scopeOverride: SearchScope | null = null;

    const searchTriggerAllowed = (): boolean => {
      if (!settings.globalEnabled) return false;
      if (settings.snoozeUntil && Date.now() < settings.snoozeUntil) return false;
      if (isBlocked(window.location.hostname, settings.blocklist || [])) return false;
      return true;
    };

    searchPopup.onSelect(async (sel) => {
      const session = searchSession;
      searchSession = null;
      scopeOverride = null;
      if (!session) return;
      if (sel.kind === 'flow') {
        await handleTrigger(sel.flow, session.typed, session.element);
      } else {
        await handleFormFieldInsert(sel.form, sel.field, session.typed, session.element);
      }
    });

    searchPopup.onCancel(() => {
      searchSession = null;
      scopeOverride = null;
    });

    const runSearchTrigger = (state: ReturnType<typeof detectSearchTrigger>, element: HTMLElement) => {
      if (!state) {
        if (searchPopup.isOpen()) {
          searchPopup.close();
          searchSession = null;
          scopeOverride = null;
        }
        return;
      }

      if (!searchPopup.isOpen()) {
        scopeOverride = null; // fresh session
        searchPopup.open(element);
      }
      searchSession = { element, typed: state.typed };

      const effectiveScope = scopeOverride || state.scope;
      const cfg = settings.searchTrigger;
      const { results, noFormResultsForSite } = buildSearchResults({
        query: state.query,
        scope: effectiveScope,
        hostname: window.location.hostname,
        forms,
        flows,
        includeFlows: cfg?.includeFlows !== false,
      });

      const footer =
        effectiveScope === 'domain' && noFormResultsForSite && cfg?.globalPrefix
          ? {
              label: `Nenhum resultado para este site — tente ${cfg.globalPrefix}`,
              onClick: () => {
                scopeOverride = 'global';
                runSearchTrigger(state, element);
              },
            }
          : null;

      searchPopup.update(results, footer);
    };

    const monitor = new TextMonitor(
      (e, buffer, element) => {
        if (exactMatchTimeout) {
          clearTimeout(exactMatchTimeout);
          exactMatchTimeout = null;
        }

        if (searchTriggerAllowed()) {
          runSearchTrigger(detectSearchTrigger(buffer, settings), element);
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
        // While the search popup is open, Enter selects the highlighted
        // result (handled by SearchPopup's own keydown listener) instead of
        // falling through to Trigger-mode expansion.
        if (searchPopup.isOpen()) return;

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
          (sel) => {
            const active = document.activeElement as HTMLElement;
            if (sel.kind === 'flow') {
              handleTrigger(sel.flow, '', active);
            } else {
              handleFormFieldInsert(sel.form, sel.field, '', active);
            }
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
