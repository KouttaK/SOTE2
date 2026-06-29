/**
 * src/content/engine/TextMonitor.ts
 */

export class TextMonitor {
  private buffer: string = '';
  private readonly MAX_BUFFER_SIZE = 50;
  private activeElement: HTMLElement | null = null;
  private onCharTyped: (e: KeyboardEvent, buffer: string, element: HTMLElement) => void;
  private onTriggerKeyPressed: (e: KeyboardEvent, keyName: string, buffer: string, element: HTMLElement) => void;
  
  // These will be configured by content.ts based on user settings
  public triggerKeys: string[] = ['Space', 'Tab', 'Enter'];
  
  private keydownListener: (e: KeyboardEvent) => void;
  private focusinListener: (e: FocusEvent) => void;
  private focusoutListener: (e: FocusEvent) => void;

  constructor(
    onCharTyped: (e: KeyboardEvent, buffer: string, element: HTMLElement) => void,
    onTriggerKeyPressed: (e: KeyboardEvent, keyName: string, buffer: string, element: HTMLElement) => void
  ) {
    this.onCharTyped = onCharTyped;
    this.onTriggerKeyPressed = onTriggerKeyPressed;

    this.keydownListener = this.handleKeydown.bind(this);
    this.focusinListener = this.handleFocusIn.bind(this);
    this.focusoutListener = this.handleFocusOut.bind(this);
  }

  public start() {
    document.addEventListener('keydown', this.keydownListener, true);
    document.addEventListener('focusin', this.focusinListener, true);
    document.addEventListener('focusout', this.focusoutListener, true);
    // Init active element if already focused
    this.checkActiveElement(document.activeElement);
  }

  public stop() {
    document.removeEventListener('keydown', this.keydownListener, true);
    document.removeEventListener('focusin', this.focusinListener, true);
    document.removeEventListener('focusout', this.focusoutListener, true);
    this.activeElement = null;
    this.buffer = '';
  }

  public pause() {
    document.removeEventListener('keydown', this.keydownListener, true);
  }

  public resume() {
    document.addEventListener('keydown', this.keydownListener, true);
  }

  public getBuffer(): string {
    return this.buffer;
  }

  public clearBuffer() {
    this.buffer = '';
  }

  private handleFocusIn(e: FocusEvent) {
    this.checkActiveElement(e.target as Element | null);
  }

  private handleFocusOut(e: FocusEvent) {
    // Small delay to see if focus went to another valid element
    setTimeout(() => {
      if (!this.isValidTarget(document.activeElement)) {
        this.activeElement = null;
        this.buffer = '';
      }
    }, 10);
  }

  private checkActiveElement(el: Element | null) {
    if (this.isValidTarget(el)) {
      this.activeElement = el as HTMLElement;
      this.buffer = ''; // reset buffer on new focus
    } else {
      this.activeElement = null;
      this.buffer = '';
    }
  }

  private isValidTarget(el: Element | null): boolean {
    if (!el) return false;
    
    // Ignore passwords completely
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password') {
      return false;
    }

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      return true;
    }

    if ((el as HTMLElement).isContentEditable) {
      return true;
    }

    // Shadow DOM boundaries are harder, but we'll stick to basic light DOM elements for now.
    return false;
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.activeElement) return;

    // We do not prevent default here, just observe.
    const key = e.key;

    // Handle trigger keys (Space, Tab, Enter)
    // The e.code gives us 'Space', 'Tab', 'Enter'.
    let codeName = e.code;
    if (key === ' ') codeName = 'Space';
    if (key === 'Tab') codeName = 'Tab';
    if (key === 'Enter') codeName = 'Enter';

    if (this.triggerKeys.includes(codeName)) {
      this.onTriggerKeyPressed(e, codeName, this.buffer, this.activeElement);
      // Buffer will be reset by the orchestrator if a match is found, or we can reset it here.
      // Actually, space might be part of exact match string? No, trigger key means end of word.
      this.buffer = ''; 
      return;
    }

    // Handle regular characters
    if (key.length === 1) { // Normal printable char
      this.buffer += key;
      if (this.buffer.length > this.MAX_BUFFER_SIZE) {
        this.buffer = this.buffer.slice(-this.MAX_BUFFER_SIZE);
      }
      this.onCharTyped(e, this.buffer, this.activeElement);
    } else if (key === 'Backspace') {
      this.buffer = this.buffer.slice(0, -1);
    } else {
      // Navigation keys or other modifiers might break the current "word"
      // We clear buffer if they move cursor (ArrowKeys, PageUp, etc.)
      if (key.startsWith('Arrow') || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown') {
        this.buffer = '';
      }
    }
  }

  // Allow trigger callback to access the event to preventDefault
  // Let's modify the class to pass KeyboardEvent instead of just the key string
}
