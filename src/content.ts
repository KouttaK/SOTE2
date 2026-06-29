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
import { storage } from './shared/storage/StorageService.js';
import type { ActionBlock, Token, Flow, Block } from './shared/types/index.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('[SOTE] Content Script Loaded');

    const detector = new TriggerDetector();
    const choicePopup = new ChoicePopup();
    const commandPalette = new CommandPalette();

    // 1. Initial Load of Data
    const flows = await storage.getFlows();
    let settings = await storage.getSettings();
    let variables = await storage.getVariables();
    let templates = await storage.getTemplates();
    
    detector.updateData(flows, settings);
    commandPalette.updateFlows(flows);

    // 2. Listen for Storage Changes
    browser.storage.onChanged.addListener(async () => {
      const updatedFlows = await storage.getFlows();
      settings = await storage.getSettings();
      variables = await storage.getVariables();
      templates = await storage.getTemplates();

      detector.updateData(updatedFlows, settings);
      commandPalette.updateFlows(updatedFlows);
      monitor.triggerKeys = settings.triggerKeys;
      
      // Update expander context cache
      // The expander logic will use variables and templates later
    });

    // 3. Orchestrator Logic
    // match parameter allows full match context, or just pass the Flow directly for palette
    const handleTrigger = async (flow: Flow, shortcutTyped: string, element: HTMLElement, triggerKey?: string) => {
      monitor.pause(); // Stop monitoring while expanding

      try {
        const actionBlock = detector.resolveActionBlock(flow) as ActionBlock;
        if (!actionBlock) {
          monitor.resume();
          return;
        }

        const isRichText = actionBlock.format === 'richtext';
        let rawContent = actionBlock.content;

        const context: ExpansionContext = {
          tabUrl: window.location.href,
          tabTitle: document.title,
        };

        // Resolve Tokens sequentially
        // To accurately replace tokens, we iterate over them and replace their HTML representation
        let expandedContent = rawContent;
        let cancelled = false;

        for (const token of actionBlock.tokens) {
          let expandedValue = await expandToken(token, context);
          
          if (expandedValue === null) {
            // Needs popup
            expandedValue = await choicePopup.showForToken(token, element);
            if (expandedValue === null) {
              cancelled = true; // User hit Escape
              break;
            }
          }

          // Replace token pill in content
          // In rich text, it's a <span class="token-pill" data-token-id="...">...</span>
          // We can use a regex to replace it
          const tokenRegex = new RegExp(`<span[^>]*data-token-id="${token.id}"[^>]*>.*?</span>`, 'g');
          
          // If it's plaintext, tokens might just be injected as raw strings if we adapt the ActionBlock.
          // For now, we assume the content contains the HTML pills.
          if (isRichText) {
            expandedContent = expandedContent.replace(tokenRegex, expandedValue);
          } else {
            // For plaintext, we might strip HTML first then replace, or replace then strip.
            // Let's replace the raw HTML pill since it's saved in the content string.
            expandedContent = expandedContent.replace(tokenRegex, expandedValue);
          }
        }

        if (cancelled) {
          monitor.resume();
          return;
        }

        // Apply SmartCase if needed
        const triggerBlock = flow.blocks.find((b: Block) => b.type === 'trigger')?.data;
        if (triggerBlock && (triggerBlock as any).smartCase) {
          if (!isRichText) {
            expandedContent = applyCasing(shortcutTyped, expandedContent, (triggerBlock as any).forceCapitalize);
          }
        }

        // Inject
        TextInjector.inject(element, shortcutTyped + (triggerKey === 'Space' ? ' ' : ''), expandedContent, isRichText);
        
        // Track stats
        const plainTextLength = isRichText ? expandedContent.replace(/<[^>]+>/g, '').length : expandedContent.length;
        const keysSaved = Math.max(0, plainTextLength - shortcutTyped.length);
        await storage.incrementFlowStats(flow.id, keysSaved);
        
      } catch (e) {
        console.error('[SOTE] Expansion Error:', e);
      } finally {
        monitor.resume();
      }
    };

    // 4. Setup Text Monitor
    const monitor = new TextMonitor(
      (e, buffer, element) => {
        const match = detector.detectExactMatchMode(buffer);
        if (match) {
          handleTrigger(match.flow, match.shortcutTyped, element);
        }
      },
      (e, keyName, buffer, element) => {
        const match = detector.detectTriggerMode(buffer);
        if (match) {
          e.preventDefault(); 
          handleTrigger(match.flow, match.shortcutTyped, element, keyName);
        }
      }
    );
    monitor.triggerKeys = settings.triggerKeys;
    monitor.start();

    // 5. Command Palette Global Listener
    document.addEventListener('keydown', (e) => {
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
  }
});
