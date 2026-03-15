require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'course-alloc-secret-2024';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// ─── Course Status Map per Year/Dept ─────────────────────────────────────────
const yearCourseMap = {
  'Computer Science': {
    1: ['CS101','CS102','MATH101'],
    2: ['CS201','CS202','MATH102'],
    3: ['CS301','CS302','CS303']
  },
  'Electrical Engineering': {
    1: ['EE101','MATH101'],
    2: ['EE201','EE202','MATH102'],
    3: ['EE301','EE302']
  },
  'Mathematics': {
    1: ['MATH101','MATH102'],
    2: ['MATH201','MATH202'],
    3: ['MATH301']
  },
  'Physics':                { 1: ['PHY101','MATH101'], 2: ['PHY201','MATH201'], 3: ['PHY301'] },
  'Mechanical Engineering': { 1: ['ME101','MATH101'],  2: ['ME201','MATH201'],  3: ['ME301'] }
};

// Build academic record for a student based on year & dept
// year N student has completed years 1..N-1, year N is "not_taken"
function buildAcademicRecord(department, year) {
  const deptMap = yearCourseMap[department] || {};
  const record = {}; // courseId -> { status }
  for (let y = 1; y < year; y++) {
    (deptMap[y] || []).forEach(c => { record[c] = { status: 'completed' }; });
  }
  (deptMap[year] || []).forEach(c => { record[c] = { status: 'not_taken' }; });
  return record;
}

function getCompletedCourses(academicRecord) {
  return Object.entries(academicRecord)
    .filter(([, v]) => v.status === 'completed')
    .map(([k]) => k);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
let users = [
  {
    id: 1, name: 'Admin User', email: 'admin@university.edu',
    password: bcrypt.hashSync('admin123', 10), role: 'admin',
    department: 'Administration', year: null, academicRecord: {}
  },
  {
    id: 2, name: 'Alice Johnson', email: 'alice@student.edu',
    password: bcrypt.hashSync('pass123', 10), role: 'student',
    department: 'Computer Science', year: 2,
    academicRecord: {
      CS101: { status: 'completed' }, CS102: { status: 'completed' },
      MATH101: { status: 'completed' }, CS201: { status: 'not_taken' },
      CS202: { status: 'not_taken' }, MATH102: { status: 'not_taken' }
    }
  },
  {
    id: 3, name: 'Bob Smith', email: 'bob@student.edu',
    password: bcrypt.hashSync('pass123', 10), role: 'student',
    department: 'Computer Science', year: 3,
    academicRecord: {
      CS101: { status: 'completed' }, CS102: { status: 'completed' },
      MATH101: { status: 'completed' }, CS201: { status: 'completed' },
      CS202: { status: 'failed' }, MATH102: { status: 'completed' },
      CS301: { status: 'not_taken' }, CS302: { status: 'not_taken' }, CS303: { status: 'not_taken' }
    }
  },
  {
    id: 4, name: 'Carol White', email: 'carol@student.edu',
    password: bcrypt.hashSync('pass123', 10), role: 'student',
    department: 'Electrical Engineering', year: 2,
    academicRecord: {
      EE101: { status: 'completed' }, MATH101: { status: 'completed' },
      EE201: { status: 'not_taken' }, EE202: { status: 'not_taken' }, MATH102: { status: 'not_taken' }
    }
  },
  {
    id: 5, name: 'David Lee', email: 'david@student.edu',
    password: bcrypt.hashSync('pass123', 10), role: 'student',
    department: 'Computer Science', year: 1,
    academicRecord: {
      CS101: { status: 'not_taken' }, CS102: { status: 'not_taken' }, MATH101: { status: 'not_taken' }
    }
  }
];

let courses = [
  // ── Computer Science Year 1 ──
  { id: 'CS101', name: 'Introduction to Programming', department: 'Computer Science', credits: 3, capacity: 60, enrolled: 0, prerequisites: [], schedule: 'Mon/Wed 8:00-9:30', description: 'Fundamentals of programming using Python', year: 1 },
  { id: 'CS102', name: 'Data Structures', department: 'Computer Science', credits: 3, capacity: 60, enrolled: 0, prerequisites: ['CS101'], schedule: 'Tue/Thu 8:00-9:30', description: 'Arrays, linked lists, stacks, queues, trees', year: 1 },
  // ── Computer Science Year 2 ──
  { id: 'CS201', name: 'Object Oriented Programming', department: 'Computer Science', credits: 3, capacity: 50, enrolled: 0, prerequisites: ['CS101','CS102'], schedule: 'Mon/Wed 13:00-14:30', description: 'OOP concepts: classes, inheritance, polymorphism', year: 2 },
  { id: 'CS202', name: 'Computer Networks', department: 'Computer Science', credits: 3, capacity: 50, enrolled: 0, prerequisites: ['CS101'], schedule: 'Tue/Thu 13:00-14:30', description: 'Network protocols, TCP/IP, routing', year: 2 },
  // ── Computer Science Year 3 ──
  { id: 'CS301', name: 'Algorithms', department: 'Computer Science', credits: 3, capacity: 40, enrolled: 0, prerequisites: ['CS201','MATH101'], schedule: 'Mon/Wed 9:00-10:30', description: 'Algorithm design and complexity analysis', year: 3 },
  { id: 'CS302', name: 'Database Systems', department: 'Computer Science', credits: 3, capacity: 40, enrolled: 0, prerequisites: ['CS201'], schedule: 'Tue/Thu 9:00-10:30', description: 'Relational databases, SQL, NoSQL', year: 3 },
  { id: 'CS303', name: 'Operating Systems', department: 'Computer Science', credits: 3, capacity: 35, enrolled: 0, prerequisites: ['CS201','CS102'], schedule: 'Mon/Wed 11:00-12:30', description: 'Process management, memory, file systems', year: 3 },
  // ── Computer Science Year 4 ──
  { id: 'CS401', name: 'Machine Learning', department: 'Computer Science', credits: 4, capacity: 30, enrolled: 0, prerequisites: ['CS301','MATH102'], schedule: 'Tue/Thu 11:00-12:30', description: 'Supervised and unsupervised learning', year: 4 },
  { id: 'CS402', name: 'Cloud Computing', department: 'Computer Science', credits: 3, capacity: 30, enrolled: 0, prerequisites: ['CS302'], schedule: 'Mon/Wed 14:00-15:30', description: 'Cloud architecture and services', year: 4 },

  // ── Electrical Engineering Year 1 ──
  { id: 'EE101', name: 'Basic Electrical Engineering', department: 'Electrical Engineering', credits: 3, capacity: 50, enrolled: 0, prerequisites: [], schedule: 'Mon/Wed 8:00-9:30', description: 'Circuits, Ohm\'s law, AC/DC fundamentals', year: 1 },
  // ── Electrical Engineering Year 2 ──
  { id: 'EE201', name: 'Electronic Circuits', department: 'Electrical Engineering', credits: 3, capacity: 45, enrolled: 0, prerequisites: ['EE101'], schedule: 'Tue/Thu 10:00-11:30', description: 'Diodes, transistors, amplifiers', year: 2 },
  { id: 'EE202', name: 'Electromagnetic Theory', department: 'Electrical Engineering', credits: 3, capacity: 45, enrolled: 0, prerequisites: ['EE101','MATH101'], schedule: 'Mon/Wed 10:00-11:30', description: 'Maxwell\'s equations, fields and waves', year: 2 },
  // ── Electrical Engineering Year 3 ──
  { id: 'EE301', name: 'Digital Electronics', department: 'Electrical Engineering', credits: 3, capacity: 35, enrolled: 0, prerequisites: ['EE201'], schedule: 'Tue/Thu 14:00-15:30', description: 'Logic gates, flip-flops, microcontrollers', year: 3 },
  { id: 'EE302', name: 'Signal Processing', department: 'Electrical Engineering', credits: 3, capacity: 30, enrolled: 0, prerequisites: ['EE201','MATH102'], schedule: 'Mon/Wed 9:00-10:30', description: 'Analog and digital signal processing', year: 3 },

  // ── Mathematics Year 1 ──
  { id: 'MATH101', name: 'Calculus I', department: 'Mathematics', credits: 3, capacity: 80, enrolled: 0, prerequisites: [], schedule: 'Mon/Wed/Fri 9:00-10:00', description: 'Limits, derivatives, integrals', year: 1 },
  { id: 'MATH102', name: 'Calculus II', department: 'Mathematics', credits: 3, capacity: 80, enrolled: 0, prerequisites: ['MATH101'], schedule: 'Mon/Wed/Fri 11:00-12:00', description: 'Multivariable calculus, series', year: 1 },
  // ── Mathematics Year 2 ──
  { id: 'MATH201', name: 'Discrete Mathematics', department: 'Mathematics', credits: 3, capacity: 60, enrolled: 0, prerequisites: ['MATH101'], schedule: 'Tue/Thu 9:00-10:30', description: 'Logic, sets, graph theory, combinatorics', year: 2 },
  { id: 'MATH202', name: 'Differential Equations', department: 'Mathematics', credits: 3, capacity: 60, enrolled: 0, prerequisites: ['MATH102'], schedule: 'Tue/Thu 11:00-12:30', description: 'ODEs, PDEs, Laplace transforms', year: 2 },
  // ── Mathematics Year 3 ──
  { id: 'MATH301', name: 'Linear Algebra', department: 'Mathematics', credits: 3, capacity: 50, enrolled: 0, prerequisites: ['MATH201'], schedule: 'Mon/Wed/Fri 10:00-11:00', description: 'Vectors, matrices, eigenvalues', year: 3 },
  { id: 'MATH302', name: 'Probability & Statistics', department: 'Mathematics', credits: 3, capacity: 50, enrolled: 0, prerequisites: ['MATH201'], schedule: 'Tue/Thu 13:00-14:30', description: 'Probability theory and statistical inference', year: 3 },

  // ── Physics Year 1 ──
  { id: 'PHY101', name: 'Classical Mechanics', department: 'Physics', credits: 3, capacity: 50, enrolled: 0, prerequisites: [], schedule: 'Mon/Wed 10:00-11:30', description: 'Newton\'s laws, kinematics, energy', year: 1 },
  // ── Physics Year 2 ──
  { id: 'PHY201', name: 'Thermodynamics', department: 'Physics', credits: 3, capacity: 45, enrolled: 0, prerequisites: ['PHY101','MATH101'], schedule: 'Tue/Thu 10:00-11:30', description: 'Laws of thermodynamics, entropy, heat engines', year: 2 },
  // ── Physics Year 3 ──
  { id: 'PHY301', name: 'Quantum Mechanics', department: 'Physics', credits: 4, capacity: 35, enrolled: 0, prerequisites: ['PHY201','MATH201'], schedule: 'Mon/Wed 14:00-15:30', description: 'Wave functions, Schrödinger equation, quantum states', year: 3 },

  // ── Mechanical Engineering Year 1 ──
  { id: 'ME101', name: 'Engineering Mechanics', department: 'Mechanical Engineering', credits: 3, capacity: 50, enrolled: 0, prerequisites: [], schedule: 'Tue/Thu 8:00-9:30', description: 'Statics, dynamics, free body diagrams', year: 1 },
  // ── Mechanical Engineering Year 2 ──
  { id: 'ME201', name: 'Strength of Materials', department: 'Mechanical Engineering', credits: 3, capacity: 45, enrolled: 0, prerequisites: ['ME101','MATH101'], schedule: 'Mon/Wed 13:00-14:30', description: 'Stress, strain, beams, columns', year: 2 },
  // ── Mechanical Engineering Year 3 ──
  { id: 'ME301', name: 'Fluid Mechanics', department: 'Mechanical Engineering', credits: 3, capacity: 40, enrolled: 0, prerequisites: ['ME201','MATH201'], schedule: 'Tue/Thu 13:00-14:30', description: 'Fluid statics, Bernoulli, pipe flow', year: 3 },
];

let preferences = [];  // { studentId, courseId, rank, submittedAt }
let allocations = [];  // { studentId, courseId, status, allocatedAt }
let deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/register', (req, res) => {
  const { name, email, password, department, year } = req.body;
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
  const parsedYear = parseInt(year) || 1;
  const academicRecord = buildAcademicRecord(department, parsedYear);
  const newUser = {
    id: users.length + 1, name, email,
    password: bcrypt.hashSync(password, 10),
    role: 'student', department, year: parsedYear, academicRecord
  };
  users.push(newUser);
  const token = jwt.sign({ id: newUser.id, role: newUser.role, name: newUser.name }, JWT_SECRET, { expiresIn: '8h' });
  res.status(201).json({ token, user: sanitizeUser(newUser) });
});

function sanitizeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, year: u.year, academicRecord: u.academicRecord };
}

// ─── Profile ──────────────────────────────────────────────────────────────────
app.get('/api/profile', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(sanitizeUser(user));
});

// ─── Course Routes ────────────────────────────────────────────────────────────
app.get('/api/courses', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const completed = user ? getCompletedCourses(user.academicRecord || {}) : [];
  const enriched = courses.map(c => {
    const missingPrereqs = c.prerequisites.filter(p => !completed.includes(p));
    return { ...c, seatsLeft: c.capacity - c.enrolled, isFull: c.enrolled >= c.capacity, missingPrereqs, eligible: missingPrereqs.length === 0 };
  });
  res.json(enriched);
});

app.post('/api/courses', auth, adminOnly, (req, res) => {
  const { id, name, department, credits, capacity, prerequisites, schedule, description, year } = req.body;
  if (courses.find(c => c.id === id)) return res.status(400).json({ error: 'Course ID already exists' });
  courses.push({ id, name, department, credits: +credits, capacity: +capacity, enrolled: 0, prerequisites: prerequisites || [], schedule, description, year: +year || 3 });
  res.status(201).json(courses[courses.length - 1]);
});

app.put('/api/courses/:id', auth, adminOnly, (req, res) => {
  const idx = courses.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Course not found' });
  courses[idx] = { ...courses[idx], ...req.body, id: req.params.id };
  res.json(courses[idx]);
});

app.delete('/api/courses/:id', auth, adminOnly, (req, res) => {
  courses = courses.filter(c => c.id !== req.params.id);
  res.json({ message: 'Deleted' });
});

// ─── Preferences ──────────────────────────────────────────────────────────────
app.get('/api/preferences', auth, (req, res) => {
  const result = req.user.role === 'admin' ? preferences : preferences.filter(p => p.studentId === req.user.id);
  res.json(result);
});

app.post('/api/preferences', auth, (req, res) => {
  if (new Date() > deadline) return res.status(400).json({ error: 'Submission deadline has passed' });
  const { coursePreferences } = req.body;
  const studentId = req.user.id;
  const user = users.find(u => u.id === studentId);
  const completed = getCompletedCourses(user?.academicRecord || {});

  for (const pref of coursePreferences) {
    const course = courses.find(c => c.id === pref.courseId);
    if (!course) return res.status(400).json({ error: `Course ${pref.courseId} not found` });

    // Hard prerequisite check
    const missing = course.prerequisites.filter(p => !completed.includes(p));
    if (missing.length > 0)
      return res.status(400).json({ error: `Missing prerequisites for ${course.name}: ${missing.join(', ')}` });

    // Timetable conflict within selection
    const conflict = coursePreferences.find(other => {
      if (other.courseId === pref.courseId) return false;
      const oc = courses.find(c => c.id === other.courseId);
      return oc && oc.schedule === course.schedule;
    });
    if (conflict) return res.status(400).json({ error: `Timetable conflict: ${pref.courseId} and ${conflict.courseId} overlap` });
  }

  preferences = preferences.filter(p => p.studentId !== studentId);
  coursePreferences.forEach(p => preferences.push({ studentId, courseId: p.courseId, rank: p.rank, submittedAt: new Date() }));
  res.json({ message: 'Preferences saved', count: coursePreferences.length });
});

// ─── Allocation Engine ────────────────────────────────────────────────────────
function runAllocationEngine() {
  courses.forEach(c => { c.enrolled = 0; });
  allocations = [];

  const studentPrefs = {};
  preferences.forEach(p => {
    if (!studentPrefs[p.studentId]) studentPrefs[p.studentId] = [];
    studentPrefs[p.studentId].push(p);
  });
  Object.values(studentPrefs).forEach(arr => arr.sort((a, b) => a.rank - b.rank));

  const studentIds = Object.keys(studentPrefs).map(Number);
  studentIds.sort((a, b) => {
    const ua = users.find(u => u.id === a), ub = users.find(u => u.id === b);
    if ((ub.year || 0) !== (ua.year || 0)) return (ub.year || 0) - (ua.year || 0);
    const ta = new Date(studentPrefs[a][0]?.submittedAt || 0);
    const tb = new Date(studentPrefs[b][0]?.submittedAt || 0);
    return ta - tb || Math.random() - 0.5; // random tiebreak
  });

  const studentSchedules = {};
  for (const sid of studentIds) {
    studentSchedules[sid] = [];
    const user = users.find(u => u.id === sid);
    const completed = getCompletedCourses(user?.academicRecord || {});

    for (const pref of studentPrefs[sid]) {
      const course = courses.find(c => c.id === pref.courseId);
      if (!course) continue;
      const missing = course.prerequisites.filter(p => !completed.includes(p));
      if (missing.length > 0) { allocations.push({ studentId: sid, courseId: pref.courseId, status: 'ineligible', reason: `Missing: ${missing.join(', ')}`, allocatedAt: new Date() }); continue; }
      if (course.enrolled >= course.capacity) { allocations.push({ studentId: sid, courseId: pref.courseId, status: 'waitlisted', allocatedAt: new Date() }); continue; }
      if (studentSchedules[sid].includes(course.schedule)) { allocations.push({ studentId: sid, courseId: pref.courseId, status: 'conflict', allocatedAt: new Date() }); continue; }
      course.enrolled++;
      studentSchedules[sid].push(course.schedule);
      allocations.push({ studentId: sid, courseId: pref.courseId, status: 'allocated', allocatedAt: new Date() });
    }
  }
  return allocations;
}

app.post('/api/allocate', auth, adminOnly, (req, res) => {
  const result = runAllocationEngine();
  res.json({ message: 'Allocation complete', total: result.length, allocated: result.filter(a => a.status === 'allocated').length });
});

app.get('/api/allocations', auth, (req, res) => {
  const list = req.user.role === 'admin' ? allocations : allocations.filter(a => a.studentId === req.user.id);
  res.json(list.map(a => {
    const c = courses.find(x => x.id === a.courseId);
    const s = users.find(x => x.id === a.studentId);
    return { ...a, courseName: c?.name, schedule: c?.schedule, credits: c?.credits, studentName: s?.name, department: s?.department };
  }));
});

app.post('/api/allocations/override', auth, adminOnly, (req, res) => {
  const { studentId, courseId, action } = req.body;
  const course = courses.find(c => c.id === courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (action === 'add') {
    if (course.enrolled >= course.capacity) return res.status(400).json({ error: 'Course is full' });
    const ex = allocations.find(a => a.studentId === +studentId && a.courseId === courseId);
    if (ex) ex.status = 'allocated';
    else allocations.push({ studentId: +studentId, courseId, status: 'allocated', allocatedAt: new Date(), override: true });
    course.enrolled++;
  } else {
    const idx = allocations.findIndex(a => a.studentId === +studentId && a.courseId === courseId && a.status === 'allocated');
    if (idx !== -1) { allocations[idx].status = 'removed'; course.enrolled = Math.max(0, course.enrolled - 1); }
  }
  res.json({ message: `Override: ${action}` });
});

// ─── Students (Admin) ─────────────────────────────────────────────────────────
app.get('/api/students', auth, adminOnly, (req, res) => {
  res.json(users.filter(u => u.role === 'student').map(sanitizeUser));
});

app.put('/api/students/:id/record', auth, adminOnly, (req, res) => {
  const student = users.find(u => u.id === +req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  student.academicRecord = req.body.academicRecord;
  res.json({ message: 'Updated', academicRecord: student.academicRecord });
});

// ─── Reports ──────────────────────────────────────────────────────────────────
app.get('/api/reports/enrollment', auth, adminOnly, (req, res) => {
  res.json(courses.map(c => ({ courseId: c.id, courseName: c.name, department: c.department, capacity: c.capacity, enrolled: c.enrolled, utilization: Math.round((c.enrolled / c.capacity) * 100) + '%', seatsLeft: c.capacity - c.enrolled })));
});

app.get('/api/reports/popularity', auth, adminOnly, (req, res) => {
  const counts = {};
  preferences.forEach(p => { counts[p.courseId] = (counts[p.courseId] || 0) + 1; });
  res.json(courses.map(c => ({ courseId: c.id, courseName: c.name, requests: counts[c.id] || 0, enrolled: c.enrolled, capacity: c.capacity })).sort((a, b) => b.requests - a.requests));
});

app.get('/api/reports/unallocated', auth, adminOnly, (req, res) => {
  const withPrefs = [...new Set(preferences.map(p => p.studentId))];
  const allocated = new Set(allocations.filter(a => a.status === 'allocated').map(a => a.studentId));
  res.json(withPrefs.filter(id => !allocated.has(id)).map(id => { const u = users.find(x => x.id === id); return { id: u.id, name: u.name, email: u.email, department: u.department, year: u.year }; }));
});

app.get('/api/reports/students', auth, adminOnly, (req, res) => {
  res.json(users.filter(u => u.role === 'student').map(u => ({
    id: u.id, name: u.name, department: u.department, year: u.year,
    preferencesSubmitted: preferences.filter(p => p.studentId === u.id).length,
    coursesAllocated: allocations.filter(a => a.studentId === u.id && a.status === 'allocated').length
  })));
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', auth, adminOnly, (req, res) => {
  res.json({ deadline: deadline.toISOString(), totalStudents: users.filter(u => u.role === 'student').length, totalCourses: courses.length });
});
app.put('/api/settings', auth, adminOnly, (req, res) => {
  if (req.body.deadline) deadline = new Date(req.body.deadline);
  res.json({ message: 'Updated', deadline });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`CourseAlloc running on http://localhost:${PORT}`));
