import { sanitizeHtml } from './sanitizeHtml.js';
import { escapeHtml } from './dom.js';
import type { StorageSchema, Flow, Variable, Folder, Form, Settings, Block, TriggerBlock, ActionBlock, ConditionBlock, RandomBlock, Token } from '../types/index.js';

export interface ImportValidationResult {
  valid: boolean;
  data?: Partial<StorageSchema>;
  rejectedFlowsCount: number;
  acceptedFlowsCount: number;
  errors: string[];
}

function isSafeObject(obj: any, depth = 0): boolean {
  if (depth > 100) return false; // Prevents generic deep nesting call stack DoS
  if (obj === null || typeof obj !== 'object') return true;
  if (Array.isArray(obj)) return obj.every(item => isSafeObject(item, depth + 1));
  
  const ownKeys = Object.getOwnPropertyNames(obj);
  for (const key of ownKeys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
    if (!isSafeObject(obj[key], depth + 1)) return false;
  }
  return true;
}

function stripUnknown(obj: any, allowedKeys: string[]): any {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = {};
  for (const key of allowedKeys) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export function validateToken(token: any): Token | null {
  if (!token || typeof token !== 'object') return null;
  if (typeof token.id !== 'string' || typeof token.type !== 'string') return null;

  const id = escapeHtml(token.id.slice(0, 50));
  const type = token.type as Token['type'];
  let config: Record<string, unknown> = {};

  if (token.config && typeof token.config === 'object' && !Array.isArray(token.config)) {
    const rawConfig = token.config;
    if (Array.isArray(rawConfig.options)) {
      config.options = rawConfig.options.map((opt: any) => {
        if (typeof opt === 'string') return sanitizeHtml(opt);
        if (opt && typeof opt === 'object') {
          const sanitizedOpt: Record<string, any> = {};
          if (typeof opt.id === 'string') sanitizedOpt.id = escapeHtml(opt.id.slice(0, 50));
          if (typeof opt.text === 'string') sanitizedOpt.text = sanitizeHtml(opt.text);
          if (typeof opt.value === 'string') sanitizedOpt.value = sanitizeHtml(opt.value);
          if (typeof opt.label === 'string') sanitizedOpt.label = escapeHtml(opt.label.slice(0, 200));
          if (typeof opt.weight === 'number') sanitizedOpt.weight = opt.weight;
          return sanitizedOpt;
        }
        return opt;
      });
    }
    if (typeof rawConfig.label === 'string') config.label = escapeHtml(rawConfig.label.slice(0, 200));
    if (typeof rawConfig.placeholder === 'string') config.placeholder = escapeHtml(rawConfig.placeholder.slice(0, 200));
    if (typeof rawConfig.defaultValue === 'string') config.defaultValue = sanitizeHtml(rawConfig.defaultValue);
    if (typeof rawConfig.flowLabel === 'string') config.flowLabel = escapeHtml(rawConfig.flowLabel.slice(0, 200));
    if (typeof rawConfig.flowId === 'string') config.flowId = escapeHtml(rawConfig.flowId.slice(0, 50));
    if (typeof rawConfig.format === 'string') config.format = escapeHtml(rawConfig.format.slice(0, 50));
    if (typeof rawConfig.multiline === 'boolean') config.multiline = rawConfig.multiline;
    if (typeof rawConfig.required === 'boolean') config.required = rawConfig.required;
    if (typeof rawConfig.start === 'number') config.start = rawConfig.start;
    if (typeof rawConfig.step === 'number') config.step = rawConfig.step;
    if (typeof rawConfig.padLength === 'number') config.padLength = rawConfig.padLength;
    if (typeof rawConfig.current === 'number') config.current = rawConfig.current;
    if (typeof rawConfig.expression === 'string') config.expression = escapeHtml(rawConfig.expression.slice(0, 200));
  }

  const res: any = { id, type, config };
  if (token.pos && typeof token.pos.x === 'number' && typeof token.pos.y === 'number') {
    res.pos = { x: token.pos.x, y: token.pos.y };
  }
  return res;
}

function validateActionBlock(action: any): ActionBlock | null {
  if (!action || typeof action !== 'object') return null;
  const format = action.format === 'richtext' ? 'richtext' : 'plaintext';
  
  // Type confusion defense: if content is not a string (e.g. an object), default to empty string
  let content = typeof action.content === 'string' ? action.content : '';
  if (content.length > 500000) return null; // 500kb limit
  
  content = sanitizeHtml(content);

  const tokens = Array.isArray(action.tokens) ? action.tokens : [];
  const validTokens = tokens
    .map((t: any) => validateToken(t))
    .filter((t: any): t is Token => t !== null);

  const res: ActionBlock = { format, content, tokens: validTokens };
  if (action.pos && typeof action.pos.x === 'number' && typeof action.pos.y === 'number') {
    res.pos = { x: action.pos.x, y: action.pos.y };
  }
  return res;
}

function validateConditionBlock(target: any, depth = 0): ConditionBlock | null {
  if (!target || typeof target !== 'object') return null;
  if (depth > 20) return null;
  if (!Array.isArray(target.rules)) return null;

  const rules = target.rules.map((rule: any) => {
    if (!rule || typeof rule !== 'object') return null;
    const action = validateBranchTarget(rule.action, depth + 1);
    if (!action) return null;

    const type = typeof rule.type === 'string' ? escapeHtml(rule.type.slice(0, 50)) : 'domain';
    const operator = typeof rule.operator === 'string' ? escapeHtml(rule.operator.slice(0, 50)) : 'equals';
    const value = typeof rule.value === 'string' ? escapeHtml(rule.value.slice(0, 500)) : '';
    const criteria = Array.isArray(rule.criteria)
      ? rule.criteria.map((c: any) => stripUnknown(c, ['id', 'type', 'operator', 'value']))
      : [];
    const combinator = rule.combinator === 'OR' ? 'OR' : 'AND';

    return {
      id: typeof rule.id === 'string' ? escapeHtml(rule.id.slice(0, 50)) : crypto.randomUUID(),
      type,
      operator,
      value,
      action,
      criteria,
      combinator
    };
  }).filter((r: any) => r !== null);

  const res: ConditionBlock = {
    rules,
    elseBranch: target.elseBranch ? validateBranchTarget(target.elseBranch, depth + 1) : undefined
  };
  if (target.pos && typeof target.pos.x === 'number' && typeof target.pos.y === 'number') {
    (res as any).pos = { x: target.pos.x, y: target.pos.y };
  }
  return res;
}

function validateBranchTarget(target: any, depth = 0): any {
  if (!target || typeof target !== 'object') return null;
  if (depth > 20) return null; // Depth limit (DoS protection against deep recursion)

  if (target.type === 'random') {
    const validOptions = (Array.isArray(target.options) ? target.options : []).map((opt: any) => ({
      id: typeof opt.id === 'string' ? escapeHtml(opt.id.slice(0, 50)) : crypto.randomUUID(),
      weight: typeof opt.weight === 'number' ? opt.weight : 0,
      target: validateBranchTarget(opt.target, depth + 1)
    })).filter((opt: any) => opt.target !== null);
    
    if (validOptions.length === 0) return null;
    const res: any = { type: 'random', options: validOptions };
    if (target.pos && typeof target.pos.x === 'number' && typeof target.pos.y === 'number') {
      res.pos = { x: target.pos.x, y: target.pos.y };
    }
    return res;
  }

  if (target.type === 'repeat') {
    const count = typeof target.count === 'number' ? Math.max(1, Math.min(100, Math.floor(target.count))) : 1;
    const validTarget = validateBranchTarget(target.target, depth + 1);
    if (!validTarget) return null;
    const res: any = {
      type: 'repeat',
      count,
      separator: typeof target.separator === 'string' ? target.separator : '',
      target: validTarget,
    };
    if (target.pos && typeof target.pos.x === 'number' && typeof target.pos.y === 'number') {
      res.pos = { x: target.pos.x, y: target.pos.y };
    }
    return res;
  }
  
  if (Array.isArray(target.rules)) {
    return validateConditionBlock(target, depth);
  }

  return validateActionBlock(target);
}

function validateTriggerBlock(data: any): TriggerBlock | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.shortcut !== 'string' || !data.shortcut.trim()) return null;
  const res: any = {
    shortcut: escapeHtml(data.shortcut.slice(0, 100)),
    smartCase: typeof data.smartCase === 'boolean' ? data.smartCase : true,
    forceCapitalize: typeof data.forceCapitalize === 'boolean' ? data.forceCapitalize : false,
  };
  if (typeof data.mode === 'string') {
    res.mode = escapeHtml(data.mode.slice(0, 20));
  }
  return res;
}

function validateLegacyTrigger(trigger: any): any {
  if (!trigger || typeof trigger !== 'object') return undefined;
  const res: Record<string, any> = {};
  if (typeof trigger.type === 'string') res.type = escapeHtml(trigger.type.slice(0, 50));
  if (typeof trigger.value === 'string') res.value = escapeHtml(trigger.value.slice(0, 100));
  if (typeof trigger.matchMode === 'string') res.matchMode = escapeHtml(trigger.matchMode.slice(0, 50));
  if (typeof trigger.shortcut === 'string') res.shortcut = escapeHtml(trigger.shortcut.slice(0, 100));
  return res;
}

export function validateBlock(b: any): any | null {
  if (!b || typeof b !== 'object') return null;
  const id = typeof b.id === 'string' ? escapeHtml(b.id.slice(0, 50)) : crypto.randomUUID();

  // Canonical SOTE 2 block structure: { id, type, data }
  if (typeof b.type === 'string' && b.data !== undefined) {
    if (b.type === 'trigger') {
      const triggerData = validateTriggerBlock(b.data);
      if (!triggerData) return null;
      return { id, type: 'trigger', data: triggerData };
    }
    if (b.type === 'action') {
      const actionData = validateBranchTarget(b.data);
      if (!actionData) return null;
      return { id, type: 'action', data: actionData };
    }
    if (b.type === 'condition') {
      const condData = validateConditionBlock(b.data);
      if (!condData) return null;
      return { id, type: 'condition', data: condData };
    }
    return null;
  }

  // Legacy / test mock format: { id, trigger, action }
  if (b.trigger || b.action) {
    const validAction = validateBranchTarget(b.action);
    if (!validAction) return null;
    return {
      id,
      trigger: validateLegacyTrigger(b.trigger),
      action: validAction
    };
  }

  return null;
}

function validateFlow(flow: any, forceNewIds: boolean): Flow | null {
  if (!flow || typeof flow !== 'object') return null;
  if (typeof flow.id !== 'string' || typeof flow.name !== 'string') return null;

  const id = forceNewIds ? crypto.randomUUID() : escapeHtml(flow.id.slice(0, 50));
  const name = escapeHtml(flow.name.slice(0, 200));

  if (!Array.isArray(flow.blocks)) return null;

  const blocks = flow.blocks.map(validateBlock).filter((b: any) => b !== null);
  if (blocks.length === 0) return null;

  return {
    id,
    name,
    tags: Array.isArray(flow.tags) ? flow.tags.map((t: any) => escapeHtml(String(t).slice(0, 50))) : [],
    folderId: typeof flow.folderId === 'string' ? escapeHtml(flow.folderId.slice(0, 50)) : undefined,
    enabled: typeof flow.enabled === 'boolean' ? flow.enabled : true,
    createdAt: typeof flow.createdAt === 'number' ? flow.createdAt : Date.now(),
    updatedAt: typeof flow.updatedAt === 'number' ? flow.updatedAt : Date.now(),
    blocks,
    stats: {
      usageCount: typeof flow.stats?.usageCount === 'number' ? flow.stats.usageCount : 0,
      keysSaved: typeof flow.stats?.keysSaved === 'number' ? flow.stats.keysSaved : 0,
      failureCount: typeof flow.stats?.failureCount === 'number' ? flow.stats.failureCount : 0,
      lastUsed: typeof flow.stats?.lastUsed === 'number' ? flow.stats.lastUsed : undefined,
    }
  };
}

export function validateImport(jsonText: string, forceNewIds = false): ImportValidationResult {
  const result: ImportValidationResult = { valid: false, rejectedFlowsCount: 0, acceptedFlowsCount: 0, errors: [] };
  if (jsonText.length > 5 * 1024 * 1024) { result.errors.push('O arquivo excede 5MB.'); return result; }

  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    result.errors.push('JSON inválido.');
    return result;
  }
  if (!isSafeObject(data)) { result.errors.push('Prototype Pollution.'); return result; }
  if (!data || typeof data !== 'object') { result.errors.push('Estrutura principal inválida.'); return result; }
  
  if (Array.isArray(data)) {
    data = { flows: data };
  }
  
  const validData: Partial<StorageSchema> = {};
  
  if (Array.isArray(data.flows)) {
    if (data.flows.length > 1000) { result.errors.push('Máximo de 1000 flows excedido.'); return result; }
    const validatedFlows: Flow[] = [];
    for (const rawFlow of data.flows) {
      const v = validateFlow(rawFlow, forceNewIds);
      if (v) { validatedFlows.push(v); result.acceptedFlowsCount++; } else { result.rejectedFlowsCount++; }
    }
    validData.flows = validatedFlows;
  } else {
    result.errors.push('Campo "flows" ausente ou em formato inválido.');
    validData.flows = undefined; // Type confusion handled
  }
  
  // Variables
  if (Array.isArray(data.variables)) {
    validData.variables = data.variables
      .filter((v: any) => v && typeof v === 'object' && typeof v.key === 'string' && typeof v.value === 'string')
      .map((v: any) => ({
        id: forceNewIds ? crypto.randomUUID() : (typeof v.id === 'string' ? escapeHtml(v.id.slice(0, 50)) : crypto.randomUUID()),
        key: escapeHtml(v.key.slice(0, 100)),
        value: sanitizeHtml(v.value),
        description: v.description && typeof v.description === 'string' ? escapeHtml(v.description.slice(0, 500)) : undefined,
        updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
      }));
  } else {
    validData.variables = [];
  }

  // Folders
  if (Array.isArray(data.folders)) {
    validData.folders = data.folders
      .filter((f: any) => f && typeof f === 'object' && typeof f.name === 'string')
      .map((f: any) => ({
        id: forceNewIds ? crypto.randomUUID() : (typeof f.id === 'string' ? escapeHtml(f.id.slice(0, 50)) : crypto.randomUUID()),
        name: escapeHtml(f.name.slice(0, 50)),
        color: escapeHtml(String(f.color || '').slice(0, 20)),
        order: typeof f.order === 'number' ? f.order : 0
      }));
  } else {
    validData.folders = [];
  }

  // Forms
  if (Array.isArray(data.forms)) {
    validData.forms = data.forms
      .filter((f: any) => f && typeof f === 'object' && typeof f.name === 'string')
      .map((f: any) => ({
        id: forceNewIds ? crypto.randomUUID() : (typeof f.id === 'string' ? escapeHtml(f.id.slice(0, 50)) : crypto.randomUUID()),
        name: escapeHtml(f.name.slice(0, 200)),
        sites: Array.isArray(f.sites) ? f.sites.filter((s:any) => typeof s === 'string').map((s: string) => escapeHtml(s.slice(0, 200))) : [],
        fields: Array.isArray(f.fields) ? f.fields.map((field: any) => ({
          id: typeof field.id === 'string' ? escapeHtml(field.id.slice(0,50)) : crypto.randomUUID(),
          name: typeof field.name === 'string' ? escapeHtml(field.name.slice(0, 100)) : '',
          type: typeof field.type === 'string' ? escapeHtml(field.type.slice(0, 20)) : 'text',
          value: validateActionBlock(field.value) || { format: 'plaintext', content: '', tokens: [] }
        })) : [],
        createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
        updatedAt: typeof f.updatedAt === 'number' ? f.updatedAt : Date.now(),
        stats: {
          usageCount: typeof f.stats?.usageCount === 'number' ? f.stats.usageCount : 0,
          lastUsed: typeof f.stats?.lastUsed === 'number' ? f.stats.lastUsed : undefined,
        }
      }));
  } else {
    validData.forms = [];
  }

  // Settings Explicit Allowlist
  if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
    const rawSet = data.settings;
    const safeSet: any = {};
    
    // Explicit list of allowed settings keys. 
    if (typeof rawSet.triggerMode === 'string') safeSet.triggerMode = escapeHtml(rawSet.triggerMode.slice(0,20));
    if (Array.isArray(rawSet.triggerKeys)) safeSet.triggerKeys = rawSet.triggerKeys.filter((k:any) => typeof k === 'string').map((k:string) => escapeHtml(k.slice(0,10)));
    if (typeof rawSet.exactMatchChar === 'string') safeSet.exactMatchChar = escapeHtml(rawSet.exactMatchChar.slice(0,5));
    if (typeof rawSet.exactMatchDelay === 'number') safeSet.exactMatchDelay = rawSet.exactMatchDelay;
    if (typeof rawSet.globalEnabled === 'boolean') safeSet.globalEnabled = rawSet.globalEnabled;
    if (typeof rawSet.snoozeUntil === 'number') safeSet.snoozeUntil = rawSet.snoozeUntil;
    if (Array.isArray(rawSet.blocklist)) safeSet.blocklist = rawSet.blocklist.filter((b:any) => typeof b === 'string').map((b:string) => escapeHtml(b.slice(0, 200)));
    if (typeof rawSet.commandPaletteShortcut === 'string') safeSet.commandPaletteShortcut = escapeHtml(rawSet.commandPaletteShortcut.slice(0,20));
    if (typeof rawSet.language === 'string') safeSet.language = escapeHtml(rawSet.language.slice(0,10));
    if (typeof rawSet.theme === 'string') safeSet.theme = escapeHtml(rawSet.theme.slice(0,20));
    if (typeof rawSet.clipboardHistoryMax === 'number') safeSet.clipboardHistoryMax = rawSet.clipboardHistoryMax;
    if (rawSet.searchTrigger && typeof rawSet.searchTrigger === 'object') {
      safeSet.searchTrigger = {
        enabled: typeof rawSet.searchTrigger.enabled === 'boolean' ? rawSet.searchTrigger.enabled : false,
        includeFlows: typeof rawSet.searchTrigger.includeFlows === 'boolean' ? rawSet.searchTrigger.includeFlows : true,
        domainPrefix: typeof rawSet.searchTrigger.domainPrefix === 'string' ? escapeHtml(rawSet.searchTrigger.domainPrefix.slice(0,10)) : '//',
        globalPrefix: typeof rawSet.searchTrigger.globalPrefix === 'string' ? escapeHtml(rawSet.searchTrigger.globalPrefix.slice(0,10)) : '///'
      };
    }
    if (typeof rawSet.contextMenuEnabled === 'boolean') safeSet.contextMenuEnabled = rawSet.contextMenuEnabled;
    
    // DELIBERATELY EXCLUDED: analytics and analyticsFailures are discarded upon import.
    // They are local telemetry data and should not be merged across installations.
    // We strictly refuse to parse arbitrary keys via wildcard allowlists.

    validData.settings = safeSet;
  } else {
    validData.settings = {} as any; 
  }

  result.valid = validData.flows !== undefined && Array.isArray(validData.flows);
  result.data = validData;
  return result;
}
