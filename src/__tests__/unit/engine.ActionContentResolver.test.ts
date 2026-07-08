import { describe, it, expect, vi } from 'vitest';
import { resolveActionBlockContent } from '../../content/engine/ActionContentResolver.js';
import type { ActionBlock, Variable } from '../../shared/types/index.js';
import type { ChoicePopup } from '../../content/engine/ChoicePopup.js';

function fakeChoicePopup(returnValue: string | null): ChoicePopup {
  return { showForToken: vi.fn().mockResolvedValue(returnValue) } as unknown as ChoicePopup;
}

describe('resolveActionBlockContent', () => {
  const element = document.createElement('textarea');
  const context = { tabUrl: 'https://example.com', tabTitle: 'Example' };

  it('returns plain content unchanged when there are no tokens', async () => {
    const actionBlock: ActionBlock = { format: 'plaintext', content: 'Bom dia!', tokens: [] };
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables: [],
      context,
    });
    expect(result).toEqual({ content: 'Bom dia!', cursorOffset: null });
  });

  it('resolves {{VARIABLE}} placeholders against the given Variables list', async () => {
    const actionBlock: ActionBlock = { format: 'plaintext', content: 'Olá, {{NOME}}!', tokens: [] };
    const variables: Variable[] = [{ id: 'v1', key: 'NOME', value: 'Maria', updatedAt: 0 }];
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables,
      context,
    });
    expect(result?.content).toBe('Olá, Maria!');
  });

  it('leaves an unknown {{VARIABLE}} untouched (no silent swallow)', async () => {
    const actionBlock: ActionBlock = { format: 'plaintext', content: 'Olá, {{DESCONHECIDA}}!', tokens: [] };
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables: [],
      context,
    });
    expect(result?.content).toBe('Olá, {{DESCONHECIDA}}!');
  });

  it('escapes variable values in richtext content', async () => {
    const actionBlock: ActionBlock = { format: 'richtext', content: '<p>{{BIO}}</p>', tokens: [] };
    const variables: Variable[] = [{ id: 'v1', key: 'BIO', value: 'a <b>&</b> co', updatedAt: 0 }];
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables,
      context,
    });
    expect(result?.content).toBe('<p>a &lt;b&gt;&amp;&lt;/b&gt; co</p>');
  });

  it('resolves a url token', async () => {
    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: 'Link: <span class="token-pill token-url" data-token-id="t1"></span>',
      tokens: [{ id: 't1', type: 'url', config: {} }],
    };
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables: [],
      context,
    });
    expect(result?.content).toBe('Link: https://example.com');
  });

  it('places a cursor token and reports its plain-text offset, stripping the marker', async () => {
    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: 'Olá, <span class="token-pill token-cursor" data-token-id="c1"></span> tudo bem?',
      tokens: [{ id: 'c1', type: 'cursor', config: {} }],
    };
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables: [],
      context,
    });
    expect(result?.content).toBe('Olá,  tudo bem?');
    expect(result?.cursorOffset).toBe('Olá, '.length);
  });

  it('awaits the ChoicePopup for a choice token and inserts the chosen value', async () => {
    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: 'Status: <span class="token-pill token-choice" data-token-id="ch1" data-token-config=\'{"options":["A","B"]}\'></span>',
      tokens: [{ id: 'ch1', type: 'choice', config: { options: ['A', 'B'] } }],
    };
    const choicePopup = fakeChoicePopup('B');
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup,
      variables: [],
      context,
    });
    expect(choicePopup.showForToken).toHaveBeenCalled();
    expect(result?.content).toBe('Status: B');
  });

  it('returns null (cancelled) when the ChoicePopup resolves null', async () => {
    const actionBlock: ActionBlock = {
      format: 'plaintext',
      content: 'Status: <span class="token-pill token-choice" data-token-id="ch1"></span>',
      tokens: [{ id: 'ch1', type: 'choice', config: { options: ['A', 'B'] } }],
    };
    const result = await resolveActionBlockContent(actionBlock, element, {
      choicePopup: fakeChoicePopup(null),
      variables: [],
      context,
    });
    expect(result).toBeNull();
  });
});
