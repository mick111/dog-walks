/* ── State ─────────────────────────────────────────────────── */
let OFFSET = 0;
const LIMIT = 20;
let LOADING = false;
let ALL_LOADED = false;

/* ── Helpers ───────────────────────────────────────────────── */
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
};

/* ── API ───────────────────────────────────────────────────── */
async function api(url, opts) {
  opts = opts || {};
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    method: opts.method,
    body: opts.body,
  });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch(e) { err = { error: res.statusText }; }
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

/* ── Render walks list ─────────────────────────────────────── */
function renderWalk(w) {
  const p = document.createElement('div');
  p.className = 'walk-item';

  const details = [];
  if (w.poo_size) {
    const labels = { big:'Gros', medium:'Moyen', small:'Petit' };
    details.push('[poop ' + (labels[w.poo_size] || w.poo_size) + ']');
  }
  for (let i = 0; i < w.pees.length; i++) {
    const labels = { big:'Gros', medium:'Moyen', small:'Petit' };
    details.push('[wee ' + (labels[w.pees[i].size] || w.pees[i].size) + ']');
  }

  let noteLine = '';
  if (w.note) {
    const d = document.createElement('div');
    d.textContent = w.note.substring(0, 80);
    noteLine = '<div class="walk-note-preview">' + d.innerHTML + '</div>';
  }

  const typeEmoji = w.type === 'walk' ? 'walk' : 'pee';
  const typeLabel = w.type === 'walk' ? 'Balade' : 'Pipi';

  p.innerHTML =
    '<div class="walk-emoji">' + typeEmoji + '</div>' +
    '<div class="walk-info">' +
      '<div><span class="walk-time">' + w.time + '</span>' +
      '<span class="walk-type-label">' + typeLabel + '</span></div>' +
      '<div class="walk-details">' + details.join(' ') + '</div>' +
      noteLine +
    '</div>';

  p.addEventListener('click', () => editWalk(w.id));
  return p;
}

async function loadWalks(append) {
  if (LOADING || ALL_LOADED) return;
  LOADING = true;
  try {
    const rows = await api('/api/walks?limit=' + LIMIT + '&offset=' + OFFSET);
    const c = document.getElementById('walks-list');
    if (!append) {
      c.innerHTML = '';
      OFFSET = 0;
      ALL_LOADED = false;
    } else {
      const f = c.children[0];
      if (f && f.className === 'empty-state') c.innerHTML = '';
    }
    if (rows.length === 0 && !append) {
      c.innerHTML = '<p class="empty-state">Aucune sortie enregistree.</p>';
      document.getElementById('load-more').style.display = 'none';
      return;
    }
    for (let i = 0; i < rows.length; i++) c.appendChild(renderWalk(rows[i]));
    OFFSET += rows.length;
    ALL_LOADED = rows.length < LIMIT;
    document.getElementById('load-more').style.display = ALL_LOADED ? 'none' : 'block';
  } catch (e) {
    console.error('loadWalks:', e);
  } finally {
    LOADING = false;
  }
}

/* ── Add form ──────────────────────────────────────────────── */
function setupForm() {
  document.getElementById('walk-date').value = today();
  document.getElementById('walk-time').value = nowTime();
}

function addPeeRow(containerId) {
  const c = document.getElementById(containerId || 'pees-container');
  const row = document.createElement('div');
  row.className = 'pee-row';
  row.innerHTML =
    '<select class="pee-size">' +
      '<option value="small">Petit</option>' +
      '<option value="medium" selected>Moyen</option>' +
      '<option value="big">Gros</option>' +
    '</select>' +
    '<button type="button" class="btn btn-sm btn-remove" onclick="this.closest(\'.pee-row\').remove(); checkPeeEmpty(this)">X</button>';
  c.appendChild(row);
}

function checkPeeEmpty(btn) {
  const c = btn.closest('#pees-container, #edit-pees-container');
  if (c && c.children.length === 0) addPeeRow(c.id);
}

function getPeeSizes(containerId) {
  const sel = document.querySelectorAll('#' + (containerId || 'pees-container') + ' .pee-size');
  const r = [];
  for (let i = 0; i < sel.length; i++) r.push(sel[i].value);
  return r;
}

async function submitWalk(e) {
  e.preventDefault();
  const t = document.querySelector('#walk-type input:checked');
  const type = t ? t.value : 'walk';
  const p = document.querySelector('#poo-group input:checked');
  const poo = p ? (p.value || null) : null;
  const payload = {
    date: document.getElementById('walk-date').value,
    time: document.getElementById('walk-time').value,
    type: type,
    poo_size: poo,
    pees: getPeeSizes('pees-container'),
    note: document.getElementById('walk-note').value.trim(),
  };
  try {
    await api('/api/walks', { method: 'POST', body: JSON.stringify(payload) });
    setupForm();
    document.getElementById('pees-container').innerHTML = '';
    addPeeRow('pees-container');
    document.getElementById('walk-note').value = '';
    refreshAll();
  } catch (ex) {
    alert('Erreur : ' + ex.message);
  }
}

/* ── Edit / Delete ─────────────────────────────────────────── */
async function editWalk(id) {
  try {
    const w = await api('/api/walks/' + id);
    showEditModal(w);
  } catch (ex) {
    alert('Error: ' + ex.message);
  }
}

function showEditModal(w) {
  const body = document.getElementById('edit-body');

  let peesHtml = '';
  const labels = { small: 'Petit', medium: 'Moyen', big: 'Gros' };
  for (let i = 0; i < w.pees.length; i++) {
    const p = w.pees[i];
    peesHtml +=
      '<div class="pee-row">' +
        '<select class="pee-size">' +
          '<option value="small"' + (p.size === 'small' ? ' selected' : '') + '>' + labels.small + '</option>' +
          '<option value="medium"' + (p.size === 'medium' ? ' selected' : '') + '>' + labels.medium + '</option>' +
          '<option value="big"' + (p.size === 'big' ? ' selected' : '') + '>' + labels.big + '</option>' +
        '</select>' +
        '<button type="button" class="btn btn-sm btn-remove" onclick="this.closest(\'.pee-row\').remove(); checkPeeEmpty(this)">X</button>' +
      '</div>';
  }
  if (!peesHtml) peesHtml = '<p class="text-muted">Aucun pipi</p>';

  const noteEsc = escHtml(w.note);

  body.innerHTML =
    '<form class="edit-form" id="edit-form" autocomplete="off">' +
      '<input type="hidden" id="edit-id" value="' + w.id + '">' +

      '<div class="form-row">' +
        '<label class="form-label">Quand</label>' +
        '<div class="form-inline">' +
          '<input type="date" id="edit-date" value="' + w.date + '" required>' +
          '<input type="time" id="edit-time" value="' + w.time + '" required>' +
        '</div></div>' +

      '<div class="form-row">' +
        '<label class="form-label">Type</label>' +
        '<div class="radio-group" id="edit-type">' +
          '<label class="radio-btn"><input type="radio" name="edit-type" value="walk"' + (w.type === 'walk' ? ' checked' : '') + '> Balade</label>' +
          '<label class="radio-btn"><input type="radio" name="edit-type" value="pee"' + (w.type === 'pee' ? ' checked' : '') + '> Pipi</label>' +
        '</div></div>' +

      '<div class="form-row">' +
        '<label class="form-label">Caca</label>' +
        '<div class="radio-group" id="edit-poo">' +
          '<label class="radio-btn"><input type="radio" name="edit-poo" value=""' + (!w.poo_size ? ' checked' : '') + '> Non</label>' +
          '<label class="radio-btn"><input type="radio" name="edit-poo" value="small"' + (w.poo_size === 'small' ? ' checked' : '') + '> Petit</label>' +
          '<label class="radio-btn"><input type="radio" name="edit-poo" value="medium"' + (w.poo_size === 'medium' ? ' checked' : '') + '> Moyen</label>' +
          '<label class="radio-btn"><input type="radio" name="edit-poo" value="big"' + (w.poo_size === 'big' ? ' checked' : '') + '> Gros</label>' +
        '</div></div>' +

      '<div class="form-row">' +
        '<label class="form-label">Pipis (plusieurs possibles)</label>' +
        '<div id="edit-pees-container">' + peesHtml + '</div>' +
        '<button type="button" class="btn btn-sm" onclick="addPeeRow(\'edit-pees-container\')">+ Ajouter un pipi</button>' +
      '</div>' +

      '<div class="form-row">' +
        '<label class="form-label" for="edit-note">Note</label>' +
        '<textarea id="edit-note" rows="2" placeholder="Optionnel...">' + noteEsc + '</textarea>' +
      '</div>' +

      '<div class="form-actions">' +
        '<button type="button" class="btn btn-danger" onclick="delWalk(' + w.id + ')">Supprimer</button>' +
        '<button type="submit" class="btn btn-primary">Enregistrer</button>' +
        '<button type="button" class="btn btn-secondary" onclick="closeEdit()">Annuler</button>' +
      '</div>' +
    '</form>';

  document.getElementById('edit-modal').style.display = 'flex';
  document.getElementById('edit-form').onsubmit = submitEdit;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function submitEdit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const ti = document.querySelector('#edit-type input:checked');
  const type = ti ? ti.value : 'walk';
  const pi = document.querySelector('#edit-poo input:checked');
  const poo = pi ? (pi.value || null) : null;
  try {
    await api('/api/walks/' + id, {
      method: 'PUT',
      body: JSON.stringify({
        date: document.getElementById('edit-date').value,
        time: document.getElementById('edit-time').value,
        type: type,
        poo_size: poo,
        pees: getPeeSizes('edit-pees-container'),
        note: document.getElementById('edit-note').value.trim(),
      }),
    });
    closeEdit();
    refreshAll();
  } catch (ex) {
    alert('Erreur : ' + ex.message);
  }
}

async function delWalk(id) {
  if (!confirm('Supprimer cette sortie ?')) return;
  try {
    await api('/api/walks/' + id, { method: 'DELETE' });
    closeEdit();
    refreshAll();
  } catch (ex) {
    alert('Erreur : ' + ex.message);
  }
}

function closeEdit() {
  document.getElementById('edit-modal').style.display = 'none';
}

/* ── Stats ─────────────────────────────────────────────────── */
async function showStats() {
  document.getElementById('stats-modal').style.display = 'flex';
  const body = document.getElementById('stats-body');
  body.innerHTML = '<p>Chargement...</p>';
  try {
    renderStats(await api('/api/stats?days=14'), body);
  } catch (ex) {
    body.innerHTML = '<p class="text-muted">Erreur: ' + ex.message + '</p>';
  }
}

function renderStats(stats, body) {
  const t = stats.totals;
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  let html = '<table class="stats-table"><thead><tr><th>Jour</th><th>Sorties</th><th>Balade</th><th>Pipi</th><th>Caca</th><th>Pipis</th></tr></thead><tbody>';
  for (let i = 0; i < stats.perDay.length; i++) {
    const d = stats.perDay[i];
    const dn = days[new Date(d.date + 'T12:00:00').getDay()];
    html += '<tr><td class="day-name">' + dn + ' ' + d.date + '</td><td>' + d.total + '</td><td>' + d.walks + '</td><td>' + d.pees + '</td><td>' + d.poos + '</td><td>' + d.pee_count + '</td></tr>';
  }
  html += '</tbody></table>';
  html += '<div class="stats-totals">' +
    '<div class="stat"><span class="stat-num">' + t.total + '</span> sorties</div>' +
    '<div class="stat"><span class="stat-num">' + t.walks + '</span> balades</div>' +
    '<div class="stat"><span class="stat-num">' + t.pees + '</span> pipi</div>' +
    '<div class="stat-poo"><span class="stat-num">' + t.poos + '</span> caca</div>' +
    '<div class="stat"><span class="stat-num">' + t.pee_count + '</span> pipis</div></div>' +
    '<p class="text-muted" style="margin-top:8px">Depuis le ' + stats.since + '</p>';
  body.innerHTML = html;
}

function closeStats() {
  document.getElementById('stats-modal').style.display = 'none';
}

/* ── Today summary ─────────────────────────────────────────── */
async function loadTodaySummary() {
  try {
    const rows = await api('/api/walks?date=' + today() + '&limit=100');
    document.getElementById('today-date').textContent = formatDate(today());
    document.getElementById('today-total').textContent = rows.length;
    let walks = 0, pees = 0, poos = 0, multiPees = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.type === 'walk') walks++;
      if (r.type === 'pee') pees++;
      if (r.poo_size) poos++;
      multiPees += r.pees.length;
    }
    document.getElementById('today-walks').textContent = walks;
    document.getElementById('today-pees').textContent = pees;
    document.getElementById('today-poo').textContent = poos;
    document.getElementById('today-multi-pee').textContent = multiPees;
  } catch (e) {
    console.error('today summary:', e);
  }
}

function formatDate(d) {
  const days = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const parts = d.split('-');
  return days[new Date(d + 'T12:00:00').getDay()] + ' ' + parts[2] + '/' + parts[1];
}

function loadMore() { loadWalks(true); }

async function refreshAll() {
  OFFSET = 0;
  ALL_LOADED = false;
  await loadTodaySummary();
  await loadWalks(false);
}

/* ── Init ──────────────────────────────────────────────────── */
setupForm();
document.addEventListener('DOMContentLoaded', refreshAll);