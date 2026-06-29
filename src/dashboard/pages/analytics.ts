/**
 * src/dashboard/pages/analytics.ts — Analytics Dashboard
 */
import type { Page } from './index.js';
import { storage } from '../../shared/storage/StorageService.js';
import type { Flow, Settings } from '../../shared/types/index.js';
import './analytics.css';

const ICONS = {
  reset: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5z"/></svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`, // Using play-like for expansions
  clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>`,
  keyboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 64C28.7 64 0 92.7 0 128v256c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zM224 416H160c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32zM128 320c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zM192 224c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32zm96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z"/></svg>`,
  fire: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M153.6 29.9l16-21.3C173.6 3.2 180 0 186.7 0C198.4 0 208 9.6 208 21.3V43.5c0 13.1 5.4 25.7 14.9 34.7L307.6 159C356.4 205.6 384 270.2 384 336c0 114.9-93.1 208-208 208S-8 450.9-8 336c0-41.8 12.1-81.5 34.1-115.1l74.9-114.1c7.4-11.2 22.3-14.3 33.4-6.9s14.3 22.3 6.9 33.4l-74.9 114.1c-14.4 21.9-22 47.9-22 74.6c0 79.5 64.5 144 144 144s144-64.5 144-144c0-43-18.1-83.6-49.9-112.5l-84.7-76.9c-29.3-27.6-46.4-66.9-46.4-107.5V21.3c0-4.6-2-8.9-5.5-11.8l16 21.3c-2.3 3-5.9 4.8-9.8 4.8c-6.8 0-12.3-5.5-12.3-12.3c0-3.3 1.3-6.4 3.7-8.6z"/></svg>`,
};

class AnalyticsPage implements Page {
  private el: HTMLElement;
  private flows: Flow[] = [];
  private settings: Settings = {} as Settings;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'page-analytics';
  }

  render(): HTMLElement {
    this.el.innerHTML = /* html */ `
      <header class="analytics-header">
        <div>
          <h1 class="analytics-header-title">Analytics</h1>
          <p class="analytics-header-subtitle">Insights and usage statistics for your flows.</p>
        </div>
        <button class="btn-secondary" id="btn-reset-stats">
          ${ICONS.reset} Reset Stats
        </button>
      </header>

      <main class="analytics-main">
        <div class="analytics-container">
          
          <!-- Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-card-header">
                ${ICONS.bolt} Total Expansions
              </div>
              <p class="stat-card-value" id="stat-expansions">0</p>
              <p class="stat-card-desc">All time</p>
            </div>
            
            <div class="stat-card">
              <div class="stat-card-header">
                ${ICONS.clock} Est. Time Saved
              </div>
              <p class="stat-card-value" id="stat-time">0m</p>
              <p class="stat-card-desc">Based on 40 WPM</p>
            </div>

            <div class="stat-card">
              <div class="stat-card-header">
                ${ICONS.keyboard} Keys Saved
              </div>
              <p class="stat-card-value" id="stat-keys">0</p>
              <p class="stat-card-desc">Keystrokes avoided</p>
            </div>

            <div class="stat-card">
              <div class="stat-card-header">
                ${ICONS.fire} Current Streak
              </div>
              <p class="stat-card-value" id="stat-streak">0</p>
              <p class="stat-card-desc">Consecutive days</p>
            </div>
          </div>

          <!-- Chart Section -->
          <section class="chart-section">
            <div class="chart-header">
              <h2 class="chart-title">Usage Activity</h2>
              <p class="chart-subtitle">Expansions over the last 30 days</p>
            </div>
            <div class="chart-container">
              <canvas id="usage-chart"></canvas>
            </div>
          </section>

          <!-- Top Flows -->
          <section class="top-flows-section">
            <h2 class="top-flows-title">Top 5 Flows</h2>
            <div class="top-flows-list" id="top-flows-container">
              <!-- Rendered via JS -->
            </div>
          </section>

        </div>
      </main>
    `;
    return this.el;
  }

  async mount() {
    this.flows = await storage.getFlows();
    this.settings = await storage.getSettings();

    this.calculateMetrics();
    this.drawChart();
    this.renderTopFlows();
    this.bindEvents();
  }

  unmount() {}

  private calculateMetrics() {
    let totalExpansions = 0;
    let totalKeysSaved = 0;

    this.flows.forEach(flow => {
      totalExpansions += flow.stats.usageCount;
      totalKeysSaved += flow.stats.keysSaved;
    });

    // Assume 40 words per minute, 5 chars per word = 200 chars/min
    const minutesSaved = Math.floor(totalKeysSaved / 200);
    const timeFormatted = minutesSaved > 60 
      ? `${Math.floor(minutesSaved / 60)}h ${minutesSaved % 60}m` 
      : `${minutesSaved}m`;

    // Streak calculation
    let streak = 0;
    const analytics = this.settings.analytics || {};
    let date = new Date();
    
    // Check today
    let dateStr = date.toISOString().split('T')[0];
    if (analytics[dateStr] > 0) {
      streak++;
    } else {
      // If today is 0, check if yesterday was > 0 to continue streak
      date.setDate(date.getDate() - 1);
      dateStr = date.toISOString().split('T')[0];
      if (analytics[dateStr] > 0) {
        streak++;
      } else {
        // Streak is 0
      }
    }

    if (streak > 0) {
      // Trace backwards
      date.setDate(date.getDate() - 1);
      while(true) {
        dateStr = date.toISOString().split('T')[0];
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
    this.el.querySelector('#stat-streak')!.textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
  }

  private drawChart() {
    const canvas = this.el.querySelector<HTMLCanvasElement>('#usage-chart');
    if (!canvas) return;

    // Set internal resolution
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analytics = this.settings.analytics || {};
    const days = 30;
    const data: number[] = [];
    const labels: string[] = [];

    // Generate last 30 days
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data.push(analytics[dateStr] || 0);
      labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    }

    const maxVal = Math.max(...data, 10); // Minimum scale of 10
    const padding = { top: 20, right: 10, bottom: 30, left: 40 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;
    const barW = (chartW / days) * 0.6; // 60% of slot width
    const spacing = (chartW / days) * 0.4;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Y-axis grid
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      
      // Label
      ctx.fillStyle = '#737373';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const val = Math.round(maxVal - (maxVal * i) / 4);
      ctx.fillText(val.toString(), padding.left - 8, y);
    }
    ctx.stroke();

    // Draw bars
    data.forEach((val, i) => {
      const x = padding.left + (i * (barW + spacing)) + (spacing / 2);
      const h = (val / maxVal) * chartH;
      const y = canvas.height - padding.bottom - h;

      ctx.fillStyle = val > 0 ? '#3b82f6' : '#262626'; // Blue for data, dark gray for empty
      
      // Rounded top bar
      ctx.beginPath();
      ctx.moveTo(x, y + barW/2);
      ctx.arcTo(x, y, x + barW, y, Math.min(barW/2, h));
      ctx.arcTo(x + barW, y, x + barW, y + barW/2, Math.min(barW/2, h));
      ctx.lineTo(x + barW, canvas.height - padding.bottom);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.fill();

      // X-axis label (only show a few)
      if (i % Math.floor(days/5) === 0 || i === days - 1) {
        ctx.fillStyle = '#737373';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labels[i], x + barW/2, canvas.height - padding.bottom + 8);
      }
    });
  }

  private renderTopFlows() {
    const container = this.el.querySelector('#top-flows-container')!;
    
    // Sort descending by usageCount
    const sorted = [...this.flows]
      .filter(f => f.stats.usageCount > 0)
      .sort((a, b) => b.stats.usageCount - a.stats.usageCount)
      .slice(0, 5);

    if (sorted.length === 0) {
      container.innerHTML = '<p style="color: #737373; font-size: 0.875rem;">No flows used yet.</p>';
      return;
    }

    const maxCount = sorted[0].stats.usageCount;

    container.innerHTML = sorted.map((flow, i) => {
      const width = (flow.stats.usageCount / maxCount) * 100;
      return /* html */ `
        <div class="top-flow-item">
          <div class="top-flow-header">
            <div class="top-flow-name-row">
              <span class="top-flow-rank">#${i + 1}</span>
              <p class="top-flow-name">${this.escapeHTML(flow.name)}</p>
            </div>
            <p class="top-flow-count">${flow.stats.usageCount.toLocaleString()} uses</p>
          </div>
          <div class="top-flow-bar-container">
            <div class="top-flow-bar" style="width: ${width}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  private bindEvents() {
    this.el.querySelector('#btn-reset-stats')?.addEventListener('click', () => {
      this.showResetModal();
    });

    // Handle window resize for canvas redraw
    const resizeObserver = new ResizeObserver(() => {
      if (this.el.isConnected) {
        this.drawChart();
      }
    });
    const canvas = this.el.querySelector('#usage-chart');
    if (canvas) resizeObserver.observe(canvas.parentElement!);
  }

  private showResetModal() {
    const modal = document.createElement('div');
    modal.className = 'analytics-modal-overlay';
    modal.innerHTML = /* html */ `
      <div class="analytics-modal-content">
        <div class="analytics-modal-header">
          <h2 class="analytics-modal-title">Reset All Stats?</h2>
          <p class="analytics-modal-desc">Are you sure you want to reset all expansion counters and activity history to zero? This does not delete your flows.</p>
        </div>
        <div class="analytics-modal-footer">
          <button class="analytics-btn-primary" id="modal-cancel">Cancel</button>
          <button class="analytics-btn-danger" id="modal-confirm">Reset Stats</button>
        </div>
      </div>
    `;
    this.el.appendChild(modal);

    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-confirm')?.addEventListener('click', async () => {
      await storage.resetStats();
      this.flows = await storage.getFlows();
      this.settings = await storage.getSettings();
      this.calculateMetrics();
      this.drawChart();
      this.renderTopFlows();
      modal.remove();
    });
  }

  private escapeHTML(str: string): string {
    return str.replace(/[&<>'"]/g, 
      tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag)
    );
  }
}

export const page = new AnalyticsPage();
