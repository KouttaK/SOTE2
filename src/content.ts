/**
 * src/content.ts
 */

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
import { browser } from 'wxt/browser';
import { sendMessage, onMessage } from './shared/messaging/client.js';
import { onContextInvalidated } from './shared/utils/serviceWorkerSafety.js';
import { domainMatchesAny, isSnoozeActive, isExtensionActive } from './shared/storage/helpers.js';
import { DEFAULT_SETTINGS } from './shared/storage/defaults.js';
import { findVariableKeysInText } from './shared/utils/flowVariableScanner.js';
import { findLongerPrefixFlows } from './shared/utils/conflictDetector.js';
import { isProtected, getDeepActiveElement, getTargetFromEvent } from './content/engine/SensitiveFieldGuard.js';
import type { ActionBlock, Token, Flow, Form, Block, Settings, ClipboardEntry, Variable } from './shared/types/index.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  allFrames: true,
  async main(ctx) {
    console.log('[SOTE] Content Script Loaded');
    try {

    const detector = new TriggerDetector();
    const choicePopup = new ChoicePopup();
    const commandPalette = new CommandPalette();

    const isBlocked = domainMatchesAny;

    // 1. Initial Load of Data via Messaging
    let flows: Flow[] = (await sendMessage<Flow[]>({ type: 'GET_FLOWS' })) || [];
    let settings: Settings = (await sendMessage<Settings>({ type: 'GET_SETTINGS' })) || DEFAULT_SETTINGS;

    // Forms ("Formulários") — per-site fill-in profiles, consumed by the
    // Gatilho de Busca (search trigger) and the Palette. Kept in sync the
    // same way Flows are (initial fetch here + FORMS_UPDATED below).
    let forms: Form[] = (await sendMessage<Form[]>({ type: 'GET_FORMS' })) || [];

    // Clipboard history, newest item first — text-only mirror of what's
    // persisted in the background (see StorageService.getClipboardHistory).
    const rawClipboard = await sendMessage<ClipboardEntry[]>({ type: 'GET_CLIPBOARD_HISTORY' });
    let clipboardHistory: string[] = Array.isArray(rawClipboard)
      ? rawClipboard.map((entry) => entry.text)
      : [];
    console.log('[SOTE][clipboard] initial history fetched on page load:', clipboardHistory, '(url:', window.location.href, ')');

    // Global Variables ({{KEY}} -> value), used to resolve variable tokens
    // typed directly into action text at expansion time (see resolveVariablesInText below).
    let variables: Variable[] = (await sendMessage<Variable[]>({ type: 'GET_VARIABLES' })) || [];

    if (!isExtensionActive(settings, window.location.hostname)) {
      console.log('[SOTE] Disabled on this site by blocklist, global settings, or snooze.');
      // Do not initialize monitor, but we still need to listen for settings updates
      // in case it gets unblocked or re-enabled.
    }

    detector.updateData(flows, settings);
    commandPalette.updateFlows(flows);
    commandPalette.updateForms(forms);
    commandPalette.updateContext(window.location.hostname, settings.searchTrigger?.includeFlows !== false);

    // C-01: Declare monitor early to avoid TDZ if a message arrives immediately
    let monitor: TextMonitor | undefined;

    // 2. Listen for Broadcasts from Background
    const removeMsgListener = onMessage((msg) => {
      if (msg.type === 'SETTINGS_UPDATED') {
        settings = msg.payload as Settings;
        if (!isExtensionActive(settings, window.location.hostname)) {
          monitor?.pause();
        } else {
          monitor?.resume();
        }
        detector.updateData(flows, settings);
        if (monitor) monitor.triggerKeys = settings.triggerKeys;
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
        try {
          if (
            typeof field.selectionStart === 'number' &&
            typeof field.selectionEnd === 'number' &&
            field.selectionStart !== field.selectionEnd
          ) {
            return field.value.substring(field.selectionStart, field.selectionEnd);
          }
        } catch {
          // type="number"/"range"/"color"/etc. throw on selectionStart/End
          // access instead of just returning null — fall through to the
          // other capture methods below.
        }
      }

      const selectionText = window.getSelection()?.toString();
      if (selectionText) return selectionText;

      return e.clipboardData?.getData('text/plain') ?? '';
    };

    // 2b. Respond to tab messages from popup (e.g. Quick Capture).
    // Kept as a separate listener (not the onMessage wrapper) because it
    // needs to call sendResponse synchronously.  The reference is stored so
    // selfDestruct() can remove it on context invalidation.
    const getSelectionListener = (msg: any, _sender: any, sendResponse: (v: any) => void) => {
      if (msg && msg.type === 'GET_SELECTION') {
        const active = (getDeepActiveElement() as HTMLElement | null) || (document.activeElement as HTMLElement | null);
        if (active && isProtected(active)) {
          sendResponse('');
          return false;
        }
        let text = '';
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          const field = active as HTMLInputElement | HTMLTextAreaElement;
          try {
            if (
              typeof field.selectionStart === 'number' &&
              typeof field.selectionEnd === 'number' &&
              field.selectionStart !== field.selectionEnd
            ) {
              text = field.value.substring(field.selectionStart, field.selectionEnd);
            }
          } catch {}
        }
        if (!text) {
          text = window.getSelection()?.toString() || '';
        }
        sendResponse(text);
        return false;
      }
    };
    try {
      browser.runtime.onMessage.addListener(getSelectionListener);
    } catch (e) {
      console.debug('[SOTE] Failed to add GET_SELECTION listener (context invalidated):', e);
    }

    // 3. Orchestrator Logic
    // match parameter allows full match context, or just pass the Flow directly for palette
    const handleTrigger = async (flow: Flow, shortcutTyped: string, element: HTMLElement) => {
      if (element && isProtected(element)) return;
      monitor.pause(); // Stop monitoring while expanding

      try {
        const actionBlock = await detector.resolveActionBlock(flow, element, shortcutTyped, {
          variables,
          clipboardText: clipboardHistory[0] ?? '',
          flow,
        });
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
          shortcutTyped,
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
        sendMessage({ type: 'FLOW_USED', payload: { flowId: flow.id, keysSaved } }).catch(() => {});

        // Track variable usage
        const usedVarKeys = resolved.usedVariables?.length
          ? resolved.usedVariables
          : findVariableKeysInText(actionBlock.content).filter((k) => variables.some((v) => v.key === k));
        if (usedVarKeys.length > 0) {
          sendMessage({ type: 'VARIABLES_USED', payload: { keys: usedVarKeys } }).catch(() => {});
        }
        
      } catch (e) {
        console.error('[SOTE] Expansion Error:', e);
        // Fire-and-forget: a falha em registrar a falha não deveria gerar
        // um segundo erro não tratado por cima do primeiro.
        sendMessage({ type: 'FLOW_EXECUTION_FAILED', payload: { flowId: flow.id } }).catch(() => {});
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
      if (element && isProtected(element)) return;
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
          shortcutTyped: searchTyped,
        });

        if (resolved === null) {
          monitor.resume();
          return;
        }

        const isRichText = field.value.format === 'richtext';
        TextInjector.inject(element, searchTyped, resolved.content, isRichText, resolved.cursorOffset);
        monitor.clearBuffer();

        sendMessage({ type: 'FORM_USED', payload: { formId: form.id } }).catch(() => {});
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

    searchPopup.onSelect(async (sel) => {
      const session = searchSession;
      searchSession = null;
      scopeOverride = null;
      if (!session || (session.element && isProtected(session.element))) return;
      try {
        if (sel.kind === 'flow') {
          await handleTrigger(sel.flow, session.typed, session.element);
        } else {
          await handleFormFieldInsert(sel.form, sel.field, session.typed, session.element);
        }
      } catch (err) {
        console.debug('[SOTE] SearchPopup selection failed gracefully:', err);
      }
    });

    searchPopup.onCancel(() => {
      searchSession = null;
      scopeOverride = null;
    });

    const runSearchTrigger = (state: ReturnType<typeof detectSearchTrigger>, element: HTMLElement) => {
      if (!state || (element && isProtected(element))) {
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

    monitor = new TextMonitor(
      () => settings,
      (e, buffer, element) => {
        if (!isExtensionActive(settings, window.location.hostname)) return;

        if (exactMatchTimeout) {
          clearTimeout(exactMatchTimeout);
          exactMatchTimeout = null;
        }

        runSearchTrigger(detectSearchTrigger(buffer, settings, window.location.hostname), element);

        const match = detector.detectExactMatchMode(buffer, element);
        if (match) {
          const longerPrefixFlows = findLongerPrefixFlows(match.flow.id, match.shortcutTyped, flows);
          const hasLongerPrefix = longerPrefixFlows.length > 0;
          const prefixWait = settings.prefixWaitMs ?? 500;
          const configuredDelay = settings.exactMatchDelay || 0;
          const applyToAll = settings.applyDelayToAllShortcuts === true;
          const baseDelay = applyToAll ? configuredDelay : 0;
          const effectiveDelay = hasLongerPrefix ? Math.max(configuredDelay, prefixWait) : baseDelay;

          if (effectiveDelay > 0) {
            exactMatchTimeout = setTimeout(() => {
              exactMatchTimeout = null;
              if (document.activeElement !== element) return;
              
              const currentBuffer = monitor?.getBuffer() || '';
              const reMatch = detector.detectExactMatchMode(currentBuffer, element);
              if (reMatch && reMatch.shortcutTyped === match.shortcutTyped && reMatch.flow.id === match.flow.id) {
                handleTrigger(reMatch.flow, reMatch.shortcutTyped, element).catch((err) => {
                  console.debug('[SOTE] Exact match execution failed gracefully:', err);
                });
              }
            }, effectiveDelay);
          } else {
            handleTrigger(match.flow, match.shortcutTyped, element).catch((err) => {
              console.debug('[SOTE] Exact match execution failed gracefully:', err);
            });
          }
        }
      },
      (e, keyName, buffer, element) => {
        if (!isExtensionActive(settings, window.location.hostname)) return;

        // While the search popup is open, Enter selects the highlighted
        // result (handled by SearchPopup's own keydown listener) instead of
        // falling through to Trigger-mode expansion.
        if (searchPopup.isOpen()) {
          e.preventDefault();
          return;
        }

        const match = detector.detectTriggerMode(buffer, element);
        if (match) {
          e.preventDefault();
          handleTrigger(match.flow, match.shortcutTyped, element).catch((err) => {
            console.debug('[SOTE] Trigger mode execution failed gracefully:', err);
          });
        }
      },
      (isProtectedStatus: boolean) => {
        sendMessage({ type: 'FRAME_PROTECTED_STATUS_CHANGED', payload: { isProtected: isProtectedStatus } }).catch(() => {});
      }
    );
    monitor.triggerKeys = settings.triggerKeys;
    
    if (isExtensionActive(settings, window.location.hostname)) {
      monitor.start();
    } else {
      // Initialize in paused state to respect blocklist / global disable
      monitor.start();
      monitor.pause();
    }

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
        const target = getTargetFromEvent(e);
        const deepActive = getDeepActiveElement();
        if ((target && isProtected(target)) || (deepActive && isProtected(deepActive))) {
          // NUNCA grava texto copiado ou recortado de campos sensíveis no histórico
          return;
        }
        const text = getCopiedText(e);
        if (text) {
          addToLocalClipboardHistory(text);
          console.log('[SOTE][clipboard] captured', JSON.stringify(text), '-> local history now:', clipboardHistory);
          sendMessage({ type: 'CLIPBOARD_COPY', payload: { text } }).catch(() => {});
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

    const handleCommandPaletteKeydown = (e: KeyboardEvent) => {
      if (!isExtensionActive(settings, window.location.hostname)) return;

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
        const deepActive = (getDeepActiveElement() as HTMLElement | null) || (document.activeElement as HTMLElement | null);
        if (deepActive && isProtected(deepActive)) {
          // Bloqueia abertura e inserção da paleta em campos protegidos
          return;
        }
        e.preventDefault();
        
        commandPalette.open(
          settings,
          (sel) => {
            const active = (getDeepActiveElement() as HTMLElement | null) || (document.activeElement as HTMLElement | null);
            if (active && isProtected(active)) return;
            if (sel.kind === 'flow') {
              handleTrigger(sel.flow, '', active as HTMLElement).catch((err) => {
                console.debug('[SOTE] Palette flow trigger failed gracefully:', err);
              });
            } else {
              handleFormFieldInsert(sel.form, sel.field, '', active as HTMLElement).catch((err) => {
                console.debug('[SOTE] Palette form insert failed gracefully:', err);
              });
            }
          },
          () => {
            // onClose callback
          }
        );
      }
    };
    
    document.addEventListener('keydown', handleCommandPaletteKeydown, true);

    // M-15: Clean up listeners and shut down completely if content script is
    // hot-reloaded or the extension context is invalidated.
    let isDestroyed = false;
    const selfDestruct = () => {
      if (isDestroyed) return;
      isDestroyed = true;
      console.debug('[SOTE] Content script self-destructed due to extension reload/update on', window.location.href);

      if (exactMatchTimeout) {
        clearTimeout(exactMatchTimeout);
        exactMatchTimeout = null;
      }

      document.removeEventListener('copy', handleClipboardEvent, true);
      document.removeEventListener('cut', handleClipboardEvent, true);
      document.removeEventListener('keydown', handleCommandPaletteKeydown, true);

      removeMsgListener();
      try { browser.runtime.onMessage.removeListener(getSelectionListener); } catch {}
      removeInvalidationListener();

      if (monitor) {
        monitor.stop();
      }

      searchPopup.close();
      commandPalette.close();
    };

    const removeInvalidationListener = onContextInvalidated(() => {
      selfDestruct();
    });

    ctx.onInvalidated(() => {
      selfDestruct();
    });

    } catch (e) {
      console.error('[SOTE] Content script init failed:', e);
    }
  }
});



