/**
 * src/content/engine/TextMonitor.ts
 */

/**
 * CSS selector matching the host element of any of SOTE's own floating
 * overlays (Command Palette, the Input/Choice token popup, the Gatilho de
 * Busca results popup). Their inputs/buttons live inside a Shadow DOM
 * attached directly to `document.body`, so keydown/input events dispatched
 * inside them still bubble up to these document-level listeners — we must
 * explicitly ignore them or the (possibly stale) trigger-detection buffer
 * ends up reacting to keystrokes the user typed *into our own UI*, not into
 * a page field (see the Space/Tab/Enter "steals focus back" bug: without
 * this exclusion a trigger-key keydown typed inside the token popup gets
 * preventDefault()'d and can re-fire a Flow, popping open a *second* popup
 * that steals focus from the one being typed into).
 */
const SOTE_OWN_UI_SELECTOR = '.sote-palette-host, .sote-choice-popup-host, .sote-search-popup-host';

export class TextMonitor {
  private buffer: string = '';
  private readonly MAX_BUFFER_SIZE = 100;
  private activeElement: HTMLElement | null = null;
  private onCharTyped: (e: KeyboardEvent, buffer: string, element: HTMLElement) => void;
  private onTriggerKeyPressed: (e: KeyboardEvent, keyName: string, buffer: string, element: HTMLElement) => void;
  
  public triggerKeys: string[] = ['Space', 'Tab', 'Enter'];
  
  private keydownListener: (e: KeyboardEvent) => void;
  private inputListener: (e: Event) => void;

  constructor(
    onCharTyped: (e: KeyboardEvent, buffer: string, element: HTMLElement) => void,
    onTriggerKeyPressed: (e: KeyboardEvent, keyName: string, buffer: string, element: HTMLElement) => void
  ) {
    this.onCharTyped = onCharTyped;
    this.onTriggerKeyPressed = onTriggerKeyPressed;

    this.keydownListener = this.handleKeydown.bind(this);
    this.inputListener = this.handleInputEvent.bind(this);
  }

  public start() {
    document.addEventListener('keydown', this.keydownListener, true);
    document.addEventListener('input', this.inputListener, true);
  }

  public stop() {
    document.removeEventListener('keydown', this.keydownListener, true);
    document.removeEventListener('input', this.inputListener, true);
    this.activeElement = null;
    this.buffer = '';
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

  private handleInputEvent(event: Event): void {
    const target = event.target as HTMLElement;

    // Ignorar campos de senha
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') return;

    // Ignorar os próprios overlays da extensão (Command Palette, popup de
    // token Input/Choice, popup do Gatilho de Busca)
    if (target.closest && target.closest(SOTE_OWN_UI_SELECTOR)) return;

    let textBeforeCursor = '';
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const pos = target.selectionStart ?? target.value.length;
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

    this.activeElement = target as HTMLElement;
    this.buffer = textBeforeCursor.slice(-this.MAX_BUFFER_SIZE);
    
    // Dispara a verificação de exact match no final do input
    // Passamos um KeyboardEvent fake apenas para manter a assinatura.
    this.onCharTyped({} as KeyboardEvent, this.buffer, this.activeElement);
  }

  private handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;

    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') return;
    if (target.closest && target.closest(SOTE_OWN_UI_SELECTOR)) return;

    const codeName = e.code;
    
    // Check if it's a trigger key
    if (this.triggerKeys.includes(codeName) || this.triggerKeys.includes(e.key)) {
      this.onTriggerKeyPressed(e, codeName, this.buffer, target);
    }
  }
}
