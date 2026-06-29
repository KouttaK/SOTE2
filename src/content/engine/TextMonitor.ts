/**
 * src/content/engine/TextMonitor.ts
 */

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

    // Ignorar o próprio overlay da Command Palette
    if (target.closest && target.closest('.sote-palette-host')) return;

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
    if (target.closest && target.closest('.sote-palette-host')) return;

    let codeName = e.code;
    if (e.key === ' ') codeName = 'Space';
    if (e.key === 'Tab') codeName = 'Tab';
    if (e.key === 'Enter') codeName = 'Enter';

    if (this.triggerKeys.includes(codeName)) {
      // Usar timeout para permitir que a Command Palette aja se necessário,
      // ou apenas disparar imediatamente
      this.onTriggerKeyPressed(e, codeName, this.buffer, target);
    }
  }
}

