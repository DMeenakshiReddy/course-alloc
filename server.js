require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'course-alloc-secret-2024';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coursealloc';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => { console.log('MongoDB connected'); seedData(); })
  .catch(err => console.error('MongoDB error:', err));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true },
  password: String, role: { type: String, default: 'student' },
  department: String, year: Number,
  academicRecord: { type: mongoose.Schema.Types.Mixed, default: {} }
});
const User = mongoose.model('User', userSchema);

const courseSchema = new mongoose.Schema({
  id: { type: String, unique: true }, name: String,
  department: String, credits: Number, capacity: Number,
  enrolled: { type: Number, default: 0 },
  prerequisites: [String], schedule: String,
  description: String, year: Number
});
const Course = mongoose.model('Course', courseSchema);

const preferenceSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  courseId: String, rank: Number,
  submittedAt: { type: Date, default: Date.now }
});
const Preference = mongoose.model('Preference', preferenceSchema);

const allocationSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  courseId: String,
  status: String, // allocated, waitlisted, conflict, ineligible, removed
  reason: String,
  override: { type: Boolean, default: false },
  allocatedAt: { type: Date, default: Date.now }
});
const Allocation = mongoose.model('Allocation', allocationSchema);

const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed
});
const Settings = mongoose.model('Settings', settingsSchema);

// ─── yearCourseMap ────────────────────────────────────────────────────────────
const yearCourseMap = {
  'Computer Science':       { 1:['CS101','CS102','MATH101'], 2:['CS201','CS202','MATH102'], 3:['CS301','CS302','CS303'] },
  'Electrical Engineering': { 1:['EE101','MATH101'],         2:['EE201','EE202','MATH102'], 3:['EE301','EE302'] },
  'Mathematics':            { 1:['MATH101','MATH102'],        2:['MATH201','MATH202'],       3:['MATH301'] },
  'Physics':                { 1:['PHY101','MATH101'],         2:['PHY201','MATH201'],        3:['PHY301'] },
  'Mechanical Engineering': { 1:['ME101','MATH101'],          2:['ME201','MATH201'],         3:['ME301'] }
};

function buildAcademicRecord(department, year) {
  const deptMap = yearCourseMap[department] || {};
  const record = {};
  for (let y = 1; y < year; y++) (deptMap[y] || []).forEach(c => { record[c] = { status: 'completed' }; });
  (deptMap[year] || []).forEach(c => { record[c] = { status: 'not_taken' }; });
  return record;
}

function getCompletedCourses(academicRecord) {
  return Object.entries(academicRecord || {}).filter(([,v]) => v.status === 'completed').map(([k]) => k);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
async function seedData() {
  const count = await User.countDocuments();
  if (count > 0) return; // already seeded

  console.log('Seeding initial data...');

  await User.insertMany([
    { name:'Admin User', email:'admin@university.edu', password:bcrypt.hashSync('admin123',10), role:'admin', department:'Administration', year:null, academicRecord:{} },
    { name:'Alice Johnson', email:'alice@student.edu', password:bcrypt.hashSync('pass123',10), role:'student', department:'Computer Science', year:2,
      academicRecord:{ CS101:{status:'completed'}, CS102:{status:'completed'}, MATH101:{status:'completed'}, CS201:{status:'not_taken'}, CS202:{status:'not_taken'}, MATH102:{status:'not_taken'} } },
    { name:'Bob Smith', email:'bob@student.edu', password:bcrypt.hashSync('pass123',10), role:'student', department:'Computer Science', year:3,
      academicRecord:{ CS101:{status:'completed'}, CS102:{status:'completed'}, MATH101:{status:'completed'}, CS201:{status:'completed'}, CS202:{status:'failed'}, MATH102:{status:'completed'}, CS301:{status:'not_taken'}, CS302:{status:'not_taken'}, CS303:{status:'not_taken'} } },
    { name:'Carol White', email:'carol@student.edu', password:bcrypt.hashSync('pass123',10), role:'student', department:'Electrical Engineering', year:2,
      academicRecord:{ EE101:{status:'completed'}, MATH101:{status:'completed'}, EE201:{status:'not_taken'}, EE202:{status:'not_taken'}, MATH102:{status:'not_taken'} } },
    { name:'David Lee', email:'david@student.edu', password:bcrypt.hashSync('pass123',10), role:'student', department:'Computer Science', year:1,
      academicRecord:{ CS101:{status:'not_taken'}, CS102:{status:'not_taken'}, MATH101:{status:'not_taken'} } }
  ]);

  await Course.insertMany([
    { id:'CS101', name:'Introduction to Programming', department:'Computer Science', credits:3, capacity:60, prerequisites:[], schedule:'Mon/Wed 8:00-9:30', description:'Fundamentals of programming using Python', year:1 },
    { id:'CS102', name:'Data Structures', department:'Computer Science', credits:3, capacity:60, prerequisites:['CS101'], schedule:'Tue/Thu 8:00-9:30', description:'Arrays, linked lists, stacks, queues, trees', year:1 },
    { id:'CS201', name:'Object Oriented Programming', department:'Computer Science', credits:3, capacity:50, prerequisites:['CS101','CS102'], schedule:'Mon/Wed 13:00-14:30', description:'OOP concepts: classes, inheritance, polymorphism', year:2 },
    { id:'CS202', name:'Computer Networks', department:'Computer Science', credits:3, capacity:50, prerequisites:['CS101'], schedule:'Tue/Thu 13:00-14:30', description:'Network protocols, TCP/IP, routing', year:2 },
    { id:'CS301', name:'Algorithms', department:'Computer Science', credits:3, capacity:40, prerequisites:['CS201','MATH101'], schedule:'Mon/Wed 9:00-10:30', description:'Algorithm design and complexity analysis', year:3 },
    { id:'CS302', name:'Database Systems', department:'Computer Science', credits:3, capacity:40, prerequisites:['CS201'], schedule:'Tue/Thu 9:00-10:30', description:'Relational databases, SQL, NoSQL', year:3 },
    { id:'CS303', name:'Operating Systems', department:'Computer Science', credits:3, capacity:35, prerequisites:['CS201','CS102'], schedule:'Mon/Wed 11:00-12:30', description:'Process management, memory, file systems', year:3 },
    { id:'CS401', name:'Machine Learning', department:'Computer Science', credits:4, capacity:30, prerequisites:['CS301','MATH102'], schedule:'Tue/Thu 11:00-12:30', description:'Supervised and unsupervised learning', year:4 },
    { id:'CS402', name:'Cloud Computing', department:'Computer Science', credits:3, capacity:30, prerequisites:['CS302'], schedule:'Mon/Wed 14:00-15:30', description:'Cloud architecture and services', year:4 },
    { id:'EE101', name:'Basic Electrical Engineering', department:'Electrical Engineering', credits:3, capacity:50, prerequisites:[], schedule:'Mon/Wed 8:00-9:30', description:"Circuits, Ohm's law, AC/DC fundamentals", year:1 },
    { id:'EE201', name:'Electronic Circuits', department:'Electrical Engineering', credits:3, capacity:45, prerequisites:['EE101'], schedule:'Tue/Thu 10:00-11:30', description:'Diodes, transistors, amplifiers', year:2 },
    { id:'EE202', name:'Electromagnetic Theory', department:'Electrical Engineering', credits:3, capacity:45, prerequisites:['EE101','MATH101'], schedule:'Mon/Wed 10:00-11:30', description:"Maxwell's equations, fields and waves", year:2 },
    { id:'EE301', name:'Digital Electronics', department:'Electrical Engineering', credits:3, capacity:35, prerequisites:['EE201'], schedule:'Tue/Thu 14:00-15:30', description:'Logic gates, flip-flops, microcontrollers', year:3 },
    { id:'EE302', name:'Signal Processing', department:'Electrical Engineering', credits:3, capacity:30, prerequisites:['EE201','MATH102'], schedule:'Mon/Wed 9:00-10:30', description:'Analog and digital signal processing', year:3 },
    { id:'MATH101', name:'Calculus I', department:'Mathematics', credits:3, capacity:80, prerequisites:[], schedule:'Mon/Wed/Fri 9:00-10:00', description:'Limits, derivatives, integrals', year:1 },
    { id:'MATH102', name:'Calculus II', department:'Mathematics', credits:3, capacity:80, prerequisites:['MATH101'], schedule:'Mon/Wed/Fri 11:00-12:00', description:'Multivariable calculus, series', year:1 },
    { id:'MATH201', name:'Discrete Mathematics', department:'Mathematics', credits:3, capacity:60, prerequisites:['MATH101'], schedule:'Tue/Thu 9:00-10:30', description:'Logic, sets, graph theory, combinatorics', year:2 },
    { id:'MATH202', name:'Differential Equations', department:'Mathematics', credits:3, capacity:60, prerequisites:['MATH102'], schedule:'Tue/Thu 11:00-12:30', description:'ODEs, PDEs, Laplace transforms', year:2 },
    { id:'MATH301', name:'Linear Algebra', department:'Mathematics', credits:3, capacity:50, prerequisites:['MATH201'], schedule:'Mon/Wed/Fri 10:00-11:00', description:'Vectors, matrices, eigenvalues', year:3 },
    { id:'MATH302', name:'Probability & Statistics', department:'Mathematics', credits:3, capacity:50, prerequisites:['MATH201'], schedule:'Tue/Thu 13:00-14:30', description:'Probability theory and statistical inference', year:3 },
    { id:'PHY101', name:'Classical Mechanics', department:'Physics', credits:3, capacity:50, prerequisites:[], schedule:'Mon/Wed 10:00-11:30', description:"Newton's laws, kinematics, energy", year:1 },
    { id:'PHY201', name:'Thermodynamics', department:'Physics', credits:3, capacity:45, prerequisites:['PHY101','MATH101'], schedule:'Tue/Thu 10:00-11:30', description:'Laws of thermodynamics, entropy, heat engines', year:2 },
    { id:'PHY301', name:'Quantum Mechanics', department:'Physics', credits:4, capacity:35, prerequisites:['PHY201','MATH201'], schedule:'Mon/Wed 14:00-15:30', description:'Wave functions, Schrödinger equation, quantum states', year:3 },
    { id:'ME101', name:'Engineering Mechanics', department:'Mechanical Engineering', credits:3, capacity:50, prerequisites:[], schedule:'Tue/Thu 8:00-9:30', description:'Statics, dynamics, free body diagrams', year:1 },
    { id:'ME201', name:'Strength of Materials', department:'Mechanical Engineering', credits:3, capacity:45, prerequisites:['ME101','MATH101'], schedule:'Mon/Wed 13:00-14:30', description:'Stress, strain, beams, columns', year:2 },
    { id:'ME301', name:'Fluid Mechanics', department:'Mechanical Engineering', credits:3, capacity:40, prerequisites:['ME201','MATH201'], schedule:'Tue/Thu 13:00-14:30', description:'Fluid statics, Bernoulli, pipe flow', year:3 }
  ]);

  await Settings.create({ key: 'deadline', value: new Date(Date.now() + 7*24*60*60*1000) });
  console.log('Seed complete.');
}

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

function sanitizeUser(u) {
  return { id: u._id, name: u.name, email: u.email, role: u.role, department: u.department, year: u.year, academicRecord: u.academicRecord };
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: sanitizeUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, department, year } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already registered' });
    const parsedYear = parseInt(year) || 1;
    const academicRecord = buildAcademicRecord(department, parsedYear);
    const user = await User.create({ name, email, password: bcrypt.hashSync(password, 10), role: 'student', department, year: parsedYear, academicRecord });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Profile ──────────────────────────────────────────────────────────────────
app.get('/api/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(sanitizeUser(user));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Course Routes ────────────────────────────────────────────────────────────
app.get('/api/courses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const completed = getCompletedCourses(user?.academicRecord || {});
    const courses = await Course.find();
    const enriched = courses.map(c => {
      const missingPrereqs = c.prerequisites.filter(p => !completed.includes(p));
      return { ...c.toObject(), seatsLeft: c.capacity - c.enrolled, isFull: c.enrolled >= c.capacity, missingPrereqs, eligible: missingPrereqs.length === 0 };
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courses', auth, adminOnly, async (req, res) => {
  try {
    const { id, name, department, credits, capacity, prerequisites, schedule, description, year } = req.body;
    if (await Course.findOne({ id })) return res.status(400).json({ error: 'Course ID already exists' });
    const course = await Course.create({ id, name, department, credits:+credits, capacity:+capacity, enrolled:0, prerequisites:prerequisites||[], schedule, description, year:+year||3 });
    res.status(201).json(course);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/courses/:id', auth, adminOnly, async (req, res) => {
  try {
    const course = await Course.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/courses/:id', auth, adminOnly, async (req, res) => {
  try {
    await Course.deleteOne({ id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Preferences ──────────────────────────────────────────────────────────────
app.get('/api/preferences', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { studentId: req.user.id };
    res.json(await Preference.find(query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/preferences', auth, async (req, res) => {
  try {
    const deadlineSetting = await Settings.findOne({ key: 'deadline' });
    if (deadlineSetting && new Date() > new Date(deadlineSetting.value))
      return res.status(400).json({ error: 'Submission deadline has passed' });

    const { coursePreferences } = req.body;
    const studentId = req.user.id;
    const user = await User.findById(studentId);
    const completed = getCompletedCourses(user?.academicRecord || {});

    for (const pref of coursePreferences) {
      const course = await Course.findOne({ id: pref.courseId });
      if (!course) return res.status(400).json({ error: `Course ${pref.courseId} not found` });
      const missing = course.prerequisites.filter(p => !completed.includes(p));
      if (missing.length > 0) return res.status(400).json({ error: `Missing prerequisites for ${course.name}: ${missing.join(', ')}` });
      const conflict = coursePreferences.find(other => {
        if (other.courseId === pref.courseId) return false;
        return other._schedule === course.schedule;
      });
      if (conflict) return res.status(400).json({ error: `Timetable conflict: ${pref.courseId} and ${conflict.courseId} overlap` });
    }

    await Preference.deleteMany({ studentId });
    await Preference.insertMany(coursePreferences.map(p => ({ studentId, courseId: p.courseId, rank: p.rank })));
    res.json({ message: 'Preferences saved', count: coursePreferences.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Allocation Engine ────────────────────────────────────────────────────────
async function runAllocationEngine() {
  await Course.updateMany({}, { enrolled: 0 });
  await Allocation.deleteMany({});

  const courses = await Course.find();
  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  const prefs = await Preference.find();
  const studentPrefs = {};
  prefs.forEach(p => {
    const sid = p.studentId.toString();
    if (!studentPrefs[sid]) studentPrefs[sid] = [];
    studentPrefs[sid].push(p);
  });
  Object.values(studentPrefs).forEach(arr => arr.sort((a, b) => a.rank - b.rank));

  const students = await User.find({ _id: { $in: Object.keys(studentPrefs) } });
  const studentMap = {};
  students.forEach(s => { studentMap[s._id.toString()] = s; });

  const studentIds = Object.keys(studentPrefs).sort((a, b) => {
    const ya = studentMap[a]?.year || 0, yb = studentMap[b]?.year || 0;
    if (yb !== ya) return yb - ya;
    const ta = new Date(studentPrefs[a][0]?.submittedAt || 0);
    const tb = new Date(studentPrefs[b][0]?.submittedAt || 0);
    return ta - tb || Math.random() - 0.5;
  });

  const allocations = [];
  const studentSchedules = {};
  const enrolledCount = {};

  for (const sid of studentIds) {
    studentSchedules[sid] = [];
    const user = studentMap[sid];
    const completed = getCompletedCourses(user?.academicRecord || {});

    for (const pref of studentPrefs[sid]) {
      const course = courseMap[pref.courseId];
      if (!course) continue;
      const missing = course.prerequisites.filter(p => !completed.includes(p));
      if (missing.length > 0) { allocations.push({ studentId: sid, courseId: pref.courseId, status: 'ineligible', reason: `Missing: ${missing.join(', ')}` }); continue; }
      const enrolled = enrolledCount[course.id] || 0;
      if (enrolled >= course.capacity) { allocations.push({ studentId: sid, courseId: pref.courseId, status: 'waitlisted' }); continue; }
      if (studentSchedules[sid].includes(course.schedule)) { allocations.push({ studentId: sid, courseId: pref.courseId, status: 'conflict' }); continue; }
      enrolledCount[course.id] = enrolled + 1;
      studentSchedules[sid].push(course.schedule);
      allocations.push({ studentId: sid, courseId: pref.courseId, status: 'allocated' });
    }
  }

  await Allocation.insertMany(allocations);
  for (const [courseId, count] of Object.entries(enrolledCount)) {
    await Course.updateOne({ id: courseId }, { enrolled: count });
  }
  return allocations;
}

app.post('/api/allocate', auth, adminOnly, async (req, res) => {
  try {
    const result = await runAllocationEngine();
    res.json({ message: 'Allocation complete', total: result.length, allocated: result.filter(a => a.status === 'allocated').length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/allocations', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { studentId: req.user.id };
    const list = await Allocation.find(query);
    const courses = await Course.find();
    const users = await User.find();
    res.json(list.map(a => {
      const c = courses.find(x => x.id === a.courseId);
      const s = users.find(x => x._id.toString() === a.studentId.toString());
      return { ...a.toObject(), courseName: c?.name, schedule: c?.schedule, credits: c?.credits, studentName: s?.name, department: s?.department };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/allocations/override', auth, adminOnly, async (req, res) => {
  try {
    const { studentId, courseId, action } = req.body;
    const course = await Course.findOne({ id: courseId });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (action === 'add') {
      if (course.enrolled >= course.capacity) return res.status(400).json({ error: 'Course is full' });
      const ex = await Allocation.findOne({ studentId, courseId });
      if (ex) { ex.status = 'allocated'; await ex.save(); }
      else await Allocation.create({ studentId, courseId, status: 'allocated', override: true });
      await Course.updateOne({ id: courseId }, { $inc: { enrolled: 1 } });
    } else {
      const alloc = await Allocation.findOne({ studentId, courseId, status: 'allocated' });
      if (alloc) { alloc.status = 'removed'; await alloc.save(); await Course.updateOne({ id: courseId }, { $inc: { enrolled: -1 } }); }
    }
    res.json({ message: `Override: ${action}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Students (Admin) ─────────────────────────────────────────────────────────
app.get('/api/students', auth, adminOnly, async (req, res) => {
  try {
    res.json((await User.find({ role: 'student' })).map(sanitizeUser));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/students/:id/record', auth, adminOnly, async (req, res) => {
  try {
    const student = await User.findByIdAndUpdate(req.params.id, { academicRecord: req.body.academicRecord }, { new: true });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Updated', academicRecord: student.academicRecord });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Reports ──────────────────────────────────────────────────────────────────
app.get('/api/reports/enrollment', auth, adminOnly, async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses.map(c => ({ courseId: c.id, courseName: c.name, department: c.department, capacity: c.capacity, enrolled: c.enrolled, utilization: Math.round((c.enrolled/c.capacity)*100)+'%', seatsLeft: c.capacity-c.enrolled })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/popularity', auth, adminOnly, async (req, res) => {
  try {
    const courses = await Course.find();
    const prefs = await Preference.find();
    const counts = {};
    prefs.forEach(p => { counts[p.courseId] = (counts[p.courseId] || 0) + 1; });
    res.json(courses.map(c => ({ courseId: c.id, courseName: c.name, requests: counts[c.id]||0, enrolled: c.enrolled, capacity: c.capacity })).sort((a,b) => b.requests - a.requests));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/unallocated', auth, adminOnly, async (req, res) => {
  try {
    const prefs = await Preference.find();
    const withPrefs = [...new Set(prefs.map(p => p.studentId.toString()))];
    const allocs = await Allocation.find({ status: 'allocated' });
    const allocated = new Set(allocs.map(a => a.studentId.toString()));
    const unallocated = withPrefs.filter(id => !allocated.has(id));
    const users = await User.find({ _id: { $in: unallocated } });
    res.json(users.map(u => ({ id: u._id, name: u.name, email: u.email, department: u.department, year: u.year })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/students', auth, adminOnly, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' });
    const prefs = await Preference.find();
    const allocs = await Allocation.find({ status: 'allocated' });
    res.json(students.map(u => ({
      id: u._id, name: u.name, department: u.department, year: u.year,
      preferencesSubmitted: prefs.filter(p => p.studentId.toString() === u._id.toString()).length,
      coursesAllocated: allocs.filter(a => a.studentId.toString() === u._id.toString()).length
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', auth, adminOnly, async (req, res) => {
  try {
    const d = await Settings.findOne({ key: 'deadline' });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();
    res.json({ deadline: d?.value, totalStudents, totalCourses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', auth, adminOnly, async (req, res) => {
  try {
    if (req.body.deadline) await Settings.findOneAndUpdate({ key: 'deadline' }, { value: new Date(req.body.deadline) }, { upsert: true });
    const d = await Settings.findOne({ key: 'deadline' });
    res.json({ message: 'Updated', deadline: d?.value });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`CourseAlloc running on http://localhost:${PORT}`));
