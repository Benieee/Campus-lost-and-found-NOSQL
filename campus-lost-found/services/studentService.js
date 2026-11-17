const STORAGE_KEY = 'campusLostFoundAppState';

const getState = () => {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (!saved) {
    return window.seedMockData();
  }
  return saved;
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

window.studentService = {
  getStudents() {
    return getState().students || [];
  },
  getStudentById(id) {
    return this.getStudents().find((student) => student.id === id) || null;
  },
  registerStudent(formData) {
    const state = getState();
    const student = {
      id: `student-${Date.now()}`,
      fullName: formData.fullName,
      studentId: formData.studentId,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role: 'student',
      createdAt: new Date().toISOString()
    };
    state.students.push(student);
    saveState(state);
    return student;
  },
  loginStudent(email, password) {
    const student = this.getStudents().find(
      (item) => item.email.toLowerCase() === String(email).toLowerCase() && item.password === password
    );
    if (!student) return null;
    const state = getState();
    state.currentUserId = student.id;
    saveState(state);
    return student;
  },
  updateStudent(id, updates) {
    const state = getState();
    const index = state.students.findIndex((student) => student.id === id);
    if (index === -1) return null;
    state.students[index] = { ...state.students[index], ...updates };
    saveState(state);
    return state.students[index];
  },
  deleteStudent(id) {
    const state = getState();
    state.students = state.students.filter((student) => student.id !== id);
    saveState(state);
    return true;
  }
};
