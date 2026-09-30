import { StorageService } from '../../shared/storage/StorageService.js';
import type { Counter } from '../../shared/types/index.js';
import { sanitizeHtml } from '../../shared/utils/sanitizeHtml.js';

export class CountersPage {
  private container: HTMLElement;
  private counters: Record<string, Counter> = {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  async render() {
    this.container.innerHTML = '<h2>Gerenciar Contadores</h2><p>Carregando...</p>';
    this.counters = await StorageService.getCounters();

    if (Object.keys(this.counters).length === 0) {
      this.container.innerHTML = `
        <h2>Gerenciar Contadores</h2>
        <p>Nenhum contador foi registrado ainda.</p>
        <p class="help-text">Contadores são criados automaticamente quando você importa ou edita fluxos que os utilizam.</p>
      `;
      return;
    }

    let html = `
      <h2>Gerenciar Contadores</h2>
      <table class="counters-table">
        <thead>
          <tr>
            <th>ID / Nome</th>
            <th>Valor Atual</th>
            <th>Formato</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const [id, counter] of Object.entries(this.counters)) {
      html += `
        <tr>
          <td><strong>${sanitizeHtml(id)}</strong></td>
          <td>
            <input type="number" id="counter-val-${id}" value="${counter.currentValue}" class="form-input" style="width: 100px;">
          </td>
          <td><code>${sanitizeHtml(counter.format)}</code></td>
          <td>
            <button class="btn btn-primary" id="btn-save-${id}">Salvar</button>
            <button class="btn btn-secondary" id="btn-reset-${id}">Zerar</button>
            <button class="btn btn-danger" id="btn-delete-${id}">Excluir</button>
          </td>
        </tr>
      `;
    }

    html += `
        </tbody>
      </table>
    `;

    this.container.innerHTML = sanitizeHtml(html);

    // Attach events
    for (const id of Object.keys(this.counters)) {
      const saveBtn = document.getElementById(`btn-save-${id}`);
      const resetBtn = document.getElementById(`btn-reset-${id}`);
      const deleteBtn = document.getElementById(`btn-delete-${id}`);
      const input = document.getElementById(`counter-val-${id}`) as HTMLInputElement;

      saveBtn?.addEventListener('click', async () => {
        const val = parseInt(input.value, 10);
        if (isNaN(val)) return;
        const c = this.counters[id];
        if (val < c.currentValue) {
          if (!confirm(`Atenção: Você está reduzindo o valor do contador (de ${c.currentValue} para ${val}). Isso pode gerar números duplicados. Deseja continuar?`)) {
            input.value = c.currentValue.toString();
            return;
          }
        }
        await this.updateCounter(id, val);
      });

      resetBtn?.addEventListener('click', async () => {
        if (confirm(`Tem certeza que deseja zerar o contador '${id}' para o valor inicial (${this.counters[id].startValue})?`)) {
          await this.updateCounter(id, this.counters[id].startValue);
          input.value = this.counters[id].startValue.toString();
        }
      });

      deleteBtn?.addEventListener('click', async () => {
        const flows = await StorageService.getFlows();
        const inUse = flows.some(f => f.actions.some(a => a.type === 'counter' && a.config?.counterId === id));
        if (inUse) {
          alert(`O contador '${id}' está sendo usado por um ou mais fluxos. Remova-o dos fluxos antes de excluir.`);
          return;
        }
        if (confirm(`Excluir permanentemente o contador '${id}'?`)) {
          await StorageService.deleteCounter(id);
          await this.render();
        }
      });
    }
  }

  private async updateCounter(id: string, value: number) {
    const c = this.counters[id];
    if (c) {
      c.currentValue = value;
      await StorageService.saveCounter(id, c);
      alert('Contador atualizado com sucesso.');
    }
  }
}
