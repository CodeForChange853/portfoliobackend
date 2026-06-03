let TOKEN = localStorage.getItem('crm_token') || null;
let currentPage = 'overview';
let leadsData = [];
let projectsData = [];

// ---- API ----

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (res.status === 204) return null;
  return res.json();
}

// ---- Auth ----

async function doLogin(username, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data && data.token) {
    TOKEN = data.token;
    localStorage.setItem('crm_token', TOKEN);
    renderApp();
  } else {
    const el = document.getElementById('login-error');
    if (el) el.textContent = 'Invalid credentials';
  }
}

async function doLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  TOKEN = null;
  localStorage.removeItem('crm_token');
  renderApp();
}

// ---- Router ----

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  loadPage();
}

// ---- Render ----

function renderApp() {
  const app = document.getElementById('app');
  if (!TOKEN) {
    app.innerHTML = loginHTML();
    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      doLogin(document.getElementById('username').value, document.getElementById('password').value);
    });
    return;
  }
  app.innerHTML = layoutHTML();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });
  document.getElementById('logout-btn').addEventListener('click', doLogout);
  loadPage();
}

function loginHTML() {
  return `
    <div class="login-container">
      <div class="login-card glass">
        <div class="login-logo">
          <span class="logo-bracket">[</span>AG<span class="logo-bracket">]</span>
        </div>
        <p class="login-sub">Portfolio CRM Panel</p>
        <form id="login-form">
          <div class="form-group">
            <label>USERNAME</label>
            <input type="text" id="username" autocomplete="username" placeholder="admin">
          </div>
          <div class="form-group">
            <label>PASSWORD</label>
            <input type="password" id="password" autocomplete="current-password" placeholder="••••••••">
          </div>
          <p id="login-error" class="error-text"></p>
          <button type="submit" class="btn-primary">ACCESS SYSTEM</button>
        </form>
      </div>
    </div>`;
}

function layoutHTML() {
  const navItems = [
    { id: 'overview', icon: '◈', label: 'OVERVIEW' },
    { id: 'leads', icon: '◎', label: 'LEADS' },
    { id: 'projects', icon: '▦', label: 'PROJECTS' },
    { id: 'analytics', icon: '◉', label: 'ANALYTICS' },
  ];
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <span class="logo-bracket">[</span>AG<span class="logo-bracket">]</span>
          </div>
          <span class="sidebar-title">CRM PANEL</span>
        </div>
        <nav>
          <ul class="nav-list">
            ${navItems.map(n => `
              <li class="nav-item${currentPage === n.id ? ' active' : ''}" data-page="${n.id}">
                <span class="nav-icon">${n.icon}</span><span>${n.label}</span>
              </li>`).join('')}
          </ul>
        </nav>
        <button class="btn-logout" id="logout-btn">⏻ LOGOUT</button>
      </aside>
      <main class="main-content">
        <div id="page-content"></div>
      </main>
    </div>`;
}

async function loadPage() {
  const el = document.getElementById('page-content');
  el.innerHTML = '<div class="loading">LOADING...</div>';
  if (currentPage === 'overview') await pageOverview();
  else if (currentPage === 'leads') await pageLeads();
  else if (currentPage === 'projects') await pageProjects();
  else if (currentPage === 'analytics') await pageAnalytics();
}

// ---- Overview ----

async function pageOverview() {
  const [leads, projects, analytics] = await Promise.all([
    apiFetch('/api/leads'),
    apiFetch('/api/projects'),
    apiFetch('/api/analytics/stats'),
  ]);
  const newLeads = leads.filter(l => l.status === 'new').length;
  const counts = analytics.counts || {};
  const avgRating = calcAvgRating(analytics.rating_distribution || []);

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1>OVERVIEW</h1>
      <span class="page-sub">System Status: <span class="status-online">● ONLINE</span></span>
    </div>
    <div class="stats-grid">
      <div class="stat-card glass">
        <div class="stat-icon">◎</div>
        <div class="stat-value">${leads.length}</div>
        <div class="stat-label">Total Leads</div>
        <div class="stat-badge new">${newLeads} new</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">◈</div>
        <div class="stat-value">${counts.view || 0}</div>
        <div class="stat-label">Portfolio Views</div>
        <div class="stat-badge">${analytics.unique_views || 0} unique</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">♥</div>
        <div class="stat-value">${counts.react || 0}</div>
        <div class="stat-label">Reactions</div>
        <div class="stat-badge">${counts.share || 0} shares</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">★</div>
        <div class="stat-value">${avgRating || '—'}</div>
        <div class="stat-label">Avg Rating</div>
        <div class="stat-badge">${projects.length} projects</div>
      </div>
    </div>
    <div class="overview-grid">
      <div class="glass panel">
        <h2>Recent Leads</h2>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${leads.slice(0, 6).map(l => `
              <tr>
                <td>${esc(l.name)}</td>
                <td>${esc(l.email)}</td>
                <td><span class="badge badge-${l.status}">${l.status.toUpperCase()}</span></td>
                <td class="lead-date">${fmtDate(l.created_at)}</td>
              </tr>`).join('') || '<tr><td colspan="4" class="empty">No leads yet</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="glass panel">
        <h2>Daily Views — Last 7 Days</h2>
        <div class="bar-chart">${barChart(analytics.daily_views || [])}</div>
      </div>
    </div>`;
}

// ---- Leads ----

async function pageLeads() {
  leadsData = await apiFetch('/api/leads');
  renderLeadsPage(leadsData);
}

function renderLeadsPage(data) {
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1>LEADS</h1>
      <span class="page-sub">${leadsData.length} total · ${leadsData.filter(l => l.status === 'new').length} new</span>
    </div>
    <div class="filter-bar">
      ${['all','new','contacted','closed'].map(f => `
        <button class="filter-btn${data === leadsData || f === 'all' ? '' : ''}" data-filter="${f}">${f.toUpperCase()}</button>`).join('')}
    </div>
    <div id="leads-container">${leadsTable(data)}</div>`;

  // mark the correct filter active
  document.querySelector(`.filter-btn[data-filter="all"]`).classList.add('active');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      const filtered = f === 'all' ? leadsData : leadsData.filter(l => l.status === f);
      document.getElementById('leads-container').innerHTML = leadsTable(filtered);
      attachLeadRowEvents();
    });
  });
  attachLeadRowEvents();
}

function leadsTable(data) {
  if (!data.length) return '<div class="glass panel empty-state">No leads found</div>';
  return `
    <div class="glass panel" style="padding:0;overflow:hidden">
      <table class="data-table leads-table">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Message</th>
            <th>Status</th><th>Date</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(l => `
            <tr data-id="${l.id}">
              <td class="lead-name">${esc(l.name)}</td>
              <td><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></td>
              <td><span class="msg-preview" title="${esc(l.message)}">${esc(l.message.substring(0,60))}${l.message.length > 60 ? '…' : ''}</span></td>
              <td>
                <select class="status-select badge-${l.status}" data-id="${l.id}">
                  <option value="new" ${l.status==='new'?'selected':''}>NEW</option>
                  <option value="contacted" ${l.status==='contacted'?'selected':''}>CONTACTED</option>
                  <option value="closed" ${l.status==='closed'?'selected':''}>CLOSED</option>
                </select>
              </td>
              <td class="lead-date">${fmtDate(l.created_at)}</td>
              <td>
                <button class="btn-icon btn-note" data-id="${l.id}" title="Notes">✎</button>
                <button class="btn-icon btn-delete" data-id="${l.id}" title="Delete">✕</button>
              </td>
            </tr>
            ${l.notes ? `<tr class="notes-row"><td colspan="6"><span class="note-text">✎ ${esc(l.notes)}</span></td></tr>` : ''}`
          ).join('')}
        </tbody>
      </table>
    </div>`;
}

function attachLeadRowEvents() {
  document.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = parseInt(sel.dataset.id);
      await apiFetch('/api/leads/' + id, { method: 'PUT', body: JSON.stringify({ status: sel.value }) });
      sel.className = 'status-select badge-' + sel.value;
      leadsData = leadsData.map(l => l.id === id ? { ...l, status: sel.value } : l);
    });
  });

  document.querySelectorAll('.btn-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const lead = leadsData.find(l => l.id === parseInt(btn.dataset.id));
      showNotesModal(lead);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this lead?')) return;
      const id = parseInt(btn.dataset.id);
      await apiFetch('/api/leads/' + id, { method: 'DELETE' });
      leadsData = leadsData.filter(l => l.id !== id);
      document.getElementById('leads-container').innerHTML = leadsTable(leadsData);
      attachLeadRowEvents();
    });
  });
}

function showNotesModal(lead) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal glass">
      <h2>NOTES — ${esc(lead.name)}</h2>
      <p class="modal-email">${esc(lead.email)}</p>
      <p class="modal-msg">"${esc(lead.message)}"</p>
      <textarea id="notes-input" rows="4" placeholder="Add notes here...">${esc(lead.notes || '')}</textarea>
      <div class="modal-actions">
        <button class="btn-primary" id="save-note">SAVE NOTE</button>
        <button class="btn-secondary" id="close-modal">CANCEL</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('save-note').addEventListener('click', async () => {
    const notes = document.getElementById('notes-input').value;
    await apiFetch('/api/leads/' + lead.id, { method: 'PUT', body: JSON.stringify({ notes }) });
    leadsData = leadsData.map(l => l.id === lead.id ? { ...l, notes } : l);
    overlay.remove();
    document.getElementById('leads-container').innerHTML = leadsTable(leadsData);
    attachLeadRowEvents();
  });

  document.getElementById('close-modal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ---- Projects ----

async function pageProjects() {
  projectsData = await apiFetch('/api/projects');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1>PROJECTS</h1>
      <button class="btn-primary" id="add-project-btn" style="width:auto;padding:0.6rem 1.2rem">+ ADD PROJECT</button>
    </div>
    <div id="project-form-area"></div>
    <div id="projects-grid">${projectsGrid(projectsData)}</div>`;

  document.getElementById('add-project-btn').addEventListener('click', () => renderProjectForm());
  bindProjectCardEvents();
}

function projectsGrid(data) {
  if (!data.length) return '<div class="glass panel empty-state">No projects yet — add one above.</div>';
  return `<div class="projects-grid">${data.map(projectCard).join('')}</div>`;
}

function projectCard(p) {
  const tech = parseTechStack(p.tech_stack);
  const typeLabel = p.type === 'app' ? 'Application' : 'Web · System';
  return `
    <div class="project-card glass" data-id="${p.id}">
      <div class="project-card-header">
        <h3>${esc(p.title)}</h3>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span class="badge badge-type-${esc(p.type || 'web')}">${typeLabel}</span>
          <span class="badge badge-${p.visible ? 'online' : 'offline'}">${p.visible ? 'LIVE' : 'HIDDEN'}</span>
        </div>
      </div>
      ${p.subtitle ? `<p style="font-size:11px;color:var(--accent);margin:0 0 6px;font-family:var(--font-mono)">${esc(p.subtitle)}</p>` : ''}
      <p class="project-desc">${esc(p.description.substring(0,100))}${p.description.length > 100 ? '…' : ''}</p>
      <div class="tech-tags">${tech.map(t => `<span class="tech-tag">${esc(t)}</span>`).join('')}</div>
      <div class="project-links">
        ${p.live_url ? `<a href="${esc(p.live_url)}" target="_blank" rel="noopener" class="link-tag">↗ LIVE</a>` : ''}
        ${p.github_url ? `<a href="${esc(p.github_url)}" target="_blank" rel="noopener" class="link-tag">⌥ REPO</a>` : ''}
      </div>
      <div class="project-actions">
        <button class="btn-secondary btn-edit-project" data-id="${p.id}">EDIT</button>
        <button class="btn-danger btn-delete-project" data-id="${p.id}">DELETE</button>
      </div>
    </div>`;
}

function renderProjectForm(project = null) {
  const isEdit = !!project;
  const tech = project ? parseTechStack(project.tech_stack).join(', ') : '';
  const langVal = project ? fmtJsonField(project.languages) : '';
  const statsVal = project ? fmtJsonField(project.stats) : '';
  document.getElementById('project-form-area').innerHTML = `
    <div class="glass panel project-form">
      <h2>${isEdit ? 'EDIT PROJECT' : 'NEW PROJECT'}</h2>
      <div class="form-grid">
        <div class="form-group">
          <label>TITLE *</label>
          <input type="text" id="pf-title" value="${esc(project?.title || '')}">
        </div>
        <div class="form-group">
          <label>TYPE</label>
          <select id="pf-type">
            <option value="web" ${(project?.type || 'web') === 'web' ? 'selected' : ''}>Web · System</option>
            <option value="app" ${project?.type === 'app' ? 'selected' : ''}>Application</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>SUBTITLE</label>
          <input type="text" id="pf-subtitle" value="${esc(project?.subtitle || '')}" placeholder="One-line tagline for the project">
        </div>
        <div class="form-group full-width">
          <label>DESCRIPTION *</label>
          <textarea id="pf-desc" rows="3">${esc(project?.description || '')}</textarea>
        </div>
        <div class="form-group full-width">
          <label>TECH STACK (comma-separated)</label>
          <input type="text" id="pf-tech" value="${esc(tech)}" placeholder="React, FastAPI, PostgreSQL">
        </div>
        <div class="form-group">
          <label>LIVE URL</label>
          <input type="url" id="pf-live" value="${esc(project?.live_url || '')}">
        </div>
        <div class="form-group">
          <label>GITHUB URL</label>
          <input type="url" id="pf-github" value="${esc(project?.github_url || '')}">
        </div>
        <div class="form-group">
          <label>IMAGE PATH</label>
          <input type="text" id="pf-image" value="${esc(project?.image || '')}" placeholder="/images/project.png">
        </div>
        <div class="form-group">
          <label>ORDER INDEX</label>
          <input type="number" id="pf-order" value="${project?.order_index ?? 0}">
        </div>
        <div class="form-group">
          <label>VISIBILITY</label>
          <select id="pf-visible">
            <option value="true" ${project?.visible !== false ? 'selected' : ''}>VISIBLE</option>
            <option value="false" ${project?.visible === false ? 'selected' : ''}>HIDDEN</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>LANGUAGE BARS — JSON <span style="opacity:.5;font-weight:400">[{"name":"React","pct":45},{"name":"Python","pct":40}]</span></label>
          <textarea id="pf-languages" rows="3" placeholder='[{"name":"React","pct":45},{"name":"Python","pct":40}]'>${esc(langVal)}</textarea>
        </div>
        <div class="form-group full-width">
          <label>STATS — JSON <span style="opacity:.5;font-weight:400">[["70%","Faster Reg."],["90%","Accuracy"]]</span></label>
          <textarea id="pf-stats" rows="3" placeholder='[["70%","Faster Reg."],["Live","Deployed"]]'>${esc(statsVal)}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="pf-submit" style="width:auto;padding:0.65rem 1.5rem">${isEdit ? 'UPDATE' : 'CREATE'}</button>
        <button class="btn-secondary" id="pf-cancel">CANCEL</button>
      </div>
    </div>`;

  document.getElementById('pf-cancel').addEventListener('click', () => {
    document.getElementById('project-form-area').innerHTML = '';
  });

  document.getElementById('pf-submit').addEventListener('click', async () => {
    const title = document.getElementById('pf-title').value.trim();
    const description = document.getElementById('pf-desc').value.trim();
    if (!title || !description) { alert('Title and description are required'); return; }

    const payload = {
      title,
      subtitle: document.getElementById('pf-subtitle').value.trim(),
      description,
      type: document.getElementById('pf-type').value,
      tech_stack: document.getElementById('pf-tech').value.split(',').map(t => t.trim()).filter(Boolean),
      live_url: document.getElementById('pf-live').value.trim(),
      github_url: document.getElementById('pf-github').value.trim(),
      image: document.getElementById('pf-image').value.trim(),
      order_index: parseInt(document.getElementById('pf-order').value) || 0,
      visible: document.getElementById('pf-visible').value === 'true',
      languages: parseJsonField(document.getElementById('pf-languages').value, []),
      stats: parseJsonField(document.getElementById('pf-stats').value, []),
    };

    if (isEdit) {
      const updated = await apiFetch('/api/projects/' + project.id, { method: 'PUT', body: JSON.stringify(payload) });
      projectsData = projectsData.map(p => p.id === project.id ? updated : p);
    } else {
      const created = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      projectsData.push(created);
    }

    document.getElementById('project-form-area').innerHTML = '';
    document.getElementById('projects-grid').innerHTML = projectsGrid(projectsData);
    bindProjectCardEvents();
  });
}

function bindProjectCardEvents() {
  document.querySelectorAll('.btn-edit-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = projectsData.find(p => p.id === parseInt(btn.dataset.id));
      renderProjectForm(p);
    });
  });
  document.querySelectorAll('.btn-delete-project').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this project?')) return;
      const id = parseInt(btn.dataset.id);
      await apiFetch('/api/projects/' + id, { method: 'DELETE' });
      projectsData = projectsData.filter(p => p.id !== id);
      document.getElementById('projects-grid').innerHTML = projectsGrid(projectsData);
      bindProjectCardEvents();
    });
  });
}

// ---- Analytics ----

async function pageAnalytics() {
  const analytics = await apiFetch('/api/analytics/stats');
  const counts = analytics.counts || {};

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1>ANALYTICS</h1>
      <span class="page-sub">Portfolio engagement metrics</span>
    </div>
    <div class="stats-grid">
      <div class="stat-card glass">
        <div class="stat-icon">◈</div>
        <div class="stat-value">${counts.view || 0}</div>
        <div class="stat-label">Total Views</div>
        <div class="stat-badge">${analytics.unique_views || 0} unique IPs</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">♥</div>
        <div class="stat-value">${counts.react || 0}</div>
        <div class="stat-label">Reactions</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">★</div>
        <div class="stat-value">${calcAvgRating(analytics.rating_distribution || []) || '—'}</div>
        <div class="stat-label">Avg Rating</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">⇪</div>
        <div class="stat-value">${counts.share || 0}</div>
        <div class="stat-label">Shares</div>
      </div>
    </div>
    <div class="analytics-grid">
      <div class="glass panel">
        <h2>Views — Last 7 Days</h2>
        <div class="bar-chart">${barChart(analytics.daily_views || [])}</div>
      </div>
      <div class="glass panel">
        <h2>Rating Distribution</h2>
        <div class="rating-dist">${ratingDist(analytics.rating_distribution || [])}</div>
      </div>
    </div>`;
}

// ---- Helpers ----

function barChart(days) {
  if (!days.length) return '<p class="empty">No data yet</p>';
  const max = Math.max(...days.map(d => d.count));
  return days.map(d => `
    <div class="bar-row">
      <span class="bar-label">${d.day.slice(5)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${max > 0 ? (d.count/max)*100 : 0}%"></div></div>
      <span class="bar-value">${d.count}</span>
    </div>`).join('');
}

function ratingDist(dist) {
  if (!dist.length) return '<p class="empty">No ratings yet</p>';
  const max = Math.max(...dist.map(d => parseInt(d.count)));
  return dist.map(d => `
    <div class="bar-row">
      <span class="bar-label">★ ${d.value}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${max > 0 ? (d.count/max)*100 : 0}%"></div></div>
      <span class="bar-value">${d.count}</span>
    </div>`).join('');
}

function calcAvgRating(dist) {
  if (!dist || !dist.length) return null;
  const total = dist.reduce((s, r) => s + parseInt(r.count), 0);
  const weighted = dist.reduce((s, r) => s + parseInt(r.value) * parseInt(r.count), 0);
  return total > 0 ? (weighted / total).toFixed(1) : null;
}

function parseTechStack(raw) {
  try { return JSON.parse(raw); }
  catch { return raw ? [raw] : []; }
}

function parseJsonField(raw, fallback) {
  if (!raw || !raw.trim()) return fallback;
  try { return JSON.parse(raw.trim()); }
  catch { return fallback; }
}

function fmtJsonField(raw) {
  if (!raw || raw === '[]' || raw === 'null') return '';
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Init ----
renderApp();
