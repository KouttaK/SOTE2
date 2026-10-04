import { describe, it, expect } from 'vitest';
import { translations } from './index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('i18n popup keys validation', () => {
  it('should have all popup keys defined in both languages', () => {
    // Read popup/index.ts to extract all used keys dynamically
    const popupCode = fs.readFileSync(path.join(process.cwd(), 'src/popup/index.ts'), 'utf8');
    const matches = popupCode.matchAll(/t\(['"](popup\.[^'"]+)['"]/g);
    const keys = Array.from(matches).map(m => m[1]);
    const uniqueKeys = [...new Set(keys)];

    expect(uniqueKeys.length).toBeGreaterThan(0);

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of uniqueKeys) {
      expect(en[key], `Key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });

  it('should explicitly validate Quick Capture and Quick Variables keys', () => {
    const quickFeatureKeys = [
      'popup.page.quick_capture',
      'popup.page.quick_capture_no_selection',
      'popup.page.quick_variables',
      'popup.page.vars_title',
      'popup.page.vars_back',
      'popup.page.vars_section',
      'popup.page.vars_empty',
      'popup.page.vars_open_dashboard',
      'popup.page.var_saved',
      'popup.page.var_save_failed',
    ];

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of quickFeatureKeys) {
      expect(en[key], `Quick feature key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Quick feature key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });

  it('should validate new Subagent 2 condition, random, and clipboard keys', () => {
    const subagent2Keys = [
      'condition.clipboard_content',
      'condition.clipboard_content.placeholder',
      'condition.variable_value',
      'condition.variable_value.key_placeholder',
      'condition.variable_value.val_placeholder',
      'condition.time_since_last_expansion',
      'condition.time_since.after',
      'condition.time_since.before',
      'condition.time_since.minutes',
      'condition.preview.time_since_after',
      'condition.preview.time_since_before',
      'condition.preview.clipboard_content',
      'condition.preview.variable_value',
      'token.random.avoid_consecutive',
      'token.random.distribute_equally',
      'token.clipboard.slot_preview',
      'token.clipboard.slot_empty',
    ];

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of subagent2Keys) {
      expect(en[key], `Key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });

  it('should validate Subagent 3 repeat, counter, math, and flow export/import keys', () => {
    const subagent3Keys = [
      'block_dock.repeat_label',
      'block.repeat',
      'block.repeat.desc',
      'editor.repeat.badge',
      'editor.repeat.count_desc',
      'editor.repeat.count_label',
      'editor.repeat.times_unit',
      'editor.repeat.separator_label',
      'editor.repeat.separator_placeholder',
      'editor.repeat.preset_newline',
      'editor.repeat.preset_comma',
      'editor.repeat.preset_space',
      'editor.repeat.preset_empty',
      'editor.repeat.remove_title',
      'editor.repeat.confirm_remove',
      'confirm_modal.remove_repeat_title',
      'token.counter.name',
      'token.counter.desc',
      'token.counter.start',
      'token.counter.step',
      'token.counter.pad_length',
      'token.counter.reset_scope',
      'token.math.name',
      'token.math.desc',
      'token.math.expression',
      'token.math.placeholder',
      'token.math.preview',
      'flows.export_selected',
      'flows.export_all',
      'flows.import',
      'flows.import_success',
      'flows.import_no_valid',
      'flows.import_error',
    ];

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of subagent3Keys) {
      expect(en[key], `Key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });

  it('should validate counter modes, preview toggles, and flows filters keys', () => {
    const keys = [
      'token.modal.configure_counter',
      'token.counter.start_label',
      'token.counter.step_label',
      'token.counter.pad_label',
      'token.counter.current_label',
      'token.counter.display_mode_label',
      'token.counter.display_mode_visible',
      'token.counter.display_mode_silent',
      'token.counter.increment_mode_label',
      'token.counter.increment_mode_always',
      'token.counter.increment_mode_visible_only',
      'token.counter.scope_label',
      'token.counter.scope_global',
      'token.counter.scope_site',
      'token.modal.configure_math',
      'preview.toggle.simulated',
      'preview.toggle.structure',
      'preview.simulated_hint',
      'preview.structure_hint',
      'preview.repeat_container',
      'flows.filters.title',
      'flows.filters.sort_section',
      'flows.filters.status_section',
      'flows.filters.status_all',
      'flows.filters.status_active',
      'flows.filters.status_inactive',
      'flows.filters.folder_section',
      'flows.refresh_success',
    ];

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of keys) {
      expect(en[key], `Key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });

  it('should validate Phase 1B keys: word boundary, prefix wait and conflict center', () => {
    const phase1BKeys = [
      'trigger.block.wordboundary_title',
      'trigger.block.wordboundary_desc',
      'conflicts.title',
      'conflicts.subtitle',
      'conflicts.empty_title',
      'conflicts.empty_desc',
      'conflicts.badge.error',
      'conflicts.badge.warning',
      'conflicts.badge.info',
      'conflicts.type.duplicate',
      'conflicts.type.prefix',
      'conflicts.type.search_trigger',
      'conflicts.action.edit_flow',
      'conflicts.action.disable_flow',
      'conflicts.tab_label',
      'conflicts.button_label',
      'settings.exact.prefix_wait_label',
      'settings.exact.prefix_wait_hint',
      'settings.exact.apply_all_label',
      'settings.exact.apply_all_desc',
      'settings.wordboundary.default_label',
      'settings.wordboundary.default_desc',
      'notice.wordboundary.title',
      'notice.wordboundary.desc',
      'notice.wordboundary.dismiss',
      'notice.wordboundary.go_to_settings',
    ];

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of phase1BKeys) {
      expect(en[key], `Key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });

  it('should validate Phase 3.1 reusable input and prefill UX keys', () => {
    const phase3Keys = [
      'token.input.remember_value',
      'token.input.remember_hint',
      'token.input.session_var_name',
      'token.input.session_var_name_placeholder',
      'token.input.session_var_hint',
      'token.input.scope_label',
      'token.input.scope_tab',
      'token.input.scope_tab_hint',
      'token.input.scope_url',
      'token.input.scope_url_hint',
      'token.input.scope_title',
      'token.input.scope_title_hint',
      'token.input.scope_global',
      'token.input.scope_global_hint',
      'token.input.ttl_label',
      'token.input.ttl_placeholder',
      'token.input.ttl_hint',
      'token.input.auto_apply_label',
      'token.input.auto_apply_hint',
      'token.input.var_name_required',
      'token.input.prefill_banner',
      'token.input.clear_btn',
      'token.input.confirm_btn',
      'token.input.crm_warning_hint',
    ];

    const en = translations.en as Record<string, string>;
    const pt = translations['pt-BR'] as Record<string, string>;

    for (const key of phase3Keys) {
      expect(en[key], `Key ${key} missing in English`).toBeDefined();
      expect(pt[key], `Key ${key} missing in Portuguese`).toBeDefined();
      expect(en[key]).not.toBe(key);
      expect(pt[key]).not.toBe(key);
    }
  });
});


