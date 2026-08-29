/**
 * src/dashboard/pages/analytics.ts — Analytics Dashboard
 *
 * Every figure on this page comes straight from storage: flows' stats,
 * settings.analytics(Failures) daily counters, and folders.
 *
 * The reference mock's "Taxa de Sucesso" card used to be skipped entirely —
 * there was no execution log with success/failure in the data model, only
 * a counter that incremented after a successful expansion (so a made-up
 * rate would've always read 100%, meaninglessly). It's real now: the
 * `catch` around handleTrigger() in content.ts reports failed attempts via
 * FLOW_EXECUTION_FAILED (see StorageService.incrementFlowFailure()), so
 * usageCount (successes) vs failureCount (failures) gives an honest ratio.
 * "Economia de Tempo" (time saved) was always real too — a WPM-based
 * estimate from keysSaved, not derived from any execution log.
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Folder, Settings } from '../../shared/types/index.js';
import { t } from '../../shared/i18n/index.js';
import { localDateKey } from '../../shared/utils/localDate.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import './analytics.css';

const ICONS = {
  reset: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5z"/></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>`,
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128v256c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zM224 416H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32zM128 320c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zM192 224c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z"/></svg>`,
  fire: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M153.6 29.9l16-21.3C173.6 3.2 180 0 186.7 0C198.4 0 208 9.6 208 21.3V43.5c0 13.1 5.4 25.7 14.9 34.7L307.6 159C356.4 205.6 384 270.2 384 336c0 114.9-93.1 208-208 208S-8 450.9-8 336c0-41.8 12.1-81.5 34.1-115.1l74.9-114.1c7.4-11.2 22.3-14.3 33.4-6.9s14.3 22.3 6.9 33.4l-74.9 114.1c-14.4 21.9-22 47.9-22 74.6c0 79.5 64.5 144 144 144s144-64.5 144-144c0-43-18.1-83.6-49.9-112.5l-84.7-76.9c-29.3-27.6-46.4-66.9-46.4-107.5V21.3c0-4.6-2-8.9-5.5-11.8l16 21.3c-2.3 3-5.9 4.8-9.8 4.8c-6.8 0-12.3-5.5-12.3-12.3c0-3.3 1.3-6.4 3.7-8.6z"/></svg>`,
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zM432 456a24 24 0 1 1 0-48 24 24 0 1 1 0 48z"/></svg>`,
  shieldCheck: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C57.3 420.7 16.5 239.2 16 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0zm0 66.8V444.8C394 378 431.1 230.1 432 141.4L256 66.8l0 0z"/></svg>`,
};

/** Deterministic color for a flow's donut slice, cycling through a small
 * violet/lime/coral-adjacent palette so slices stay legible without
 * needing per-flow color configuration. */
const SLICE_COLORS = ['#8b5cf6', '#bef264', '#38bdf8', '#f472b6', '#fb923c'];

export default class AnalyticsPage implements Page {
  private el: HTMLElement;
  private flows: Flow[] = [];
  private folders: Folder[] = [];
  private settings: Settings = {} as Settings;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-analytics';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <div class="dash-page-inner">
        <header class="analytics-header">
          <div>
            <div class="dash-breadcrumb">
              <span>/workspace</span>${ICONS.chevronRight}<span class="is-current">${t('analytics.breadcrumb')}</span>
            </div>
            <h1 class="analytics-header-title">${t('analytics.page.title')}</h1>
            <p class="analytics-header-subtitle">${t('analytics.page.subtitle')}</p>
          </div>
          <div class="analytics-header-actions">
            <button class="dash-header-btn" id="btn-export">${ICONS.download} <span>${t('analytics.page.export_btn')}</span></button>
            <button class="btn-secondary" id="btn-reset-stats">${ICONS.reset} ${t('analytics.page.reset_btn')}</button>
          </div>
        </header>

        <div class="analytics-container">
          <!-- Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-card-header">${ICONS.bolt} ${t('analytics.page.stat.total_expansions')}</div>
              <p class="stat-card-value" id="stat-expansions">0</p>
              <p class="stat-card-desc">${t('analytics.page.stat.all_time')}</p>
            </div>
            <div class="stat-card">
              <div class="stat-card-header">${ICONS.clock} ${t('analytics.page.stat.time_saved')}</div>
              <p class="stat-card-value" id="stat-time">0m</p>
              <p class="stat-card-desc">${t('analytics.page.stat.wpm_basis')}</p>
            </div>
            <div class="stat-card">
              <div class="stat-card-header">${ICONS.keyboard} ${t('analytics.page.stat.keys_saved')}</div>
              <p class="stat-card-value" id="stat-keys">0</p>
              <p class="stat-card-desc">${t('analytics.page.stat.keystrokes_avoided')}</p>
            </div>
            <div class="stat-card">
              <div class="stat-card-header">${ICONS.fire} ${t('analytics.page.stat.current_streak')}</div>
              <p class="stat-card-value" id="stat-streak">0</p>
              <p class="stat-card-desc">${t('analytics.page.stat.consecutive_days')}</p>
            </div>
            <div class="stat-card">
              <div class="stat-card-header">${ICONS.shieldCheck} ${t('analytics.page.stat.success_rate')}</div>
              <p class="stat-card-value" id="stat-success-rate">—</p>
              <p class="stat-card-desc" id="stat-success-rate-desc">${t('analytics.page.stat.no_attempts_yet')}</p>
            </div>
          </div>

          <!-- Chart + Donut row -->
          <div class="analytics-row-2col">
            <section class="chart-section">
              <div class="chart-header">
                <h2 class="chart-title">${t('analytics.page.chart.title')}</h2>
                <p class="chart-subtitle">${t('analytics.page.chart.subtitle')}</p>
              </div>
              <div class="chart-container">
                <canvas id="usage-chart"></canvas>
              </div>
            </section>

            <section class="donut-section">
              <div class="chart-header">
                <h2 class="chart-title">${t('analytics.page.donut.title')}</h2>
                <p class="chart-subtitle">${t('analytics.page.donut.subtitle')}</p>
              </div>
              <div class="donut-container">
                <canvas id="donut-chart" width="180" height="180"></canvas>
                <ul class="donut-legend" id="donut-legend"></ul>
              </div>
            </section>
          </div>

          <!-- Folder distribution + Top flows table -->
          <div class="analytics-row-2col">
            <section class="folders-section">
              <h2 class="top-flows-title">${t('analytics.page.folders.title')}</h2>
              <div class="folders-list" id="folders-container"></div>
            </section>

            <section class="top-flows-section">
              <h2 class="top-flows-title">${t('analytics.page.top_flows.title')}</h2>
              <div class="top-flows-table" id="top-flows-container"></div>
            </section>
          </div>
        </div>
      </div>
    `;
    return this.el;
  }

  async mount() {
    const [flows, settings, folders] = await Promise.all([
      storage.getFlows(),
      storage.getSettings(),
      storage.getFolders(),
    ]);
    this.flows = flows;
    this.settings = settings;
    this.folders = folders;

    this.calculateMetrics();
    this.drawChart();
    this.drawDonut();
    this.renderFolderDistribution();
    this.renderTopFlowsTable();
    this.bindEvents();
  }

  unmount() {}

  private calculateMetrics() {
    let totalExpansions = 0;
    let totalKeysSaved = 0;
    let totalFailures = 0;

    this.flows.forEach(flow => {
      totalExpansions += flow.stats.usageCount;
      totalKeysSaved += flow.stats.keysSaved;
      totalFailures += flow.stats.failureCount || 0;
    });

    const minutesSaved = Math.floor(totalKeysSaved / 200);
    const timeFormatted = minutesSaved > 60
      ? `${Math.floor(minutesSaved / 60)}h ${minutesSaved % 60}m`
      : `${minutesSaved}m`;

    let streak = 0;
    const analytics = this.settings.analytics || {};
    let date = new Date();

    let dateStr = localDateKey(date);
    if (analytics[dateStr] > 0) {
      streak++;
    } else {
      date.setDate(date.getDate() - 1);
      dateStr = localDateKey(date);
      if (analytics[dateStr] > 0) {
        streak++;
      }
    }

    if (streak > 0) {
      date.setDate(date.getDate() - 1);
      while (true) {
        dateStr = localDateKey(date);
        if (analytics[dateStr] > 0) {
          streak++;
          date.setDate(date.getDate() - 1);
        } else {
          break;
        }
      }
    }

    this.el.querySelector('#stat-expansions')!.textContent = totalExpansions.toLocaleString();
    this.el.querySelector('#stat-keys')!.textContent = totalKeysSaved.toLocaleString();
    this.el.querySelector('#stat-time')!.textContent = timeFormatted;
    this.el.querySelector('#stat-streak')!.textContent = `${streak} ${streak === 1 ? t('analytics.page.streak.day') : t('analytics.page.streak.days')}`;

    // Taxa de Sucesso — só existe atenção a dar aqui quando já houve pelo
    // menos UMA tentativa (sucesso ou falha) registrada; um instalação
    // zerada não deveria alardear "100%" sem nenhum dado real por trás.
    const totalAttempts = totalExpansions + totalFailures;
    const successRateEl = this.el.querySelector('#stat-success-rate')!;
    const successRateDescEl = this.el.querySelector('#stat-success-rate-desc')!;
    if (totalAttempts === 0) {
      successRateEl.textContent = '—';
      successRateDescEl.textContent = t('analytics.page.stat.no_attempts_yet');
    } else {
      const rate = (totalExpansions / totalAttempts) * 100;
      // Uma casa decimal só quando não é um número redondo, pra não
      // exibir "100.0%" o tempo todo (o caso mais comum, já que a
      // maioria das expansões nunca falha).
      successRateEl.textContent = `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
      successRateDescEl.textContent = t('analytics.page.stat.based_on_attempts', { n: totalAttempts.toLocaleString() });
    }
  }

  private drawChart() {
    const canvas = this.el.querySelector<HTMLCanvasElement>('#usage-chart');
    if (!canvas) return;

    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analytics = this.settings.analytics || {};
    const days = 30;
    const data: number[] = [];
    const labels: string[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = localDateKey(d);
      data.push(analytics[dateStr] || 0);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }

    const maxVal = Math.max(...data, 10);
    const padding = { top: 20, right: 10, bottom: 30, left: 40 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;
    const barW = (chartW / days) * 0.6;
    const spacing = (chartW / days) * 0.4;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#28282f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);

      ctx.fillStyle = '#7a7d86';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const val = Math.round(maxVal - (maxVal * i) / 4);
      ctx.fillText(val.toString(), padding.left - 8, y);
    }
    ctx.stroke();

    data.forEach((val, i) => {
      const x = padding.left + (i * (barW + spacing)) + (spacing / 2);
      const h = (val / maxVal) * chartH;
      const y = canvas.height - padding.bottom - h;

      ctx.fillStyle = val > 0 ? '#8b5cf6' : '#28282f';

      ctx.beginPath();
      ctx.moveTo(x, y + barW / 2);
      ctx.arcTo(x, y, x + barW, y, Math.min(barW / 2, h));
      ctx.arcTo(x + barW, y, x + barW, y + barW / 2, Math.min(barW / 2, h));
      ctx.lineTo(x + barW, canvas.height - padding.bottom);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.fill();

      if (i % Math.floor(days / 5) === 0 || i === days - 1) {
        ctx.fillStyle = '#7a7d86';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labels[i], x + barW / 2, canvas.height - padding.bottom + 8);
      }
    });
  }

  /** "Distribuição de Fluxos" donut — real share of total executions held
   * by each of the top 5 flows (plus an "Outros" slice for the rest). */
  private drawDonut() {
    const canvas = this.el.querySelector<HTMLCanvasElement>('#donut-chart');
    const legend = this.el.querySelector<HTMLElement>('#donut-legend');
    if (!canvas || !legend) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const used = this.flows.filter(f => f.stats.usageCount > 0);
    const total = used.reduce((sum, f) => sum + f.stats.usageCount, 0);

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 4;
    const innerR = outerR * 0.62;

    ctx.clearRect(0, 0, size, size);

    if (total === 0) {
      ctx.strokeStyle = '#28282f';
      ctx.lineWidth = outerR - innerR;
      ctx.beginPath();
      ctx.arc(cx, cy, (outerR + innerR) / 2, 0, Math.PI * 2);
      ctx.stroke();
      legend.innerHTML = `<li class="donut-legend-empty">${t('analytics.page.donut.empty')}</li>`;
      return;
    }

    const sorted = [...used].sort((a, b) => b.stats.usageCount - a.stats.usageCount);
    const top = sorted.slice(0, 5);
    const othersCount = sorted.slice(5).reduce((sum, f) => sum + f.stats.usageCount, 0);

    const slices: { label: string; value: number; color: string }[] = top.map((f, i) => ({
      label: f.name,
      value: f.stats.usageCount,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }));
    if (othersCount > 0) slices.push({ label: t('analytics.page.donut.others'), value: othersCount, color: '#3a3a44' });

    let startAngle = -Math.PI / 2;
    ctx.lineWidth = outerR - innerR;
    slices.forEach((slice) => {
      const angle = (slice.value / total) * Math.PI * 2;
      ctx.strokeStyle = slice.color;
      ctx.beginPath();
      ctx.arc(cx, cy, (outerR + innerR) / 2, startAngle, startAngle + angle);
      ctx.stroke();
      startAngle += angle;
    });

    legend.innerHTML = slices
      .map(
        (s) => /* html */ `
        <li>
          <span class="donut-dot" style="background:${s.color}"></span>
          <span class="donut-legend-label">${escapeHtml(s.label)}</span>
          <span class="donut-legend-pct">${Math.round((s.value / total) * 100)}%</span>
        </li>`
      )
      .join('');
  }

  /** Real usage share per folder (execuções por pasta), replacing the
   * reference mock's "Domínios Mais Frequentes" — SOTE doesn't track which
   * domain each expansion happened on, but it does know which folder each
   * flow belongs to, so this shows the same "where is usage concentrated"
   * story with data that actually exists. */
  private renderFolderDistribution() {
    const container = this.el.querySelector('#folders-container');
    if (!container) return;

    const totals = new Map<string, number>(); // folderId ('none' for uncategorised) -> usage
    for (const f of this.flows) {
      const key = f.folderId || 'none';
      totals.set(key, (totals.get(key) || 0) + (f.stats.usageCount || 0));
    }

    const rows = Array.from(totals.entries())
      .map(([id, count]) => ({
        name: id === 'none' ? t('flows.folder.none') : (this.folders.find(fo => fo.id === id)?.name ?? t('flows.folder.none')),
        count,
      }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    if (rows.length === 0) {
      container.innerHTML = `<p class="analytics-empty-text">${t('analytics.page.folders.empty')}</p>`;
      return;
    }

    const max = rows[0].count;
    container.innerHTML = rows
      .map(
        (r) => /* html */ `
        <div class="folder-row">
          <span class="folder-row-name">${escapeHtml(r.name)}</span>
          <div class="folder-row-track"><div class="folder-row-fill" style="width:${(r.count / max) * 100}%"></div></div>
          <span class="folder-row-count">${r.count.toLocaleString()}</span>
        </div>`
      )
      .join('');
  }

  /** "Fluxos Mais Performáticos" table — Execuções and Tempo Economizado are
   * both derived straight from stored stats (usageCount / keysSaved), Status
   * reflects the flow's real enabled/disabled state, and Taxa de Sucesso is
   * now a real per-flow ratio of usageCount (successful completions) over
   * usageCount + failureCount (attempts that threw — see incrementFlowFailure()
   * in StorageService.ts) — no longer an invented column, since failures are
   * actually tracked. */
  private renderTopFlowsTable() {
    const container = this.el.querySelector('#top-flows-container')!;

    const sorted = [...this.flows]
      .filter(f => f.stats.usageCount > 0)
      .sort((a, b) => b.stats.usageCount - a.stats.usageCount)
      .slice(0, 6);

    if (sorted.length === 0) {
      container.innerHTML = `<p class="analytics-empty-text">${t('analytics.page.top_flows.empty')}</p>`;
      return;
    }

    container.innerHTML = /* html */ `
      <div class="top-flows-th">
        <span>${t('analytics.page.top_flows.col_flow')}</span>
        <span>${t('analytics.page.top_flows.col_executions')}</span>
        <span>${t('analytics.page.top_flows.col_time_saved')}</span>
        <span>${t('analytics.page.top_flows.col_success_rate')}</span>
        <span>${t('analytics.page.top_flows.col_status')}</span>
      </div>
      ${sorted
        .map((flow) => {
          const trigger = flow.blocks.find(b => b.type === 'trigger');
          const shortcut = trigger ? (trigger.data as any).shortcut : flow.name;
          const minutes = Math.floor((flow.stats.keysSaved || 0) / 200);
          const failures = flow.stats.failureCount || 0;
          const attempts = flow.stats.usageCount + failures;
          const rate = attempts > 0 ? (flow.stats.usageCount / attempts) * 100 : 100;
          const rateClass = failures === 0 ? 'is-on' : rate < 90 ? 'is-off' : '';
          return /* html */ `
            <div class="top-flows-tr">
              <div class="tf-name-cell">
                <p class="tf-name">${escapeHtml(flow.name)}</p>
                <p class="tf-shortcut">/${escapeHtml(shortcut)}</p>
              </div>
              <span class="tf-mono">${flow.stats.usageCount.toLocaleString()}</span>
              <span class="tf-mono">${minutes}m</span>
              <span class="tf-mono ${rateClass}">${Number.isInteger(rate) ? rate : rate.toFixed(1)}%</span>
              <span class="tf-status ${flow.enabled ? 'is-on' : 'is-off'}"><span class="dot"></span>${flow.enabled ? t('analytics.page.top_flows.active') : t('analytics.page.top_flows.inactive')}</span>
            </div>`;
        })
        .join('')}
    `;
  }

  private bindEvents() {
    this.el.querySelector('#btn-reset-stats')?.addEventListener('click', () => {
      this.showResetModal();
    });

    this.el.querySelector('#btn-export')?.addEventListener('click', () => this.exportReport());

    const resizeObserver = new ResizeObserver(() => {
      if (this.el.isConnected) {
        this.drawChart();
      }
    });
    const canvas = this.el.querySelector('#usage-chart');
    if (canvas) resizeObserver.observe(canvas.parentElement!);
  }

  /** Exports the real underlying numbers behind every card on this page
   * (per-flow stats + daily counters) as a JSON file the person can keep
   * or analyze elsewhere — no dashboard-only figures left behind. */
  private exportReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      flows: this.flows.map(f => ({
        name: f.name,
        enabled: f.enabled,
        usageCount: f.stats.usageCount,
        keysSaved: f.stats.keysSaved,
        failureCount: f.stats.failureCount || 0,
        lastUsed: f.stats.lastUsed ?? null,
      })),
      dailyExpansions: this.settings.analytics || {},
      dailyFailures: this.settings.analyticsFailures || {},
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sote-analytics-${localDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private showResetModal() {
    ConfirmModal.show({
      title: t('analytics.page.reset_modal.title'),
      message: t('analytics.page.reset_modal.desc'),
      confirmLabel: t('analytics.page.reset_btn'),
      onConfirm: async () => {
        await storage.resetStats();
        this.flows = await storage.getFlows();
        this.settings = await storage.getSettings();
        this.calculateMetrics();
        this.drawChart();
        this.drawDonut();
        this.renderFolderDistribution();
        this.renderTopFlowsTable();
      },
    });
  }

}
