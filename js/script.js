const API = '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let allCourses = [];
let myPreferences = []; // [{courseId, rank}]
let dragSrc = null;

// ── yearCourseMap mirrors server.js ───────────────────────────────────────────
const yearCourseMap = {
  'Computer Science':       { 1:['CS101','CS102','MATH101'], 2:['CS201','CS202','MATH102'], 3:['CS301','CS302','CS303'] },
  'Electrical Engineering': { 1:['EE101','MATH101'],         2:['EE201','EE202','MATH102'], 3:['EE301','EE302'] },
  'Mathematics':            { 1:['MATH101','MATH102'],        2:['MATH201','MATH202'],       3:['MATH301'] },
  'Physics':                { 1:['PHY101','MATH101'],         2:['PHY201','MATH201'],        3:['PHY301'] },
  'Mechanical Engineering': { 1:['ME101','MATH101'],          2:['ME201','MATH201'],         3:['ME301'] }
};

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (token && currentUser) {
    showDashboard();
  } else {
    showPage('loginPage');
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function goToRegister() { showPage('registerPage'); }

function goToLogin() {
  const f = document.getElementById('regName');
  if (f) f.closest('form').reset();
  document.getElementById('completedPreview').classList.add('hidden');
  showPage('loginPage');
}

async function handleLogin(e) {
  e.preventDefault();
  const res = await apiFetch('/login', 'POST', {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  });
  if (res.error) return toast(res.error, 'error');
  token = res.token;
  currentUser = res.user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(currentUser));
  showDashboard();
}

async function handleRegister(e) {
  e.preventDefault();
  const res = await apiFetch('/register', 'POST', {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    department: document.getElementById('regDept').value,
    year: document.getElementById('regYear').value
  });
  if (res.error) return toast(res.error, 'error');
  toast('Account created! Please sign in.', 'success');
  document.getElementById('loginEmail').value = res.user?.email || '';
  goToLogin();
}

// ── Register: completed courses preview ───────────────────────────────────────
function updateCompletedPreview() {
  const dept = document.getElementById('regDept').value;
  const year = parseInt(document.getElementById('regYear').value);
  const el = document.getElementById('completedPreview');
  if (!dept || !year) { el.classList.add('hidden'); return; }

  // Collect courses from years 1..year-1 (same logic as server buildAcademicRecord)
  const deptMap = yearCourseMap[dept] || {};
  const completed = [];
  for (let y = 1; y < year; y++) {
    (deptMap[y] || []).forEach(c => completed.push(c));
  }

  el.classList.remove('hidden');
  if (!completed.length) {
    el.className = 'completed-preview none';
    el.innerHTML = `<strong>Completed Courses (auto-assigned)</strong>None — Year 1 starts fresh.`;
  } else {
    el.className = 'completed-preview';
    el.innerHTML = `<strong>Completed Courses (auto-assigned)</strong>
      <div class="cp-tags">${completed.map(c => `<span class="cp-tag">${c}</span>`).join('')}</div>`;
  }
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showPage('loginPage');
  document.getElementById('navUser').textContent = '';
  document.getElementById('logoutBtn').style.display = 'none';
}

function showDashboard() {
  document.getElementById('navUser').textContent = `${currentUser.name} (${currentUser.role})`;
  document.getElementById('logoutBtn').style.display = 'inline-flex';
  if (currentUser.role === 'admin') {
    showPage('adminPage');
    loadAdminDashboard();
  } else {
    showPage('studentPage');
    loadStudentCourses();
    loadStudentPreferences();
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const pg = document.getElementById(id);
  pg.classList.remove('hidden');
  pg.classList.add('active');
}

function showSection(id, el) {
  document.querySelectorAll('#studentPage .section').forEach(s => {
    s.classList.remove('active'); s.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('#studentPage .side-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (id === 'sAllocations') loadStudentAllocations();
  if (id === 'sProfile') loadProfile();
  if (id === 'sPreferences') { renderPreferencePanel(); updateDeadlineBadge(); }
}

function showAdminSection(id, el) {
  document.querySelectorAll('#adminPage .section').forEach(s => {
    s.classList.remove('active'); s.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('#adminPage .side-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (id === 'aCourses') loadAdminCourses();
  if (id === 'aStudents') loadStudentTable();
  if (id === 'aAllocations') loadAdminAllocations();
  if (id === 'aReports') loadReport('enrollment', null);
  if (id === 'aSettings') loadSettings();
}

// ── Student: Courses ──────────────────────────────────────────────────────────
async function loadStudentCourses() {
  allCourses = await apiFetch('/courses');
  if (!Array.isArray(allCourses)) allCourses = [];
  renderCourseGrid(allCourses);
}

function renderCourseGrid(courses) {
  const grid = document.getElementById('courseGrid');
  if (!courses.length) { grid.innerHTML = emptyState('book-open', 'No courses available'); return; }
  grid.innerHTML = courses.map(c => {
    const pct = Math.round((c.enrolled / c.capacity) * 100);
    const fillClass = pct < 50 ? 'low' : pct < 80 ? 'mid' : 'high';
    const inPref = myPreferences.some(p => p.courseId === c.id);
    const ineligibleBanner = !c.eligible && c.missingPrereqs && c.missingPrereqs.length
      ? `<div class="prereq-warn"><i class="fas fa-exclamation-triangle"></i> Missing prerequisites: ${c.missingPrereqs.join(', ')}</div>`
      : '';
    return `<div class="course-card ${c.isFull ? 'full' : ''} ${!c.eligible ? 'ineligible' : ''}">
      <div class="course-header">
        <span class="course-id">${c.id}</span>
        ${c.isFull ? '<span class="tag tag-full">Full</span>' : ''}
      </div>
      <h3>${c.name}</h3>
      <p class="course-desc">${c.description || ''}</p>
      <div class="course-meta">
        <span class="tag tag-dept">${c.department}</span>
        <span class="tag tag-credits">${c.credits} credits</span>
        <span class="tag" style="background:#ede9fe;color:#5b21b6">Year ${c.year}</span>
        <span class="tag tag-schedule"><i class="fas fa-clock"></i> ${c.schedule}</span>
      </div>
      ${c.prerequisites && c.prerequisites.length ? `<div class="prereq-list">Prerequisites: ${c.prerequisites.map(p => `<span>${p}</span>`).join('')}</div>` : ''}
      ${ineligibleBanner}
      <div class="seat-bar">
        <div class="seat-bar-label"><span>Seats</span><span>${c.enrolled}/${c.capacity}</span></div>
        <div class="bar-track"><div class="bar-fill ${fillClass}" style="width:${pct}%"></div></div>
      </div>
      <div class="card-actions">
        <button class="btn-primary btn-sm ${inPref ? 'btn-success' : ''}" onclick="addToPreferences('${c.id}')">
          <i class="fas fa-${inPref ? 'check' : 'plus'}"></i> ${inPref ? 'Added' : 'Add to Preferences'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function filterCourses() {
  const q = (document.getElementById('courseSearch').value || '').toLowerCase();
  const dept = document.getElementById('deptFilter').value;
  const year = document.getElementById('yearFilter').value;
  const eligOnly = document.getElementById('eligFilter').value === 'eligible';
  const filtered = allCourses.filter(c =>
    (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) &&
    (!dept || c.department === dept) &&
    (!year || c.year === parseInt(year)) &&
    (!eligOnly || c.eligible)
  );
  renderCourseGrid(filtered);
}

// ── Student: Preferences ──────────────────────────────────────────────────────
async function loadStudentPreferences() {
  const data = await apiFetch('/preferences');
  myPreferences = Array.isArray(data) ? data.map(p => ({ courseId: p.courseId, rank: p.rank })) : [];
  myPreferences.sort((a, b) => a.rank - b.rank);
  document.getElementById('prefCount').textContent = myPreferences.length;
}

function addToPreferences(courseId) {
  if (myPreferences.some(p => p.courseId === courseId)) return toast('Already in preferences', 'warning');
  myPreferences.push({ courseId, rank: myPreferences.length + 1 });
  toast('Added to preferences', 'success');
  renderCourseGrid(allCourses);
  renderPreferencePanel();
}

function removeFromPreferences(courseId) {
  myPreferences = myPreferences.filter(p => p.courseId !== courseId);
  myPreferences.forEach((p, i) => p.rank = i + 1);
  renderPreferencePanel();
  renderCourseGrid(allCourses);
}

function renderPreferencePanel() {
  const list = document.getElementById('prefList');
  const countEl = document.getElementById('prefCount');
  if (countEl) countEl.textContent = myPreferences.length;

  if (!myPreferences.length) {
    list.innerHTML = `<li style="text-align:center;color:var(--muted);padding:1rem;font-size:.88rem">No preferences added yet. Browse courses and click "Add to Preferences".</li>`;
  } else {
    list.innerHTML = myPreferences.map((p, i) => {
      const course = allCourses.find(c => c.id === p.courseId);
      return `<li class="pref-item" draggable="true" data-id="${p.courseId}"
        ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dragDrop(event)">
        <div class="pref-rank">${i + 1}</div>
        <div class="pref-info">
          <strong>${course ? course.name : p.courseId}</strong>
          <small>${course ? course.schedule : ''}</small>
        </div>
        <button class="btn-primary btn-sm btn-danger" onclick="removeFromPreferences('${p.courseId}')">
          <i class="fas fa-trash"></i>
        </button>
      </li>`;
    }).join('');
  }
  renderAddCourseList();
}

function renderAddCourseList() {
  const el = document.getElementById('addCourseList');
  if (!el) return;
  el.innerHTML = allCourses.map(c => {
    const added = myPreferences.some(p => p.courseId === c.id);
    const bgColor = c.eligible ? '#f0fdf4' : '#fff';
    const borderColor = c.eligible ? '#bbf7d0' : '#e2e8f0';
    return `<div class="add-course-item ${added ? 'added' : ''}" style="background:${bgColor};border:1.5px solid ${borderColor}">
      <span class="item-label" style="color:var(--text)"><strong>${c.id}</strong> – ${c.name}</span>
      <button class="btn-primary btn-sm" onclick="addToPreferences('${c.id}')" ${added ? 'disabled' : ''}>
        <i class="fas fa-${added ? 'check' : 'plus'}"></i>
      </button>
    </div>`;
  }).join('');
}

async function savePreferences() {
  if (!myPreferences.length) return toast('Add at least one course preference', 'warning');
  const res = await apiFetch('/preferences', 'POST', { coursePreferences: myPreferences });
  if (res.error) return toast(res.error, 'error');
  toast(res.message || 'Preferences saved!', 'success');
}

async function updateDeadlineBadge() {
  const el = document.getElementById('deadlineBadge');
  if (!el) return;
  const settings = await apiFetch('/settings').catch(() => null);
  if (settings && settings.deadline) {
    const d = new Date(settings.deadline);
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    el.textContent = diff > 0 ? `Deadline: ${d.toLocaleDateString()} (${diff} days left)` : 'Deadline passed';
    el.style.background = diff <= 2 ? '#fee2e2' : '#fef3c7';
    el.style.color = diff <= 2 ? '#991b1b' : '#92400e';
  }
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function dragStart(e) { dragSrc = e.currentTarget; e.currentTarget.classList.add('dragging'); }
function dragOver(e) { e.preventDefault(); }
function dragDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  if (!dragSrc || dragSrc === target) { dragSrc?.classList.remove('dragging'); return; }
  const srcIdx = myPreferences.findIndex(p => p.courseId === dragSrc.dataset.id);
  const tgtIdx = myPreferences.findIndex(p => p.courseId === target.dataset.id);
  [myPreferences[srcIdx], myPreferences[tgtIdx]] = [myPreferences[tgtIdx], myPreferences[srcIdx]];
  myPreferences.forEach((p, i) => p.rank = i + 1);
  dragSrc.classList.remove('dragging');
  renderPreferencePanel();
}

// ── Student: Allocations ──────────────────────────────────────────────────────
async function loadStudentAllocations() {
  const data = await apiFetch('/allocations');
  const grid = document.getElementById('studentAllocations');
  if (!Array.isArray(data) || !data.length) {
    grid.innerHTML = emptyState('check-circle', 'No allocations yet. Results will appear after the allocation engine runs.');
    return;
  }
  grid.innerHTML = data.map(a => {
    const icon = a.status === 'allocated' ? 'check-circle' : a.status === 'waitlisted' ? 'clock' : 'exclamation-circle';
    const reasonHtml = a.reason ? `<p style="font-size:.78rem;color:var(--danger);margin-top:.3rem"><i class="fas fa-info-circle"></i> ${a.reason}</p>` : '';
    return `<div class="alloc-card ${a.status}">
      <div class="alloc-status status-${a.status}">
        <i class="fas fa-${icon}"></i> ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}
      </div>
      <h3 style="font-size:1rem;margin-bottom:.3rem">${a.courseName || a.courseId}</h3>
      <p style="font-size:.82rem;color:var(--muted)"><i class="fas fa-clock"></i> ${a.schedule || ''}</p>
      ${a.credits ? `<p style="font-size:.78rem;color:var(--muted)">${a.credits} credits</p>` : ''}
      ${reasonHtml}
    </div>`;
  }).join('');
}

// ── Student: Profile ──────────────────────────────────────────────────────────
async function loadProfile() {
  const profileEl = document.getElementById('profileCard');
  const recordEl = document.getElementById('academicRecord');
  profileEl.innerHTML = `<div style="color:var(--muted);padding:1rem">Loading...</div>`;
  recordEl.innerHTML = '';

  const user = await apiFetch('/profile');
  if (user.error) { profileEl.innerHTML = emptyState('user', 'Could not load profile'); return; }

  // Update cached user
  currentUser = { ...currentUser, ...user };
  localStorage.setItem('user', JSON.stringify(currentUser));

  const record = user.academicRecord || {};
  const completedList = Object.entries(record).filter(([, v]) => v.status === 'completed').map(([k]) => k);
  const backlogList = Object.entries(record).filter(([, v]) => v.status === 'failed').map(([k]) => k);

  profileEl.innerHTML = `
    <div class="profile-avatar"><i class="fas fa-user"></i></div>
    <h3>${user.name}</h3>
    <p class="email">${user.email}</p>
    <div class="profile-detail">
      <div class="profile-row"><strong>Department</strong><span>${user.department || '—'}</span></div>
      <div class="profile-row"><strong>Year</strong><span>Year ${user.year || '—'}</span></div>
      <div class="profile-row"><strong>Role</strong><span>${user.role}</span></div>
      <div class="profile-row"><strong>Preferences</strong><span>${myPreferences.length} course(s)</span></div>
      <div class="profile-row"><strong>Completed</strong><span>${completedList.length} course(s)</span></div>
    </div>`;

  // Academic record table
  const rows = Object.entries(record);
  const statusPill = (s) => {
    const map = { completed:'pill-completed', failed:'pill-failed', backlog:'pill-backlog', not_taken:'pill-not_taken' };
    const icons = { completed:'check-circle', failed:'times-circle', backlog:'exclamation-circle', not_taken:'minus-circle' };
    const labels = { completed:'Completed', failed:'Failed / Backlog', backlog:'Backlog', not_taken:'Not Taken' };
    const cls = map[s] || 'pill-not_taken';
    return `<span class="status-pill ${cls}"><i class="fas fa-${icons[s]||'circle'}"></i> ${labels[s]||s}</span>`;
  };

  const tableRows = rows.map(([cid, v]) => {
    const course = allCourses.find(c => c.id === cid);
    return `<tr>
      <td><strong>${cid}</strong></td>
      <td>${course ? course.name : '—'}</td>
      <td>${statusPill(v.status)}</td>
    </tr>`;
  }).join('');

  const backlogSection = backlogList.length ? `
    <div class="backlog-section">
      <h4><i class="fas fa-exclamation-triangle"></i> Backlog Courses</h4>
      <div class="backlog-list">${backlogList.map(c => `<span class="backlog-tag">${c}</span>`).join('')}</div>
    </div>` : '';

  recordEl.innerHTML = `
    <h3><i class="fas fa-graduation-cap"></i> Academic Record</h3>
    ${rows.length ? `<table class="record-table">
      <thead><tr><th>Course ID</th><th>Course Name</th><th>Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>` : '<p style="color:var(--muted);font-size:.88rem">No academic record found.</p>'}
    ${backlogSection}`;
}

// ── Admin: Dashboard ──────────────────────────────────────────────────────────
async function loadAdminDashboard() {
  const [courses, students, allocs, popularity] = await Promise.all([
    apiFetch('/courses'), apiFetch('/students'),
    apiFetch('/allocations'), apiFetch('/reports/popularity')
  ]);
  const allocated = Array.isArray(allocs) ? allocs.filter(a => a.status === 'allocated').length : 0;
  const totalCap = Array.isArray(courses) ? courses.reduce((s, c) => s + c.capacity, 0) : 0;
  const totalEnrolled = Array.isArray(courses) ? courses.reduce((s, c) => s + c.enrolled, 0) : 0;

  document.getElementById('statsGrid').innerHTML = [
    { icon:'users',        color:'#4f46e5', label:'Students',     val: Array.isArray(students) ? students.length : 0 },
    { icon:'book',         color:'#10b981', label:'Courses',      val: Array.isArray(courses) ? courses.length : 0 },
    { icon:'check-circle', color:'#f59e0b', label:'Allocations',  val: allocated },
    { icon:'chair',        color:'#3b82f6', label:'Seats Filled', val: `${totalEnrolled}/${totalCap}` }
  ].map(s => `<div class="stat-card">
    <div class="stat-icon" style="background:${s.color}"><i class="fas fa-${s.icon}"></i></div>
    <div class="stat-info"><h3>${s.val}</h3><p>${s.label}</p></div>
  </div>`).join('');

  if (Array.isArray(popularity) && popularity.length) {
    const max = Math.max(...popularity.map(p => p.requests), 1);
    // Pick top courses by requests, one per dept if possible
    const seen = new Set();
    const topPop = [...popularity].sort((a, b) => b.requests - a.requests)
      .filter(p => { const dept = courses.find(c => c.id === p.courseId)?.department; if (seen.has(dept)) return false; seen.add(dept); return true; })
      .slice(0, 8);
    document.getElementById('popularityChart').innerHTML = topPop.map(p => `
      <div class="chart-row">
        <span class="chart-label" title="${p.courseName}">${p.courseId}</span>
        <div class="chart-bar-wrap"><div class="chart-bar" style="width:${Math.round((p.requests/max)*100)}%;background:var(--primary)">${p.requests || ''}</div></div>
        <span class="chart-val">${p.requests}</span>
      </div>`).join('');
  }

  if (Array.isArray(courses) && courses.length) {
    // Pick one course per department for utilization chart
    const deptSeen = new Set();
    const sample = courses.filter(c => { if (deptSeen.has(c.department)) return false; deptSeen.add(c.department); return true; });
    document.getElementById('utilizationChart').innerHTML = sample.map(c => {
      const pct = Math.round((c.enrolled / c.capacity) * 100);
      const color = pct < 50 ? 'var(--success)' : pct < 80 ? 'var(--warning)' : 'var(--danger)';
      return `<div class="chart-row">
        <span class="chart-label" title="${c.department}">${c.department.split(' ')[0]}</span>
        <div class="chart-bar-wrap"><div class="chart-bar" style="width:${Math.max(pct,2)}%;background:${color}">${pct}%</div></div>
        <span class="chart-val">${pct}%</span>
      </div>`;
    }).join('');
  }
}

// ── Admin: Courses ────────────────────────────────────────────────────────────
async function loadAdminCourses() {
  const courses = await apiFetch('/courses');
  const wrap = document.getElementById('adminCourseTable');
  if (!Array.isArray(courses) || !courses.length) { wrap.innerHTML = emptyState('book', 'No courses yet'); return; }
  wrap.innerHTML = `<table>
    <thead><tr><th>ID</th><th>Name</th><th>Dept</th><th>Year</th><th>Credits</th><th>Capacity</th><th>Enrolled</th><th>Schedule</th><th>Actions</th></tr></thead>
    <tbody>${courses.map(c => `<tr>
      <td><strong>${c.id}</strong></td><td>${c.name}</td><td>${c.department}</td>
      <td><span class="tag" style="background:#ede9fe;color:#5b21b6">Y${c.year}</span></td>
      <td>${c.credits}</td><td>${c.capacity}</td>
      <td><span class="alloc-status status-${c.enrolled >= c.capacity ? 'conflict' : 'allocated'}">${c.enrolled}</span></td>
      <td style="font-size:.8rem">${c.schedule}</td>
      <td>
        <button class="btn-primary btn-sm" onclick="editCourse('${c.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-primary btn-sm btn-danger" onclick="deleteCourse('${c.id}')" style="margin-left:.3rem"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('')}</tbody></table>`;
}

let editingCourseId = null;
function openCourseModal(id) {
  editingCourseId = id || null;
  document.getElementById('courseModalTitle').textContent = id ? 'Edit Course' : 'Add Course';
  if (!id) { document.getElementById('courseForm').reset(); document.getElementById('cId').disabled = false; }
  document.getElementById('courseModal').classList.remove('hidden');
}
function closeCourseModal() { document.getElementById('courseModal').classList.add('hidden'); }

async function editCourse(id) {
  const courses = await apiFetch('/courses');
  const c = courses.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cId').value = c.id; document.getElementById('cId').disabled = true;
  document.getElementById('cName').value = c.name;
  document.getElementById('cDept').value = c.department;
  document.getElementById('cCredits').value = c.credits;
  document.getElementById('cCapacity').value = c.capacity;
  document.getElementById('cYear').value = c.year || 3;
  document.getElementById('cSchedule').value = c.schedule;
  document.getElementById('cPrereqs').value = (c.prerequisites || []).join(', ');
  document.getElementById('cDesc').value = c.description || '';
  openCourseModal(id);
}

async function saveCourse(e) {
  e.preventDefault();
  const body = {
    id: document.getElementById('cId').value.trim().toUpperCase(),
    name: document.getElementById('cName').value,
    department: document.getElementById('cDept').value,
    credits: document.getElementById('cCredits').value,
    capacity: document.getElementById('cCapacity').value,
    year: document.getElementById('cYear').value,
    schedule: document.getElementById('cSchedule').value,
    prerequisites: document.getElementById('cPrereqs').value.split(',').map(s => s.trim()).filter(Boolean),
    description: document.getElementById('cDesc').value
  };
  const res = editingCourseId
    ? await apiFetch(`/courses/${editingCourseId}`, 'PUT', body)
    : await apiFetch('/courses', 'POST', body);
  if (res.error) return toast(res.error, 'error');
  toast(editingCourseId ? 'Course updated' : 'Course added', 'success');
  closeCourseModal();
  loadAdminCourses();
}

async function deleteCourse(id) {
  if (!confirm(`Delete course ${id}?`)) return;
  const res = await apiFetch(`/courses/${id}`, 'DELETE');
  if (res.error) return toast(res.error, 'error');
  toast('Course deleted', 'success');
  loadAdminCourses();
}

// ── Admin: Students & Academic Records ────────────────────────────────────────
async function loadStudentTable() {
  const students = await apiFetch('/students');
  const wrap = document.getElementById('studentTable');
  if (!Array.isArray(students)) { wrap.innerHTML = emptyState('users', 'No students'); return; }

  wrap.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Email</th><th>Dept</th><th>Year</th><th>Completed</th><th>Backlog</th><th>Actions</th></tr></thead>
    <tbody>${students.map(s => {
      const record = s.academicRecord || {};
      const completed = Object.entries(record).filter(([,v]) => v.status === 'completed').map(([k]) => k);
      const backlog = Object.entries(record).filter(([,v]) => v.status === 'failed').map(([k]) => k);
      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td style="font-size:.82rem">${s.email}</td>
        <td>${s.department}</td>
        <td>Year ${s.year}</td>
        <td style="font-size:.78rem">${completed.map(c => `<span class="tag tag-credits" style="margin:.1rem">${c}</span>`).join('') || '<em style="color:var(--muted)">None</em>'}</td>
        <td style="font-size:.78rem">${backlog.map(c => `<span class="backlog-tag">${c}</span>`).join('') || '—'}</td>
        <td><button class="btn-primary btn-sm" onclick="openRecordModal('${s.id}')"><i class="fas fa-edit"></i> Edit Record</button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

let editingStudentId = null;
async function openRecordModal(studentId) {
  editingStudentId = studentId;
  const students = await apiFetch('/students');
  const s = students.find(x => x.id === studentId);
  if (!s) return;
  document.getElementById('recordModalTitle').textContent = `Edit Record — ${s.name}`;

  const record = s.academicRecord || {};
  const statusOptions = ['completed','not_taken','failed'].map(v => `<option value="${v}">${v}</option>`).join('');

  document.getElementById('recordModalBody').innerHTML = `
    <p style="font-size:.82rem;color:var(--muted);margin-bottom:1rem">
      Set the status for each course in ${s.name}'s academic record.
    </p>
    <table class="record-table">
      <thead><tr><th>Course ID</th><th>Status</th></tr></thead>
      <tbody>${Object.entries(record).map(([cid, v]) => `
        <tr>
          <td><strong>${cid}</strong></td>
          <td>
            <select id="rec_${cid}" style="padding:.35rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.82rem">
              ${['completed','not_taken','failed'].map(opt =>
                `<option value="${opt}" ${v.status === opt ? 'selected' : ''}>${opt}</option>`
              ).join('')}
            </select>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('recordModal').classList.remove('hidden');
}

function closeRecordModal() {
  document.getElementById('recordModal').classList.add('hidden');
  editingStudentId = null;
}

async function saveRecord() {
  const students = await apiFetch('/students');
  const s = students.find(x => x.id === editingStudentId);
  if (!s) return;
  const record = s.academicRecord || {};
  const updated = {};
  Object.keys(record).forEach(cid => {
    const sel = document.getElementById(`rec_${cid}`);
    updated[cid] = { status: sel ? sel.value : record[cid].status };
  });
  const res = await apiFetch(`/students/${editingStudentId}/record`, 'PUT', { academicRecord: updated });
  if (res.error) return toast(res.error, 'error');
  toast('Academic record updated', 'success');
  closeRecordModal();
  loadStudentTable();
}

// ── Admin: Allocations ────────────────────────────────────────────────────────
async function runAllocation() {
  if (!confirm('Run the allocation engine? This will reassign all courses based on preferences.')) return;
  const res = await apiFetch('/allocate', 'POST');
  if (res.error) return toast(res.error, 'error');
  toast(`Allocation complete: ${res.allocated} allocations made`, 'success');
  loadAdminAllocations();
  loadAdminDashboard();
}

async function loadAdminAllocations() {
  const [allocs, students] = await Promise.all([apiFetch('/allocations'), apiFetch('/students')]);

  const sf = document.getElementById('allocStudentFilter');
  if (sf && Array.isArray(students)) {
    const cur = sf.value;
    sf.innerHTML = '<option value="">All Students</option>' +
      students.map(s => `<option value="${s.id}" ${s.id == cur ? 'selected' : ''}>${s.name}</option>`).join('');
  }

  const statusFilter = document.getElementById('allocStatusFilter')?.value;
  const studentFilter = document.getElementById('allocStudentFilter')?.value;
  let data = Array.isArray(allocs) ? allocs : [];
  if (statusFilter) data = data.filter(a => a.status === statusFilter);
  if (studentFilter) data = data.filter(a => a.studentId == studentFilter);

  const wrap = document.getElementById('adminAllocTable');
  if (!data.length) { wrap.innerHTML = emptyState('sitemap', 'No allocations found. Run the allocation engine first.'); return; }

  wrap.innerHTML = `<table>
    <thead><tr><th>Student</th><th>Dept</th><th>Course</th><th>Schedule</th><th>Status</th><th>Reason</th><th>Override</th></tr></thead>
    <tbody>${data.map(a => `<tr>
      <td><strong>${a.studentName || a.studentId}</strong></td>
      <td>${a.department || '—'}</td>
      <td>${a.courseName || a.courseId}</td>
      <td style="font-size:.8rem">${a.schedule || '—'}</td>
      <td><span class="alloc-status status-${a.status}">${a.status}</span></td>
      <td style="font-size:.78rem;color:var(--muted)">${a.reason || '—'}</td>
      <td>
        ${a.status !== 'allocated' ? `<button class="btn-primary btn-sm btn-success" onclick="override('${a.studentId}','${a.courseId}','add')"><i class="fas fa-plus"></i> Enroll</button>` : ''}
        ${a.status === 'allocated' ? `<button class="btn-primary btn-sm btn-danger" onclick="override('${a.studentId}','${a.courseId}','remove')"><i class="fas fa-minus"></i> Remove</button>` : ''}
      </td>
    </tr>`).join('')}</tbody></table>`;
}

async function override(studentId, courseId, action) {
  const res = await apiFetch('/allocations/override', 'POST', { studentId, courseId, action });
  if (res.error) return toast(res.error, 'error');
  toast(res.message, 'success');
  loadAdminAllocations();
  loadAdminDashboard();
}

// ── Admin: Reports ────────────────────────────────────────────────────────────
async function loadReport(type, el) {
  document.querySelectorAll('.report-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const data = await apiFetch(`/reports/${type}`);
  const wrap = document.getElementById('reportContent');
  if (!Array.isArray(data) || !data.length) { wrap.innerHTML = emptyState('chart-bar', 'No data available'); return; }

  const configs = {
    enrollment:  { cols:['courseId','courseName','department','capacity','enrolled','utilization','seatsLeft'], labels:['Course ID','Name','Dept','Capacity','Enrolled','Utilization','Seats Left'] },
    popularity:  { cols:['courseId','courseName','requests','enrolled','capacity'], labels:['Course ID','Name','Requests','Enrolled','Capacity'] },
    unallocated: { cols:['id','name','email','department','year'], labels:['ID','Name','Email','Dept','Year'] },
    students:    { cols:['id','name','department','year','preferencesSubmitted','coursesAllocated'], labels:['ID','Name','Dept','Year','Prefs','Allocated'] }
  };
  const cfg = configs[type];
  wrap.innerHTML = `<table>
    <thead><tr>${cfg.labels.map(l => `<th>${l}</th>`).join('')}</tr></thead>
    <tbody>${data.map(row => `<tr>${cfg.cols.map(c => `<td>${row[c] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

// ── Admin: Settings ───────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await apiFetch('/settings');
  if (s.deadline) {
    document.getElementById('deadlineInput').value = new Date(s.deadline).toISOString().slice(0, 16);
  }
}

async function saveSettings() {
  const deadline = document.getElementById('deadlineInput').value;
  const res = await apiFetch('/settings', 'PUT', { deadline });
  if (res.error) return toast(res.error, 'error');
  toast('Settings saved', 'success');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API + path, opts);
    return await res.json();
  } catch { return { error: 'Network error' }; }
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

function emptyState(icon, msg) {
  return `<div class="empty"><i class="fas fa-${icon}"></i><p>${msg}</p></div>`;
}
