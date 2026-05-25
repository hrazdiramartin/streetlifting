/* ============================================
   PROFILE — tělesná váha, nastavení, data
   ============================================ */

let weightChart = null;

document.addEventListener('DOMContentLoaded', () => {
  renderNav('profile.html');
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#7a6e64';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';
  }
  loadSettings();
  renderWeightSummary();
  renderWeightChart();
  renderWeightHistory();
  attachHandlers();
});

function loadSettings() {
  const s = Settings.get();
  document.getElementById('profile-title').textContent = s.name || 'Profil';
  document.getElementById('setting-name').value = s.name || '';
  document.getElementById('setting-height').value = s.height_cm || '';
  document.getElementById('setting-level').value = s.level || 'intermediate';
}

function renderWeightSummary() {
  const container = document.getElementById('weight-summary-card');
  const latest = BodyWeight.latest();
  const trend30 = BodyWeight.trend(30);
  const trend7 = BodyWeight.trend(7);

  if (!latest) {
    container.innerHTML = `<p class="text-muted">Zatím žádné záznamy. Klikni na "+ Záznam" a začni.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-3 grid-2-mobile">
      <div class="stat">
        <span class="stat-label">Aktuální</span>
        <div>
          <span class="stat-value">${formatNumber(latest.weight, 1)}</span>
          <span class="stat-unit">kg</span>
        </div>
        <span class="stat-trend">${DateUtil.format(latest.date, { short: true })}</span>
      </div>
      <div class="stat">
        <span class="stat-label">7 dní</span>
        <div>
          <span class="stat-value stat-value-sm ${trend7 ? (trend7.delta > 0 ? 'text-warning' : 'text-success') : 'text-faint'}">
            ${trend7 ? (trend7.delta > 0 ? '+' : '') + formatNumber(trend7.delta, 1) : '–'}
          </span>
          ${trend7 ? '<span class="stat-unit">kg</span>' : ''}
        </div>
        <span class="stat-trend">${trend7 ? 'změna' : 'málo dat'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">30 dní</span>
        <div>
          <span class="stat-value stat-value-sm ${trend30 ? (trend30.delta > 0 ? 'text-warning' : 'text-success') : 'text-faint'}">
            ${trend30 ? (trend30.delta > 0 ? '+' : '') + formatNumber(trend30.delta, 1) : '–'}
          </span>
          ${trend30 ? '<span class="stat-unit">kg</span>' : ''}
        </div>
        <span class="stat-trend">${trend30 ? 'změna' : 'málo dat'}</span>
      </div>
    </div>
  `;
}

function renderWeightChart() {
  const canvas = document.getElementById('weight-chart');
  const all = BodyWeight.list();

  if (weightChart) { weightChart.destroy(); weightChart = null; }

  if (all.length < 2) {
    canvas.style.display = 'none';
    if (!canvas.parentElement.querySelector('.empty-state')) {
      canvas.parentElement.insertAdjacentHTML('beforeend',
        `<div class="empty empty-state"><div class="text-muted">Potřeba alespoň 2 záznamy pro graf</div></div>`);
    }
    return;
  }

  canvas.style.display = 'block';
  const old = canvas.parentElement.querySelector('.empty-state');
  if (old) old.remove();

  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: all.map(d => DateUtil.format(d.date, { short: true })),
      datasets: [{
        label: 'Váha (kg)',
        data: all.map(d => d.weight),
        borderColor: '#d4a574',
        backgroundColor: 'rgba(212, 165, 116, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#d4a574',
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f1a17',
          borderColor: '#3a3330',
          borderWidth: 1,
          callbacks: { label: (item) => `${formatNumber(item.parsed.y, 1)} kg` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
}

function renderWeightHistory() {
  const container = document.getElementById('weight-history');
  const all = BodyWeight.list().slice().reverse();

  if (!all.length) {
    container.innerHTML = `<div class="empty"><div class="text-muted">Zatím žádné záznamy</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="flex-col gap-2">
      ${all.slice(0, 20).map((entry, idx) => {
        const prev = all[idx + 1];
        const delta = prev ? entry.weight - prev.weight : null;
        return `
          <div class="flex-between" style="padding: var(--space-3); background: var(--bg-surface-2); border-radius: var(--radius);">
            <div>
              <div style="font-weight: 500;">${formatNumber(entry.weight, 1)} kg</div>
              <div class="text-muted" style="font-size: 0.8rem;">
                ${DateUtil.dayName(entry.date)} • ${DateUtil.format(entry.date, { short: true })}
                ${entry.note ? ` • ${entry.note}` : ''}
              </div>
            </div>
            <div class="flex gap-2" style="align-items: center;">
              ${delta !== null ? `
                <span class="text-muted mono" style="font-size: 0.8rem; color: ${delta > 0 ? 'var(--warning)' : delta < 0 ? 'var(--success)' : 'var(--text-muted)'};">
                  ${delta > 0 ? '+' : ''}${formatNumber(delta, 1)}
                </span>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="removeWeight('${entry.date}')">×</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ${all.length > 20 ? `<div class="text-muted text-center mt-3" style="font-size: 0.85rem;">+ ${all.length - 20} starších záznamů</div>` : ''}
  `;
}

window.removeWeight = function(date) {
  confirmAction(`Smazat záznam váhy z ${DateUtil.format(date)}?`, () => {
    BodyWeight.remove(date);
    toast('Záznam smazán');
    renderWeightSummary();
    renderWeightChart();
    renderWeightHistory();
  });
};

function attachHandlers() {
  document.getElementById('btn-add-weight').onclick = openWeightModal;
  document.getElementById('btn-save-settings').onclick = saveSettings;
  document.getElementById('btn-export').onclick = () => {
    DataIO.exportJSON();
    toast('Backup stažen');
  };
  document.getElementById('import-file').onchange = handleImport;
  document.getElementById('btn-clear').onclick = clearAllData;

  // Google Drive sync
  document.getElementById('btn-cloud-connect').onclick = () => CloudSync.connect();
  document.getElementById('btn-cloud-disconnect').onclick = () => {
    confirmAction('Odpojit Google Drive? Lokální data zůstanou, jen se přestanou synchronizovat.', () => {
      CloudSync.disconnect();
    });
  };
  document.getElementById('btn-cloud-sync-now').onclick = async () => {
    toast('Synchronizuji…');
    await CloudSync.syncToCloud();
    await CloudSync.syncFromCloud();
  };

  CloudSync.onStatus((status, detail) => updateSyncUI(status, detail));
  // Initial UI state
  updateSyncUI(CloudSync.isConnected() ? 'connected' : 'disconnected');
}

function updateSyncUI(status, detail = {}) {
  const badge = document.getElementById('sync-status');
  const info = document.getElementById('sync-info');
  const btnConnect = document.getElementById('btn-cloud-connect');
  const btnSync = document.getElementById('btn-cloud-sync-now');
  const btnDisconnect = document.getElementById('btn-cloud-disconnect');
  if (!badge) return;

  if (status === 'connected') {
    badge.textContent = 'připojeno';
    badge.className = 'badge badge-success';
    btnConnect.style.display = 'none';
    btnSync.style.display = 'inline-flex';
    btnDisconnect.style.display = 'inline-flex';
    info.textContent = detail.restored ? 'Připojeno (obnoveno z předchozí session).' : 'Připojeno k Google Drive.';
  } else if (status === 'reconnect-needed') {
    badge.textContent = 'obnovte připojení';
    badge.className = 'badge badge-warning';
    btnConnect.textContent = '↻ Obnovit připojení';
    btnConnect.style.display = 'inline-flex';
    btnSync.style.display = 'none';
    btnDisconnect.style.display = 'inline-flex';
    info.textContent = 'Token vypršel (po cca 1 hodině). Klikni na "Obnovit připojení" — výběr účtu bude rychlý.';
  } else if (status === 'syncing') {
    badge.textContent = detail.direction === 'pull' ? 'stahuji…' : 'nahrávám…';
    badge.className = 'badge badge-accent';
    info.textContent = detail.direction === 'pull' ? 'Stahuji změny z Google Drive…' : 'Nahrávám změny na Google Drive…';
  } else if (status === 'synced') {
    badge.textContent = 'připojeno';
    badge.className = 'badge badge-success';
    const time = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    info.textContent = `Naposledy synchronizováno v ${time}${detail.skipped ? ' (žádné nové změny)' : ''}.`;
  } else if (status === 'error') {
    badge.textContent = 'chyba';
    badge.className = 'badge badge-danger';
    info.innerHTML = `<span style="color: var(--danger);">⚠ ${detail.message || 'Nastala chyba'}</span>`;
  } else {
    badge.textContent = 'odpojeno';
    badge.className = 'badge';
    btnConnect.style.display = 'inline-flex';
    btnSync.style.display = 'none';
    btnDisconnect.style.display = 'none';
    info.textContent = 'Nepřipojeno. Klikni na "Připojit Google Drive" pro synchronizaci.';
  }
}

function openWeightModal() {
  const latest = BodyWeight.latest();
  const modal = openModal(`
    <h3 class="mb-5">Záznam váhy</h3>
    <div class="field">
      <label>Datum</label>
      <input type="date" id="weight-date" value="${DateUtil.today()}">
    </div>
    <div class="field">
      <label>Váha (kg)</label>
      <input type="number" id="weight-value" step="0.1" placeholder="${latest ? latest.weight : '75.0'}" autofocus>
    </div>
    <div class="field">
      <label>Poznámka (volitelné)</label>
      <input type="text" id="weight-note" placeholder="ráno, po WC, ...">
    </div>
    <div class="flex gap-3 mt-5" style="justify-content: flex-end;">
      <button class="btn btn-ghost" onclick="closeModal()">Zrušit</button>
      <button class="btn btn-primary" id="weight-save">Uložit</button>
    </div>
  `);
  modal.querySelector('#weight-save').onclick = () => {
    const value = modal.querySelector('#weight-value').value;
    const date = modal.querySelector('#weight-date').value;
    const note = modal.querySelector('#weight-note').value;
    if (!value || isNaN(parseFloat(value))) {
      toast('Zadej platnou váhu');
      return;
    }
    BodyWeight.add(value, date, note);
    closeModal();
    toast('Váha uložena ✓');
    renderWeightSummary();
    renderWeightChart();
    renderWeightHistory();
  };
}

function saveSettings() {
  const name = document.getElementById('setting-name').value.trim();
  const height = parseInt(document.getElementById('setting-height').value);
  const level = document.getElementById('setting-level').value;
  Settings.save({
    name: name || 'Martin',
    height_cm: isNaN(height) ? null : height,
    level,
  });
  document.getElementById('profile-title').textContent = name || 'Martin';
  toast('Nastavení uloženo ✓');
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      confirmAction(`Importovat ${data.workouts?.length || 0} tréninků, ${data.blocks?.length || 0} bloků a ${data.body_weights?.length || 0} záznamů váhy? Stávající data budou přepsána.`, () => {
        DataIO.importJSON(data);
        toast('Data importována ✓');
        setTimeout(() => location.reload(), 500);
      });
    } catch (err) {
      toast('Chybný formát souboru');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function clearAllData() {
  confirmAction('Opravdu smazat VŠECHNA data? Tato akce je nevratná. Doporučujeme nejdřív Export.', () => {
    localStorage.removeItem(STORAGE_KEYS.WORKOUTS);
    localStorage.removeItem(STORAGE_KEYS.BLOCKS);
    localStorage.removeItem(STORAGE_KEYS.BODY_WEIGHTS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    toast('Data smazána');
    setTimeout(() => location.reload(), 500);
  });
}
