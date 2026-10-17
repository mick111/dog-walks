/* ── State ─────────────────────────────────────────────────── */
let OFFSET = 0
const LIMIT = 20
let LOADING = false
let ALL_LOADED = false

/* ── Helpers ───────────────────────────────────────────────── */
const today = () => new Date().toISOString().slice(0, 10)
const nowTime = () => {
  const d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
const AUTHOR_COOKIE = 'dogwalks_author'
const AUTHORS = { michael: 'Michael', benjamin: 'Benjamin' }

/* ── Cookie utils ─────────────────────────────────────────── */
function getCookie(name) {
  var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
  return v ? decodeURIComponent(v.pop()) : ''
}
function setCookie(name, val, days) {
  var d = new Date()
  d.setTime(d.getTime() + days * 864e5)
  document.cookie = name + '=' + encodeURIComponent(val) + ';path=/;expires=' + d.toUTCString()
}

/* ── Author helpers ────────────────────────────────────────── */
function getCurrentAuthor() {
  return getCookie(AUTHOR_COOKIE) || 'michael'
}
function setAuthor(val) {
  val = val || getCurrentAuthor()
  if (!AUTHORS[val]) val = 'michael'
  setCookie(AUTHOR_COOKIE, val, 365)
  // Update form radio
  var r = document.querySelector('#walk-author input[value="' + val + '"]')
  if (r) r.checked = true
  // Update select
  var s = document.getElementById('author-select')
  if (s) s.value = val
  // Update header label
  var h = document.getElementById('header-author')
  if (h) h.textContent = '· ' + AUTHORS[val]
  // Update edit radios (when modal open)
  var er = document.querySelector('#edit-author input[value="' + val + '"]')
  if (er) er.checked = true
}

/* ── API ───────────────────────────────────────────────────── */
async function api(url, opts) {
  opts = opts || {}
  var res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, method: opts.method, body: opts.body })
  if (!res.ok) {
    var err
    try { err = await res.json() } catch(e) { err = { error: res.statusText } }
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

/* ── Render walks list ─────────────────────────────────────── */
function renderWalk(w) {
  var p = document.createElement('div')
  p.className = 'walk-item'

  var details = []
  if (w.poo_size) {
    var labels = { big: 'Gros', medium: 'Moyen', small: 'Petit' }
    details.push('💩 ' + (labels[w.poo_size] || w.poo_size))
  }
  for (var i = 0; i < w.pees.length; i++) {
    var labels = { big: 'Gros', medium: 'Moyen', small: 'Petit' }
    details.push('💦 ' + (labels[w.pees[i].size] || w.pees[i].size))
  }

  // Author badge
  var authorBadge = ''
  if (w.author && AUTHORS[w.author]) {
    authorBadge = '<span class="author-badge">' + AUTHORS[w.author] + '</span>'
  }

  var noteLine = ''
  if (w.note) {
    var d = document.createElement('div')
    d.textContent = w.note.substring(0, 80)
    noteLine = '<div class="walk-note-preview">' + d.innerHTML + '</div>'
  }

  var typeEmoji = w.type === 'walk' ? '🚶' : '💦'
  var typeLabel = w.type === 'walk' ? 'Balade' : 'Pipi'

  // Duration badge
  var durLine = ''
  if (w.duration) {
    durLine = '<span class="walk-duration">' + w.duration + ' min</span>'
  }

  p.innerHTML =
    '<div class="walk-emoji">' + typeEmoji + '</div>' +
    '<div class="walk-info">' +
    '<div><span class="walk-time">' + w.time + '</span>' +
    '<span class="walk-type-label">' + typeLabel + '</span>' +
    durLine +
    authorBadge +
    '</div>' +
    '<div class="walk-details">' + details.join(' ') + '</div>' +
    noteLine +
    '</div>'

  p.addEventListener('click', () => editWalk(w.id))
  return p
}

async function loadWalks(append) {
  if (LOADING || ALL_LOADED) return
  LOADING = true
  try {
    var rows = await api('/api/walks?limit=' + LIMIT + '&offset=' + OFFSET)
    var c = document.getElementById('walks-list')
    if (!append) {
      c.innerHTML = ''
      OFFSET = 0
      ALL_LOADED = false
    } else {
      var f = c.children[0]
      if (f && f.className === 'empty-state') c.innerHTML = ''
    }
    if (rows.length === 0 && !append) {
      c.innerHTML = '<p class="empty-state">Aucune sortie enregistrée.</p>'
      document.getElementById('load-more').style.display = 'none'
      return
    }
    for (var j = 0; j < rows.length; j++) c.appendChild(renderWalk(rows[j]))
    OFFSET += rows.length
    ALL_LOADED = rows.length < LIMIT
    document.getElementById('load-more').style.display = ALL_LOADED ? 'none' : 'block'
  } catch (e) {
    console.error('loadWalks:', e)
  } finally {
    LOADING = false
  }
}

/* ── Add form ──────────────────────────────────────────────── */
function setupForm() {
  document.getElementById('walk-date').value = today()
  document.getElementById('walk-time').value = nowTime()
}

function addPeeRow(containerId) {
  var c = document.getElementById(containerId || 'pees-container')
  // Find next index
  var existingRows = c.querySelectorAll('.pee-row')
  var nextIdx = 0
  for (var i = 0; i < existingRows.length; i++) {
    var idx = parseInt(existingRows[i].getAttribute('data-index'))
    if (idx >= nextIdx) nextIdx = idx + 1
  }

  var row = document.createElement('div')
  row.className = 'pee-row'
  row.setAttribute('data-index', nextIdx)
  row.innerHTML =
    '<div class="radio-group" id="pee-size-row-' + nextIdx + '">' +
    '<label class="radio-btn"><input type="radio" name="pee-size-' + nextIdx + '" value="none" checked /> Non</label>' +
    '<label class="radio-btn"><input type="radio" name="pee-size-' + nextIdx + '" value="small" /> 🟢 Petit</label>' +
    '<label class="radio-btn"><input type="radio" name="pee-size-' + nextIdx + '" value="medium" /> 🟡 Moyen</label>' +
    '<label class="radio-btn"><input type="radio" name="pee-size-' + nextIdx + '" value="big" /> 🔴 Gros</label>' +
    '</div>' +
    '<button type="button" class="btn btn-sm btn-remove" onclick="removePeeRow(' + nextIdx + ')">✕</button>'
  c.appendChild(row)
}

function removePeeRow(idx) {
  var c = document.getElementById('pees-container')
  var row = c.querySelector('.pee-row[data-index="' + idx + '"]')
  if (row) row.remove()
  // If no rows left, auto-add one
  if (c.querySelectorAll('.pee-row').length === 0) addPeeRow(c.id)
}

function getPeeSizes(containerId) {
  var container = '#' + (containerId || 'pees-container')
  var rows = document.querySelectorAll(container + ' .pee-row')
  var pees = []
  for (var i = 0; i < rows.length; i++) {
    var selected = rows[i].querySelector('input[type="radio"]:checked')
    if (selected && selected.value !== 'none') {
      pees.push(selected.value)
    }
  }
  return pees
}

function getAuthorRadioValue(groupId) {
  var checked = document.querySelector('#' + groupId + ' input:checked')
  return checked ? checked.value : 'michael'
}

async function submitWalk(e) {
  e.preventDefault()
  var t = document.querySelector('#walk-type input:checked')
  var type = t ? t.value : 'walk'
  var pp = document.querySelector('#poo-group input:checked')
  var poo = pp ? pp.value || null : null
  var author = getAuthorRadioValue('walk-author')
  var durationInput = document.getElementById('walk-duration')
  var duration = durationInput && durationInput.value ? parseInt(durationInput.value) : null
  var payload = {
    date: document.getElementById('walk-date').value,
    time: document.getElementById('walk-time').value,
    type: type,
    author: author,
    duration: duration,
    poo_size: poo,
    pees: getPeeSizes('pees-container'),
    note: document.getElementById('walk-note').value.trim()
  }
  try {
    await api('/api/walks', { method: 'POST', body: JSON.stringify(payload) })
    setupForm()
    setAuthor(author)
    if (document.getElementById('walk-duration')) document.getElementById('walk-duration').value = ''
    document.getElementById('pees-container').innerHTML = ''
    addPeeRow('pees-container')
    document.getElementById('walk-note').value = ''
    refreshAll()
  } catch (ex) {
    alert('Erreur : ' + ex.message)
  }
}

/* ── Edit / Delete ─────────────────────────────────────────── */
async function editWalk(id) {
  try {
    var w = await api('/api/walks/' + id)
    showEditModal(w)
  } catch (ex) {
    alert('Error: ' + ex.message)
  }
}

function showEditModal(w) {
  var body = document.getElementById('edit-body')

  var peesHtml = ''
  for (var i = 0; i < w.pees.length; i++) {
    var p = w.pees[i]
    var noneChecked = !p.size ? ' checked' : ''
    var smallChecked = p.size === 'small' ? ' checked' : ''
    var mediumChecked = p.size === 'medium' ? ' checked' : ''
    var bigChecked = p.size === 'big' ? ' checked' : ''
    peesHtml +=
      '<div class="pee-row">' +
      '<div class="radio-group">' +
      '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + i + '" value="none"' + noneChecked + ' /> Non</label>' +
      '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + i + '" value="small"' + smallChecked + ' /> 🟢 Petit</label>' +
      '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + i + '" value="medium"' + mediumChecked + ' /> 🟡 Moyen</label>' +
      '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + i + '" value="big"' + bigChecked + ' /> 🔴 Gros</label>' +
      '</div>' +
      '<button type="button" class="btn btn-sm btn-remove" onclick="removeEditPeeRow(' + i + ')">✕</button>' +
      '</div>'
  }
  if (!peesHtml) peesHtml = '<p class="text-muted">Aucun pipi</p>'

  var noteEsc = escHtml(w.note)
  var defaultAuthor = w.author || 'michael'
  var defaultDuration = w.duration || ''

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
    '<label class="form-label">Durée (min)</label>' +
    '<input type="number" id="edit-duration" min="0" max="999" placeholder="ex: 15" value="' + defaultDuration + '" />' +
    '</div>' +
    '<div class="form-row">' +
    '<label class="form-label">Auteur</label>' +
    '<div class="radio-group" id="edit-author">' +
    '<label class="radio-btn"><input type="radio" name="edit-author" value="michael"' + (defaultAuthor === 'michael' ? ' checked' : '') + '> Michael</label>' +
    '<label class="radio-btn"><input type="radio" name="edit-author" value="benjamin"' + (defaultAuthor === 'benjamin' ? ' checked' : '') + '> Benjamin</label>' +
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
    '<button type="button" class="btn btn-sm" onclick="addEditPeeRow()">+ Ajouter un pipi</button>' +
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
    '</form>'

  document.getElementById('edit-modal').style.display = 'flex'
  document.getElementById('edit-form').onsubmit = submitEdit
}

function escHtml(s) {
  var d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

// Remove a pee row from edit modal
function removeEditPeeRow(idx) {
  var container = document.getElementById('edit-pees-container')
  var row = container.children[idx]
  if (row) row.remove()
  // Re-index remaining rows
  var rows = container.querySelectorAll('.pee-row')
  for (var i = 0; i < rows.length; i++) {
    // Rebuild names (this is a bit hacky but works)
    var radios = rows[i].querySelectorAll('input[type="radio"]')
    for (var j = 0; j < radios.length; j++) {
      var oldName = radios[j].name
      radios[j].name = oldName.replace(/-\d+/, '-' + i)
    }
    // Fix remove button onclick
    var btn = rows[i].querySelector('.btn-remove')
    if (btn) btn.setAttribute('onclick', 'removeEditPeeRow(' + i + ')')
  }
  if (container.querySelectorAll('.pee-row').length === 0) {
    addEditPeeRow()
  }
}

function addEditPeeRow() {
  var container = document.getElementById('edit-pees-container')
  var existingRows = container.querySelectorAll('.pee-row')
  var nextIdx = existingRows.length

  var row = document.createElement('div')
  row.className = 'pee-row'
  row.innerHTML =
    '<div class="radio-group">' +
    '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + nextIdx + '" value="none" checked /> Non</label>' +
    '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + nextIdx + '" value="small" /> 🟢 Petit</label>' +
    '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + nextIdx + '" value="medium" /> 🟡 Moyen</label>' +
    '<label class="radio-btn"><input type="radio" name="edit-pee-size-' + nextIdx + '" value="big" /> 🔴 Gros</label>' +
    '</div>' +
    '<button type="button" class="btn btn-sm btn-remove" onclick="removeEditPeeRow(' + nextIdx + ')">✕</button>'
  container.appendChild(row)
}

function getEditPeeSizes() {
  var container = document.getElementById('edit-pees-container')
  var rows = container.querySelectorAll('.pee-row')
  var pees = []
  for (var i = 0; i < rows.length; i++) {
    var selected = rows[i].querySelector('input[type="radio"]:checked')
    if (selected && selected.value !== 'none') {
      pees.push(selected.value)
    }
  }
  return pees
}

async function submitEdit(e) {
  e.preventDefault()
  var id = document.getElementById('edit-id').value
  var ti = document.querySelector('#edit-type input:checked')
  var type = ti ? ti.value : 'walk'
  var pi = document.querySelector('#edit-poo input:checked')
  var poo = pi ? pi.value || null : null
  var ai = document.querySelector('#edit-author input:checked')
  var author = ai ? ai.value : 'michael'
  var durEl = document.getElementById('edit-duration')
  var duration = durEl && durEl.value ? parseInt(durEl.value) : null
  try {
    await api('/api/walks/' + id, {
      method: 'PUT',
      body: JSON.stringify({
        date: document.getElementById('edit-date').value,
        time: document.getElementById('edit-time').value,
        type: type,
        author: author,
        duration: duration,
        poo_size: poo,
        pees: getEditPeeSizes(),
        note: document.getElementById('edit-note').value.trim()
      })
    })
    closeEdit()
    refreshAll()
  } catch (ex) {
    alert('Erreur : ' + ex.message)
  }
}

async function delWalk(id) {
  if (!confirm('Supprimer cette sortie ?')) return
  try {
    await api('/api/walks/' + id, { method: 'DELETE' })
    closeEdit()
    refreshAll()
  } catch (ex) {
    alert('Erreur : ' + ex.message)
  }
}

function closeEdit() {
  document.getElementById('edit-modal').style.display = 'none'
}

/* ── Stats ─────────────────────────────────────────────────── */
async function showStats() {
  document.getElementById('stats-modal').style.display = 'flex'
  var body = document.getElementById('stats-body')
  body.innerHTML = '<p>Chargement...</p>'
  try {
    renderStats(await api('/api/stats?days=14'), body)
  } catch (ex) {
    body.innerHTML = '<p class="text-muted">Erreur: ' + ex.message + '</p>'
  }
}

function renderStats(stats, body) {
  var t = stats.totals
  var accTotals = stats.accTotals || { total: 0, big: 0, medium: 0, small: 0 }
  var days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  var html =
    '<table class="stats-table"><thead><tr><th>Jour</th><th>Sorties</th><th>Balade</th><th>Pipi</th><th>Caca</th><th>Pipis</th><th>Accidents</th></tr></thead><tbody>'
  for (var i = 0; i < stats.perDay.length; i++) {
    var d = stats.perDay[i]
    var dn = days[new Date(d.date + 'T12:00:00').getDay()]
    html +=
      '<tr><td class="day-name">' + dn + ' ' + d.date + '</td><td>' + d.total + '</td><td>' + d.walks + '</td><td>' + d.pees + '</td><td>' + d.poos + '</td><td>' + d.pee_count + '</td><td>-</td></tr>'
  }
  html += '</tbody></table>'
  html +=
    '<div class="stats-totals">' +
    '<div class="stat"><span class="stat-num">' + t.total + '</span> sorties</div>' +
    '<div class="stat"><span class="stat-num">' + t.walks + '</span> balades</div>' +
    '<div class="stat"><span class="stat-num">' + t.pees + '</span> pipi</div>' +
    '<div class="stat-poo"><span class="stat-num">' + t.poos + '</span> caca</div>' +
    '<div class="stat"><span class="stat-num">' + t.pee_count + '</span> pipis</div>' +
    '<div class="stat accident-stat"><span class="stat-num">' + (accTotals.total || 0) + '</span> 🚨 accidents</div>' +
    '</div>' +
    '<p class="text-muted" style="margin-top:8px">Depuis le ' + stats.since + '</p>'
  body.innerHTML = html
}

function closeStats() {
  document.getElementById('stats-modal').style.display = 'none'
}

/* ── Today summary ─────────────────────────────────────────── */
async function loadTodaySummary() {
  try {
    var rows = await api('/api/walks?date=' + today() + '&limit=100')
    document.getElementById('today-date').textContent = formatDate(today())
    document.getElementById('today-total').textContent = rows.length
    var walks = 0, pees = 0, poos = 0, multiPees = 0
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]
      if (r.type === 'walk') walks++
      if (r.type === 'pee') pees++
      if (r.poo_size) poos++
      multiPees += r.pees.length
    }
    document.getElementById('today-walks').textContent = walks
    document.getElementById('today-pees').textContent = pees
    document.getElementById('today-poo').textContent = poos
    document.getElementById('today-multi-pee').textContent = multiPees

    var accs = await api('/api/accidents?date=' + today() + '&limit=100')
    var accEl = document.getElementById('today-accidents')
    if (accEl) accEl.textContent = accs.length
  } catch (e) {
    console.error('today summary:', e)
  }
}

function formatDate(d) {
  var days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  var parts = d.split('-')
  return days[new Date(d + 'T12:00:00').getDay()] + ' ' + parts[2] + '/' + parts[1]
}

function loadMore() {
  loadWalks(true)
}

async function refreshAll() {
  OFFSET = 0
  ALL_LOADED = false
  await loadTodaySummary()
  await loadWalks(false)
  loadAccidents()
}

/* ── Accidents ─────────────────────────────────────────────── */
async function submitAccident(e) {
  e.preventDefault()
  var authorRadio = document.querySelector('#accident-author input:checked')
  var author = authorRadio ? authorRadio.value : 'michael'
  var sizeRadio = document.querySelector('#accident-size input:checked')
  var size = sizeRadio ? sizeRadio.value : 'small'
  var payload = {
    date: document.getElementById('accident-date').value,
    time: document.getElementById('accident-time').value,
    author: author,
    size: size,
    note: document.getElementById('accident-note').value.trim()
  }
  try {
    await api('/api/accidents', { method: 'POST', body: JSON.stringify(payload) })
    setAuthor(author)
    document.getElementById('accident-date').value = today()
    document.getElementById('accident-time').value = nowTime()
    document.getElementById('accident-note').value = ''
    await refreshAll()
  } catch (ex) {
    alert('Erreur : ' + ex.message)
  }
}

function renderAccident(a) {
  var p = document.createElement('div')
  p.className = 'walk-item'
  var accLabels = { big: 'Gros', medium: 'Moyen', small: 'Petit' }
  var sizeEmoji = a.size === 'big' ? '🔴' : (a.size === 'medium' ? '🟡' : '🟢')
  p.innerHTML =
    '<div class="walk-emoji">🚨</div>' +
    '<div class="walk-info">' +
    '<div><span class="walk-time">' + a.time + '</span>' +
    '<span class="walk-type-label">Accident</span>' +
    (a.author && AUTHORS[a.author] ? ' <span class="author-badge">' + AUTHORS[a.author] + '</span>' : '') +
    '</div>' +
    '<div class="walk-details">' + sizeEmoji + ' ' + (accLabels[a.size] || a.size) + '</div>' +
    (a.note ? '<div class="walk-note-preview">' + escHtml(a.note) + '</div>' : '') +
    '</div>'
  return p
}

async function loadAccidents() {
  try {
    var el = document.getElementById('accidents-list')
    var rows = await api('/api/accidents?limit=50')
    if (rows.length === 0) {
      el.innerHTML = '<p class="empty-state">Aucun accident enregistré.</p>'
    } else {
      el.innerHTML = ''
      for (var i = 0; i < rows.length; i++) el.appendChild(renderAccident(rows[i]))
    }
  } catch (e) {
    console.error('loadAccidents:', e)
  }
}

/* ── Init ──────────────────────────────────────────────────── */
setupForm()
document.addEventListener('DOMContentLoaded', function () {
  setAuthor(getCurrentAuthor())
  // Initialize pee rows if empty
  var pc = document.getElementById('pees-container')
  if (!pc || pc.querySelectorAll('.pee-row').length === 0) {
    addPeeRow('pees-container')
  }
  refreshAll()
})