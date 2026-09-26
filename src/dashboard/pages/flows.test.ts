/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FlowsPage from './flows.js';
import { storage } from '../../shared/storage/StorageService.js';
import { setLanguage } from '../../shared/i18n/index.js';
import { showToast } from '../../shared/components/Toast.js';
import type { Flow } from '../../shared/types/index.js';
import { isComplexFlow } from '../../shared/utils/flowSummary.js';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: { query: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../shared/components/Toast.js', () => ({
  showToast: vi.fn(),
}));

const mockFlows: Flow[] = [
  {
    id: 'flow-1',
    name: '/hello',
    enabled: true,
    folderId: 'folder-work',
    createdAt: 1000,
    updatedAt: 2000,
    stats: { usageCount: 5, lastUsed: 2000 },
    blocks: [
      { id: 'b1', type: 'trigger', data: { shortcut: 'hello' } as any },
      { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'Hello World', tokens: [] } as any },
    ],
  },
  {
    id: 'flow-2',
    name: '/bye',
    enabled: false,
    folderId: undefined,
    createdAt: 1100,
    updatedAt: 2100,
    stats: { usageCount: 2, lastUsed: 2100 },
    blocks: [
      { id: 'b3', type: 'trigger', data: { shortcut: 'bye' } as any },
      { id: 'b4', type: 'action', data: { format: 'plaintext', content: 'Goodbye', tokens: [] } as any },
    ],
  },
];

const mockFolders = [
  { id: 'folder-work', name: 'Work', color: '#3b82f6', order: 0 },
];

vi.mock('../../shared/storage/StorageService.js', () => ({
  storage: {
    getFlows: vi.fn().mockResolvedValue([]),
    getFolders: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({
      triggerMode: 'exact_match',
      exactMatchChar: '/',
      theme: 'dark',
      language: 'pt-BR',
    }),
    saveFlow: vi.fn().mockResolvedValue(undefined),
    deleteFlow: vi.fn().mockResolvedValue(undefined),
    saveFolder: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('FlowsPage — Selective Export & Import', () => {
  let page: FlowsPage;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.querySelector('#app') as HTMLDivElement;
    setLanguage('pt-BR');

    vi.mocked(storage.getFlows).mockResolvedValue(JSON.parse(JSON.stringify(mockFlows)));
    vi.mocked(storage.getFolders).mockResolvedValue(JSON.parse(JSON.stringify(mockFolders)));
    vi.mocked(storage.getVariables).mockResolvedValue([]);

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    page = new FlowsPage();
    container.appendChild(page.render());
  });

  afterEach(() => {
    page.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders table with select-all checkbox, row checkboxes, and export/import buttons', async () => {
    await page.mount();

    const exportBtn = container.querySelector('#flows-export-btn') as HTMLButtonElement;
    const importBtn = container.querySelector('#flows-import-btn') as HTMLButtonElement;
    const selectAll = container.querySelector('#flows-select-all') as HTMLInputElement;

    expect(exportBtn).not.toBeNull();
    expect(importBtn).not.toBeNull();
    expect(selectAll).not.toBeNull();

    const rowCheckboxes = container.querySelectorAll<HTMLInputElement>('.flow-row-checkbox');
    expect(rowCheckboxes.length).toBe(2);
  });

  it('checking a row checkbox updates selection and export button label', async () => {
    await page.mount();

    const rowCheckboxes = container.querySelectorAll<HTMLInputElement>('.flow-row-checkbox');
    const exportLabel = container.querySelector('#flows-export-label') as HTMLElement;

    expect(exportLabel.textContent).toContain('Exportar Selecionados');

    // Select first flow
    rowCheckboxes[0].checked = true;
    rowCheckboxes[0].dispatchEvent(new Event('change'));

    expect(exportLabel.textContent).toContain('1');

    // Select second flow
    rowCheckboxes[1].checked = true;
    rowCheckboxes[1].dispatchEvent(new Event('change'));

    expect(exportLabel.textContent).toContain('2');

    // Unselect first flow
    rowCheckboxes[0].checked = false;
    rowCheckboxes[0].dispatchEvent(new Event('change'));

    expect(exportLabel.textContent).toContain('1');
  });

  it('Select All checkbox selects and deselects all rows', async () => {
    await page.mount();

    const selectAll = container.querySelector('#flows-select-all') as HTMLInputElement;
    const exportLabel = container.querySelector('#flows-export-label') as HTMLElement;

    selectAll.checked = true;
    selectAll.dispatchEvent(new Event('change'));

    expect(exportLabel.textContent).toContain('2');
    const checkedRows = container.querySelectorAll<HTMLInputElement>('.flow-row-checkbox:checked');
    expect(checkedRows.length).toBe(2);

    selectAll.checked = false;
    selectAll.dispatchEvent(new Event('change'));

    expect(exportLabel.textContent).not.toContain('(');
  });

  it('Export: exports selected flows when rows are checked', async () => {
    await page.mount();

    const rowCheckboxes = container.querySelectorAll<HTMLInputElement>('.flow-row-checkbox');
    rowCheckboxes[0].checked = true;
    rowCheckboxes[0].dispatchEvent(new Event('change'));

    let clickedAnchor: HTMLAnchorElement | null = null;
    const originalAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if ((node as HTMLElement).tagName === 'A') {
        clickedAnchor = node as HTMLAnchorElement;
      }
      return originalAppend(node);
    });

    const exportBtn = container.querySelector('#flows-export-btn') as HTMLButtonElement;
    exportBtn.click();

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickedAnchor).not.toBeNull();
    expect(clickedAnchor!.download).toContain('sote-flows-');
  });

  it('Import: imports flows, prevents duplicate IDs and shortcuts, and shows toast feedback', async () => {
    await page.mount();

    const importInput = container.querySelector('#flows-import-input') as HTMLInputElement;

    // Create a mock JSON with 1 duplicate ID, 1 duplicate shortcut, and 1 new flow
    const fileContent = JSON.stringify({
      version: 2,
      flows: [
        // Duplicate ID
        {
          id: 'flow-1',
          name: '/dup-id',
          blocks: [
            { id: 'b1', type: 'trigger', data: { shortcut: 'new-sc' } },
            { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'test', tokens: [] } },
          ],
        },
        // Duplicate Shortcut ('bye')
        {
          id: 'flow-new-id',
          name: '/bye',
          blocks: [
            { id: 'b3', type: 'trigger', data: { shortcut: 'bye' } },
            { id: 'b4', type: 'action', data: { format: 'plaintext', content: 'test', tokens: [] } },
          ],
        },
        // Brand new flow
        {
          id: 'flow-3',
          name: '/brandnew',
          blocks: [
            { id: 'b5', type: 'trigger', data: { shortcut: 'brandnew' } },
            { id: 'b6', type: 'action', data: { format: 'plaintext', content: 'Brand new flow content', tokens: [] } },
          ],
        },
      ],
    });

    const file = new File([fileContent], 'import.json', { type: 'application/json' });
    Object.defineProperty(importInput, 'files', {
      value: [file],
      writable: true,
    });

    // Mock FileReader
    class MockFileReader {
      onload: any = null;
      readAsText() {
        setTimeout(() => {
          this.onload?.({ target: { result: fileContent } });
        }, 10);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    importInput.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));

    // Only flow-3 should be saved
    expect(storage.saveFlow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(storage.saveFlow).mock.calls[0][0].id).toBe('flow-3');

    // Toast feedback: 1 imported, 2 skipped
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('1'),
      'success'
    );
  });

  it('renders stats above actions bar and does not render workspace card', async () => {
    await page.mount();

    const stats = container.querySelector('#flows-stats-container');
    const actions = container.querySelector('.flows-header-actions');
    const workspaceCard = container.querySelector('#flows-workspace-card');

    expect(stats).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(workspaceCard).toBeNull();

    // Verify stats comes before actions in DOM order
    expect(stats!.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('filters flows by status using the filters dropdown', async () => {
    await page.mount();

    const filtersBtn = container.querySelector('#flows-filters-btn') as HTMLButtonElement;
    const dropdown = container.querySelector('#flows-filters-dropdown') as HTMLElement;

    expect(dropdown.style.display).toBe('none');
    filtersBtn.click();
    expect(dropdown.style.display).toBe('');

    // Initially both flows (flow-1 active, flow-2 inactive) rendered
    let rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(2);

    // Filter by Active
    const activeBtn = dropdown.querySelector('[data-status="active"]') as HTMLButtonElement;
    activeBtn.click();

    rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('/hello');

    // Filter by Inactive
    const inactiveBtn = dropdown.querySelector('[data-status="inactive"]') as HTMLButtonElement;
    inactiveBtn.click();

    rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('/bye');

    // Filter by All
    const allBtn = dropdown.querySelector('[data-status="all"]') as HTMLButtonElement;
    allBtn.click();

    rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(2);
  });

  it('refresh button re-fetches flows from storage and shows toast feedback', async () => {
    await page.mount();

    const refreshBtn = container.querySelector('#flows-refresh-btn') as HTMLButtonElement;
    expect(refreshBtn).not.toBeNull();

    // Mock storage returning an additional flow on refresh
    const updatedFlows = [
      ...mockFlows,
      {
        id: 'flow-refreshed',
        name: '/refreshed',
        enabled: true,
        blocks: [
          { id: 'br1', type: 'trigger', data: { shortcut: 'refreshed' } as any },
          { id: 'br2', type: 'action', data: { format: 'plaintext', content: 'Refreshed', tokens: [] } as any },
        ],
        createdAt: 3000,
        updatedAt: 3000,
        stats: { usageCount: 0 },
      },
    ];
    vi.mocked(storage.getFlows).mockResolvedValue(updatedFlows as any);

    refreshBtn.click();
    await new Promise(r => setTimeout(r, 100));

    expect(storage.getFlows).toHaveBeenCalled();
    const rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(3);
    expect(showToast).toHaveBeenCalled();
  });

  it('isComplexFlow: correctly classifies simple vs complex flows', () => {
    // 1. Simple flow: pure text
    const simpleFlow: Flow = {
      id: 'f1',
      name: '/a1',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      stats: { usageCount: 0 },
      blocks: [
        { id: 't1', type: 'trigger', data: { shortcut: 'a1' } as any },
        { id: 'b1', type: 'action', data: { format: 'plaintext', content: 'código simples', tokens: [] } as any },
      ],
    };
    expect(isComplexFlow(simpleFlow)).toBe(false);

    // 2. Simple flow: simple variable substitution with fallback
    const varFlow: Flow = {
      id: 'f2',
      name: '/a2',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      stats: { usageCount: 0 },
      blocks: [
        { id: 't2', type: 'trigger', data: { shortcut: 'a2' } as any },
        { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'Olá {{CLIENTE|Amigo}}', tokens: [] } as any },
      ],
    };
    expect(isComplexFlow(varFlow)).toBe(false);

    // 3. Complex flow: RepeatBlock
    const repeatFlow: Flow = {
      id: 'f3',
      name: '/qq3',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      stats: { usageCount: 0 },
      blocks: [
        { id: 't3', type: 'trigger', data: { shortcut: 'qq3' } as any },
        {
          id: 'b3',
          type: 'action',
          data: {
            type: 'repeat',
            count: 2,
            separator: '\n',
            target: { format: 'plaintext', content: 'bloco', tokens: [] },
          } as any,
        },
      ],
    };
    expect(isComplexFlow(repeatFlow)).toBe(true);

    // 4. Complex flow: ConditionBlock
    const condFlow: Flow = {
      id: 'f4',
      name: '/cond',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      stats: { usageCount: 0 },
      blocks: [
        { id: 't4', type: 'trigger', data: { shortcut: 'cond' } as any },
        {
          id: 'b4',
          type: 'condition',
          data: { rules: [] } as any,
        },
      ],
    };
    expect(isComplexFlow(condFlow)).toBe(true);

    // 5. Complex flow: RandomBlock
    const randomFlow: Flow = {
      id: 'f5',
      name: '/random',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      stats: { usageCount: 0 },
      blocks: [
        { id: 't5', type: 'trigger', data: { shortcut: 'random' } as any },
        {
          id: 'b5',
          type: 'action',
          data: {
            type: 'random',
            options: [{ id: '1', weight: 100, target: { format: 'plaintext', content: 'opt', tokens: [] } }],
          } as any,
        },
      ],
    };
    expect(isComplexFlow(randomFlow)).toBe(true);

    // 6. Complex flow: dynamic token (counter, math, etc)
    const tokenFlow: Flow = {
      id: 'f6',
      name: '/counter',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
      stats: { usageCount: 0 },
      blocks: [
        { id: 't6', type: 'trigger', data: { shortcut: 'counter' } as any },
        {
          id: 'b6',
          type: 'action',
          data: {
            format: 'plaintext',
            content: 'Contagem',
            tokens: [{ id: 'c1', type: 'counter', config: { start: 1, step: 1 } }],
          } as any,
        },
      ],
    };
    expect(isComplexFlow(tokenFlow)).toBe(true);
  });

  it('renders text preview for simple flows and "Visualizar" button for complex flows (exclusive)', async () => {
    const mixedFlows: Flow[] = [
      {
        id: 'flow-simple-1',
        name: '/a1',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        stats: { usageCount: 10 },
        blocks: [
          { id: 't1', type: 'trigger', data: { shortcut: 'a1' } as any },
          { id: 'b1', type: 'action', data: { format: 'plaintext', content: 'código 1', tokens: [] } as any },
        ],
      },
      {
        id: 'flow-simple-2',
        name: '/a2',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        stats: { usageCount: 9 },
        blocks: [
          { id: 't2', type: 'trigger', data: { shortcut: 'a2' } as any },
          { id: 'b2', type: 'action', data: { format: 'plaintext', content: 'Olá {{NOME}}', tokens: [] } as any },
        ],
      },
      {
        id: 'flow-complex-repeat',
        name: '/qq3',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        stats: { usageCount: 8 },
        blocks: [
          { id: 't3', type: 'trigger', data: { shortcut: 'qq3' } as any },
          {
            id: 'b3',
            type: 'action',
            data: {
              type: 'repeat',
              count: 2,
              separator: '\n',
              target: { format: 'plaintext', content: 'repetido', tokens: [] },
            } as any,
          },
        ],
      },
      {
        id: 'flow-complex-cond',
        name: '/se',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        stats: { usageCount: 7 },
        blocks: [
          { id: 't4', type: 'trigger', data: { shortcut: 'se' } as any },
          {
            id: 'b4',
            type: 'condition',
            data: {
              rules: [
                {
                  id: 'r1',
                  type: 'domain',
                  operator: 'equals',
                  value: 'site.com',
                  action: { format: 'plaintext', content: 'Condição ativa', tokens: [] },
                },
              ],
            } as any,
          },
        ],
      },
    ];

    vi.mocked(storage.getFlows).mockResolvedValue(mixedFlows);
    vi.mocked(storage.getVariables).mockResolvedValue([
      { id: 'v1', key: 'NOME', value: 'Mariana', createdAt: 0, updatedAt: 0 },
    ]);

    await page.mount();

    const rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(4);

    // Row 0 (/a1 - simple): has .row-preview, NO .btn-preview-modal
    const row0 = rows[0];
    const preview0 = row0.querySelector('.row-preview');
    const btn0 = row0.querySelector('.btn-preview-modal');
    expect(preview0).not.toBeNull();
    expect(preview0?.textContent).toBe('código 1');
    expect(btn0).toBeNull();

    // Row 1 (/a2 - simple with var): has .row-preview, NO .btn-preview-modal
    const row1 = rows[1];
    const preview1 = row1.querySelector('.row-preview');
    const btn1 = row1.querySelector('.btn-preview-modal');
    expect(preview1).not.toBeNull();
    expect(preview1?.textContent).toBe('Olá Mariana');
    expect(btn1).toBeNull();

    // Row 2 (/qq3 - complex RepeatBlock): has .btn-preview-modal, NO .row-preview
    const row2 = rows[2];
    const preview2 = row2.querySelector('.row-preview');
    const btn2 = row2.querySelector('.btn-preview-modal');
    expect(preview2).toBeNull();
    expect(btn2).not.toBeNull();
    expect(btn2?.textContent).toContain('Visualizar');
    expect(btn2?.getAttribute('title')).toBe('Ver prévia completa');
    expect(btn2?.querySelector('svg')).not.toBeNull();

    // Row 3 (/se - complex ConditionBlock): has .btn-preview-modal, NO .row-preview
    const row3 = rows[3];
    const preview3 = row3.querySelector('.row-preview');
    const btn3 = row3.querySelector('.btn-preview-modal');
    expect(preview3).toBeNull();
    expect(btn3).not.toBeNull();
    expect(btn3?.textContent).toContain('Visualizar');
    expect(btn3?.getAttribute('title')).toBe('Ver prévia completa');
    expect(btn3?.querySelector('svg')).not.toBeNull();
  });

  it('clicking the preview button opens PreviewModal for the specific flow', async () => {
    const complexFlows: Flow[] = [
      {
        id: 'flow-qq3',
        name: '/qq3',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        stats: { usageCount: 5 },
        blocks: [
          { id: 't_qq3', type: 'trigger', data: { shortcut: 'qq3' } as any },
          {
            id: 'b_qq3',
            type: 'action',
            data: {
              type: 'repeat',
              count: 2,
              separator: '\n',
              target: { format: 'plaintext', content: 'bloco repetido', tokens: [] },
            } as any,
          },
        ],
      },
      {
        id: 'flow-se',
        name: '/se',
        enabled: true,
        createdAt: 1000,
        updatedAt: 1000,
        stats: { usageCount: 4 },
        blocks: [
          { id: 't_se', type: 'trigger', data: { shortcut: 'se' } as any },
          {
            id: 'b_se',
            type: 'action',
            data: { format: 'plaintext', content: 'Texto Se', tokens: [{ id: 'c1', type: 'counter', config: {} }] } as any,
          },
        ],
      },
    ];

    vi.mocked(storage.getFlows).mockResolvedValue(complexFlows);
    await page.mount();

    const rows = container.querySelectorAll('.flow-row');
    expect(rows.length).toBe(2);

    // 1. Click button for /qq3
    const btnQQ3 = rows[0].querySelector<HTMLButtonElement>('.btn-preview-modal');
    expect(btnQQ3).not.toBeNull();
    btnQQ3!.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    let backdrop = document.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    const titleQQ3 = backdrop!.querySelector('.preview-header-title');
    expect(titleQQ3?.textContent).toBe('/qq3');
    // Ensure RepeatBlock card is present in tree
    expect(backdrop!.querySelector('.preview-card--repeat')).not.toBeNull();

    // Close modal
    const closeBtnQQ3 = backdrop!.querySelector<HTMLButtonElement>('.preview-close-btn');
    closeBtnQQ3?.click();
    expect(document.querySelector('.modal-backdrop')).toBeNull();

    // 2. Click button for /se
    const btnSE = rows[1].querySelector<HTMLButtonElement>('.btn-preview-modal');
    expect(btnSE).not.toBeNull();
    btnSE!.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    backdrop = document.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    const titleSE = backdrop!.querySelector('.preview-header-title');
    expect(titleSE?.textContent).toBe('/se');

    // Close modal
    const closeBtnSE = backdrop!.querySelector<HTMLButtonElement>('.preview-close-btn');
    closeBtnSE?.click();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });
});

