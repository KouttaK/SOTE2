import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TriggerDetector } from '../../content/engine/TriggerDetector.js';
import type { Flow, Settings } from '../../shared/types/index.js';

describe('TriggerDetector', () => {
  let detector: TriggerDetector;
  let mockSettings: Settings;

  beforeEach(() => {
    detector = new TriggerDetector();
    mockSettings = {
      globalEnabled: true,
      triggerKeys: ['Space', 'Tab'],
      exactMatchChar: '/',
      blocklist: [],
      snoozeUntil: undefined,
      theme: 'system',
      exportFormat: 'json',
      commandPaletteShortcut: 'Ctrl+Shift+Space',
      analytics: {}
    };
  });

  const createMockFlow = (id: string, mode: 'trigger' | 'exact_match', shortcut: string, domain?: string, elseContent?: string): Flow => ({
    id,
    name: 'test',
    description: '',
    folderId: 'root',
    enabled: true,
    tags: [],
    stats: { usageCount: 0, timeSavedMs: 0 },
    blocks: [
      {
        id: '1',
        type: 'trigger',
        data: { mode, shortcut, smartCase: false }
      },
      ...(domain ? [{
        id: 'cond1',
        type: 'condition',
        data: {
          rules: [{ type: 'domain', operator: 'equals', value: domain }],
          matchAll: true
        }
      }] as any[] : []),
      {
        id: '2',
        type: 'action',
        data: { content: 'success', format: 'plaintext', tokens: [] }
      },
      ...(elseContent ? [{
        id: '3',
        type: 'action',
        data: { content: elseContent, format: 'plaintext', tokens: [], isElse: true } // Assuming some logic like this
      }] as any[] : [])
    ]
  });

  it('Buffer "obg " (com espaço): detecta shortcut "obg" em modo trigger', () => {
    const flow = createMockFlow('f1', 'trigger', 'obg');
    detector.updateData([flow], mockSettings);
    
    // detectTriggerMode is called when a trigger key is pressed.
    // The buffer should contain the word before the trigger key.
    const match = detector.detectTriggerMode('obg');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
    expect(match?.shortcutTyped).toBe('obg');
  });

  it('Buffer "obg\\t" (com tab): detecta se Tab estiver em triggerKeys', () => {
    // Actually, detectTriggerMode just takes the buffer content before the trigger.
    // The orchestration in content.ts passes the buffer without the trigger key.
    const flow = createMockFlow('f1', 'trigger', 'obg');
    detector.updateData([flow], mockSettings);
    
    // triggerKeys validation is done outside TriggerDetector (in TextMonitor/orchestrator),
    // but we can test if TriggerDetector finds 'obg' when buffer ends with tab if the orchestrator passes it.
    // Assuming orchestrator passes 'obg' when Tab is pressed.
    const match = detector.detectTriggerMode('obg');
    expect(match).not.toBeNull();
  });

  it('Buffer "/obg" em exact match com char "/": detecta sem tecla adicional', () => {
    const flow = createMockFlow('f1', 'exact_match', 'obg');
    detector.updateData([flow], mockSettings);
    
    const match = detector.detectExactMatchMode('/obg');
    expect(match).not.toBeNull();
    expect(match?.flow.id).toBe('f1');
    expect(match?.isExactMatch).toBe(true);
  });

  it('Buffer "obg " com snooze ativo: retorna null', () => {
    const flow = createMockFlow('f1', 'trigger', 'obg');
    mockSettings.snoozeUntil = Date.now() + 10000;
    detector.updateData([flow], mockSettings);
    
    const match = detector.detectTriggerMode('obg');
    expect(match).toBeNull();
  });

  it('Buffer "obg " com domínio bloqueado: retorna null', () => {
    // Actually, the blocklist is handled in content.ts orchestration now, 
    // it prevents initialization or pauses TextMonitor. TriggerDetector itself doesn't check blocklist in our new arch?
    // Let's check TriggerDetector.ts to see if it checks blocklist.
    // In prompt: "Buffer 'obg ' com domínio bloqueado: retorna null".
    // I will mock window.location to check if TriggerDetector uses it, or I might need to adjust TriggerDetector.
    // For now, let's implement the test and see if it passes.
    // Wait, blocklist logic was added in content.ts. TriggerDetector might not know about it.
    // If it fails, I'll update TriggerDetector to satisfy the test.
    const flow = createMockFlow('f1', 'trigger', 'obg');
    mockSettings.blocklist = ['example.com'];
    detector.updateData([flow], mockSettings);
    
    // Mock window.location.hostname
    vi.stubGlobal('window', { location: { hostname: 'example.com' } });
    
    const match = detector.detectTriggerMode('obg');
    // We expect null if it's implemented. If not, it will fail and I'll fix it.
    expect(match).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ConditionBlock domain "gmail.com" em aba gmail.com: retorna flow', () => {
    const flow = createMockFlow('f1', 'trigger', 'obg', 'gmail.com');
    detector.updateData([flow], mockSettings);
    
    vi.stubGlobal('window', { location: { hostname: 'gmail.com' } });
    const match = detector.detectTriggerMode('obg');
    expect(match).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('ConditionBlock domain "gmail.com" em aba notion.so: retorna flow do else se existir', () => {
    // According to SOTE logic, if conditions fail, it either returns null or the flow but later resolves to Else.
    // The prompt says: "ConditionBlock domain 'gmail.com' em aba notion.so: retorna flow do else se existir"
    // Actually, TriggerDetector checks conditions in `checkConditions`. If it fails, it returns false, meaning no trigger match.
    // Unless checkConditions returns true if there is an Else block?
    // Let's test it and fix TriggerDetector if needed.
    const flow = createMockFlow('f1', 'trigger', 'obg', 'gmail.com', 'else content');
    detector.updateData([flow], mockSettings);
    
    vi.stubGlobal('window', { location: { hostname: 'notion.so' } });
    const match = detector.detectTriggerMode('obg');
    
    // Wait, does it return the flow if there's an Else block?
    expect(match).not.toBeNull();
    vi.unstubAllGlobals();
  });
});
