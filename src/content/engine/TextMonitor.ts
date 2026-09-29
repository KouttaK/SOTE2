/**
 * src/content/engine/TextMonitor.ts
 */

import { isExtensionActive } from '../../shared/storage/helpers.js';
import type { Settings } from '../../shared/types/index.js';
import { isProtected, getTargetFromEvent } from './SensitiveFieldGuard.js';

const SOTE_OWN_UI_SELECTOR = '.sote-palette-host, .sote-choice-popup-host, .sote-search-popup-host';

export class TextMonitor {
  private buffer: string = '';
  private readonly MAX_BUFFER_SIZE = 100;
  private activeElement: HTMLElement | null = null;
  private onCharTyped: (e: KeyboardEvent, buffer: string, element: HTMLElement) => void;
  private onTriggerKeyPressed: (e: KeyboardEvent, keyName: string, buffer: string, element: HTMLElement) => void;
  private onProtectionStatusChange?: (isProtected: boolean) => void;
  private getSettings: () => Settings;
  
  public triggerKeys: string[] = ['Space', 'Tab', 'Enter'];
  
  private keydownListener: (e: KeyboardEvent) => void;
  private inputListener: (e: Event) => void;
  private focusinListener: (e: FocusEvent) => void;
  private focusoutListener: (e: FocusEvent) => void;

  private isFieldProtected: boolean = false;
  private lastReportedProtectionStatus: boolean | null = null;

  constructor(
    getSettings: () => Settings,
    onCharTyped: (e: KeyboardEvent, buffer: string, element: HTMLElement) => void,
    onTriggerKeyPressed: (e: KeyboardEvent, keyName: string, buffer: string, element: HTMLElement) => void,
    onProtectionStatusChange?: (isProtected: boolean) => void
  ) {
    this.getSettings = getSettings;
    this.onCharTyped = onCharTyped;
    this.onTriggerKeyPressed = onTriggerKeyPressed;
    this.onProtectionStatusChange = onProtectionStatusChange;

    this.keydownListener = this.handleKeydown.bind(this);
    this.inputListener = this.handleInputEvent.bind(this);
    this.focusinListener = this.handleFocusIn.bind(this);
    this.focusoutListener = this.handleFocusOut.bind(this);
  }

  public start() {
    document.addEventListener('keydown', this.keydownListener, true);
    document.addEventListener('input', this.inputListener, true);
    document.addEventListener('focusin', this.focusinListener, true);
    document.addEventListener('focusout', this.focusoutListener, true);
  }

  public stop() {
    document.removeEventListener('keydown', this.keydownListener, true);
    document.removeEventListener('input', this.inputListener, true);
    document.removeEventListener('focusin', this.focusinListener, true);
    document.removeEventListener('focusout', this.focusoutListener, true);
    this.activeElement = null;
    this.buffer = '';
    this.isFieldProtected = false;
    this.updateProtectionStatus(false);
  }

  public pause() {
    document.removeEventListener('keydown', this.keydownListener, true);
    document.removeEventListener('input', this.inputListener, true);
  }

  public resume() {
    document.addEventListener('keydown', this.keydownListener, true);
    document.addEventListener('input', this.inputListener, true);
  }

  public getBuffer(): string {
    return this.buffer;
  }

  public clearBuffer() {
    this.buffer = '';
  }

  private updateProtectionStatus(status: boolean) {
    if (this.lastReportedProtectionStatus !== status) {
      this.lastReportedProtectionStatus = status;
      this.onProtectionStatusChange?.(status);
    }
  }

  private handleFocusIn(event: FocusEvent): void {
    const target = getTargetFromEvent(event) as HTMLElement;
    if (!(target instanceof Element)) return;
    if (target.closest(SOTE_OWN_UI_SELECTOR)) return;

    if (isProtected(target)) {
      this.clearBuffer();
      this.isFieldProtected = true;
      this.activeElement = target;
      this.updateProtectionStatus(true);
    } else {
      this.isFieldProtected = false;
      this.activeElement = target;
      this.updateProtectionStatus(false);
    }
  }

  private handleFocusOut(event: FocusEvent): void {
    const target = getTargetFromEvent(event) as HTMLElement;
    if (target === this.activeElement) {
      this.clearBuffer();
      this.isFieldProtected = false;
      this.activeElement = null;
      this.updateProtectionStatus(false);
    }
  }

  private handleInputEvent(event: Event): void {
    if (!isExtensionActive(this.getSettings(), window.location.hostname)) return;

    // Use getTargetFromEvent to support open Shadow DOM
    const target = getTargetFromEvent(event) as HTMLElement;
    if (!(target instanceof Element)) return;

    // Ignorar os próprios overlays da extensão
    if (target.closest(SOTE_OWN_UI_SELECTOR)) return;

    // Reavaliar proteção rigorosamente a cada evento input
    if (isProtected(target)) {
      this.clearBuffer();
      this.isFieldProtected = true;
      this.activeElement = target;
      this.updateProtectionStatus(true);
      return; // NUNCA grava nada no buffer em campos protegidos
    }

    if (this.isFieldProtected) {
      this.isFieldProtected = false;
      this.updateProtectionStatus(false);
    }

    let textBeforeCursor = '';
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      let pos: number;
      try {
        pos = target.selectionStart ?? target.value.length;
      } catch {
        pos = target.value.length;
      }
      textBeforeCursor = target.value.substring(0, pos);
    } else if (target.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        range.setStart(target, 0);
        textBeforeCursor = range.toString();
      }
    } else {
      return;
    }

    this.activeElement = target;
    this.buffer = textBeforeCursor.slice(-this.MAX_BUFFER_SIZE);
    
    // Dispara a verificação de exact match no final do input
    this.onCharTyped({} as KeyboardEvent, this.buffer, this.activeElement);
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!isExtensionActive(this.getSettings(), window.location.hostname)) return;

    const target = getTargetFromEvent(e) as HTMLElement;
    if (!(target instanceof Element)) return;

    if (target.closest(SOTE_OWN_UI_SELECTOR)) return;

    // Se o campo for protegido, nunca processa atalhos de gatilho
    if (this.isFieldProtected || isProtected(target)) {
      this.clearBuffer();
      this.isFieldProtected = true;
      this.updateProtectionStatus(true);
      return;
    }

    const codeName = e.code;
    
    // Check if it's a trigger key
    if (this.triggerKeys.includes(codeName) || this.triggerKeys.includes(e.key)) {
      this.onTriggerKeyPressed(e, codeName, this.buffer, target);
    }
  }
}
