const STORAGE_KEY = 'campusLostFoundAppState';
const EMPTY_STATE = {
  students: [],
  lostItems: [],
  foundItems: [],
  claims: [],
  notifications: [],
  currentUserId: null
};

window.apiClient = {
  async request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() || `Request failed (${response.status}).` };
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }
};

function resolveAppPath(targetPath) {
  const normalizedPath = String(targetPath || '').replace(/^\/+/, '');
  const isInPagesFolder = window.location.pathname.includes('/pages/');
  if (normalizedPath.startsWith('pages/')) {
    return isInPagesFolder ? `./${normalizedPath.replace(/^pages\//, '')}` : `./${normalizedPath}`;
  }
  return isInPagesFolder ? `../${normalizedPath}` : `./${normalizedPath}`;
}

function getState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  return saved || {
    ...EMPTY_STATE,
    students: [],
    lostItems: [],
    foundItems: [],
    claims: [],
    notifications: []
  };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

window.appStore = {
  getState,
  saveState,
  replaceCollection(name, records) {
    const state = getState();
    state[name] = records;
    saveState(state);
  },
  upsert(name, record) {
    const state = getState();
    const records = state[name] || [];
    const index = records.findIndex((entry) => entry.id === record.id);
    if (index === -1) records.unshift(record);
    else records[index] = record;
    state[name] = records;
    saveState(state);
  },
  remove(name, id) {
    const state = getState();
    state[name] = (state[name] || []).filter((entry) => entry.id !== id);
    saveState(state);
  }
};

window.appReady = window.apiClient.request('/state').then((serverState) => {
  const cachedState = getState();
  const state = {
    ...EMPTY_STATE,
    ...serverState,
    notifications: cachedState.notifications || [],
    currentUserId: serverState.currentUser ? serverState.currentUser.id : null
  };
  saveState(state);
  return state;
});

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleDateString('en-UG', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function getCurrentUser() {
  const state = getState();
  const userId = state.currentUserId;
  return state.students.find((student) => student.id === userId) || null;
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast toast-${type} show`;
  toast.textContent = message;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

async function logoutUser() {
  try {
    await window.apiClient.request('/auth/logout', { method: 'POST' });
  } catch (error) {
    showToast(error.message, 'error');
    return;
  }
  const state = getState();
  state.currentUserId = null;
  saveState(state);
  window.location.href = resolveAppPath('login.html');
}

function renderStudentNavigation() {
  const nav = document.querySelector('[data-role-nav]');
  if (!nav) return;
  const user = getCurrentUser();
  if (!user) {
    nav.innerHTML = `
      <a href="${resolveAppPath('index.html')}">Home</a>
      <a href="${resolveAppPath('login.html')}">Log in</a>
      <a href="${resolveAppPath('register.html')}">Register</a>
    `;
    return;
  }
  nav.innerHTML = `
    <a href="${resolveAppPath('dashboard.html')}">Dashboard</a>
    <a href="${resolveAppPath('pages/report-lost.html')}">Report Lost</a>
    <a href="${resolveAppPath('pages/report-found.html')}">Report Found</a>
    <a href="${resolveAppPath('pages/lost-items.html')}">Lost Items</a>
    <a href="${resolveAppPath('pages/found-items.html')}">Found Items</a>
    <a href="${resolveAppPath('pages/my-reports.html')}">My Reports</a>
    <a href="${resolveAppPath('pages/notifications.html')}">Notifications</a>
    <button class="btn btn-small" onclick="logoutUser()">Logout</button>
  `;
}

function renderAdminNavigation() {
  const nav = document.querySelector('[data-admin-nav]');
  if (!nav) return;
  nav.innerHTML = `
    <a href="${resolveAppPath('pages/admin-dashboard.html')}">Overview</a>
    <a href="${resolveAppPath('pages/manage-students.html')}">Students</a>
    <a href="${resolveAppPath('pages/manage-lost-items.html')}">Lost Items</a>
    <a href="${resolveAppPath('pages/manage-found-items.html')}">Found Items</a>
    <a href="${resolveAppPath('pages/manage-claims.html')}">Claims</a>
    <a href="${resolveAppPath('pages/reports.html')}">Reports</a>
    <button class="btn btn-small" onclick="logoutUser()">Logout</button>
  `;
}

function renderUserProfile() {
  const user = getCurrentUser();
  const profile = document.querySelector('[data-user-profile]');
  if (!profile || !user) return;
  profile.innerHTML = `
    <div class="profile-summary">
      <div class="avatar">${user.fullName.split(' ').map((part) => part[0]).slice(0,2).join('').toUpperCase()}</div>
      <div>
        <h4>${user.fullName}</h4>
        <p>${user.role === 'admin' ? 'Administrator' : 'Student'}</p>
      </div>
    </div>
  `;
}

function renderNotificationsList() {
  const state = getState();
  const container = document.querySelector('[data-notifications-list]');
  if (!container) return;
  const user = getCurrentUser();
  const items = state.notifications.filter((item) => !user || item.userId === user.id || item.userId === 'admin-001');
  container.innerHTML = items.length ? items.map((item) => `
    <div class="notification-item ${item.read ? '' : 'unread'}">
      <div class="dot"></div>
      <div>
        <h5>${item.type.toUpperCase()}</h5>
        <p>${item.message}</p>
        <small>${formatDate(item.createdAt)}</small>
      </div>
    </div>
  `).join('') : '<p class="empty-state">No notifications yet.</p>';
}

function renderPublicLatestItems() {
  const state = getState();
  const lostContainer = document.querySelector('#latestLostItems');
  const foundContainer = document.querySelector('#latestFoundItems');
  if (lostContainer) {
    const items = state.lostItems.slice(0, 3);
    lostContainer.innerHTML = items.map((item) => `
      <div class="card item-card">
        <img src="${item.image}" alt="${item.itemName}" />
        <div class="item-card-body">
          <div class="badge badge-warning">${item.category}</div>
          <h4>${item.itemName}</h4>
          <p>${item.description}</p>
          <ul>
            <li><i class="fa-solid fa-location-dot"></i> ${item.location}</li>
            <li><i class="fa-solid fa-calendar"></i> ${formatDate(item.dateLost)}</li>
          </ul>
        </div>
      </div>
    `).join('');
  }
  if (foundContainer) {
    const items = state.foundItems.slice(0, 3);
    foundContainer.innerHTML = items.map((item) => `
      <div class="card item-card">
        <img src="${item.image}" alt="${item.itemName}" />
        <div class="item-card-body">
          <div class="badge badge-success">${item.category}</div>
          <h4>${item.itemName}</h4>
          <p>${item.description}</p>
          <ul>
            <li><i class="fa-solid fa-location-dot"></i> ${item.location}</li>
            <li><i class="fa-solid fa-check-circle"></i> ${item.status}</li>
          </ul>
        </div>
      </div>
    `).join('');
  }
}

function renderItemDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const type = params.get('type');
  const container = document.querySelector('[data-item-detail]');
  if (!container || !id) return;
  const state = getState();
  const item = type === 'found' ? state.foundItems.find((entry) => entry.id === id) : state.lostItems.find((entry) => entry.id === id);
  if (!item) {
    container.innerHTML = '<p class="empty-state">Item not found.</p>';
    return;
  }
  const isFound = type === 'found';
  container.innerHTML = `
    <div class="detail-card">
      <div class="detail-image"><img src="${item.image}" alt="${item.itemName}" /></div>
      <div class="detail-content">
        <div class="row-between">
          <span class="badge ${isFound ? 'badge-success' : 'badge-warning'}">${item.category}</span>
          <span class="status ${item.status || 'pending'}">${item.status || 'pending'}</span>
        </div>
        <h2>${item.itemName}</h2>
        <p>${item.description}</p>
        <div class="detail-grid">
          <div><strong>Location:</strong> ${item.location}</div>
          <div><strong>Date:</strong> ${formatDate(isFound ? item.dateFound : item.dateLost)}</div>
          ${isFound ? `<div><strong>Condition:</strong> ${item.condition}</div>` : `<div><strong>Contact:</strong> ${item.contact}</div>`}
          ${isFound ? `<div><strong>Holding location:</strong> ${item.holdingLocation}</div>` : `<div><strong>Distinguishing features:</strong> ${item.features}</div>`}
          ${isFound ? `<div><strong>Characteristics:</strong> ${item.features}</div>` : ''}
        </div>
        ${isFound ? '<a class="btn btn-primary" href="' + resolveAppPath('pages/submit-claim.html?itemId=' + item.id) + '">Submit claim</a>' : ''}
      </div>
    </div>
  `;
}

function populateAuthUserMenu() {
  const statusEl = document.querySelector('[data-user-status]');
  const user = getCurrentUser();
  if (statusEl && user) {
    statusEl.innerHTML = `<span>Signed in as ${user.fullName}</span>`;
  }
}

function renderDashboardStats() {
  const state = getState();
  const user = getCurrentUser();
  if (!user) return;

  const myLost = state.lostItems.filter((item) => item.reportBy === user.id).length;
  const myFound = state.foundItems.filter((item) =>
    item.reportBy === user.id || (item.contact && item.contact.includes(user.email))
  ).length;
  const myClaims = state.claims.filter((claim) => claim.studentId === user.studentId).length;
  const returnedItems = state.lostItems.filter((item) => item.reportBy === user.id && item.status === 'resolved').length;

  const mappings = [
    ['myLostReports', myLost],
    ['myFoundReports', myFound],
    ['myActiveClaims', myClaims],
    ['returnedItems', returnedItems]
  ];
  mappings.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function renderAdminDashboardStats() {
  const state = getState();
  const stats = {
    totalLostItems: state.lostItems.length,
    totalFoundItems: state.foundItems.length,
    pendingClaims: state.claims.filter((claim) => claim.status === 'pending' || claim.status === 'under_review').length,
    approvedClaims: state.claims.filter((claim) => claim.status === 'approved' || claim.status === 'completed').length,
    returnedItems: state.lostItems.filter((item) => item.status === 'resolved').length,
    registeredStudents: state.students.filter((student) => student.role === 'student').length
  };
  Object.entries(stats).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (el) el.textContent = value;
  });
}

function renderDashboardActivity() {
  const state = getState();
  const user = getCurrentUser();
  if (!user) return;

  const reports = [
    ...state.lostItems.filter((item) => item.reportBy === user.id),
    ...state.foundItems.filter((item) => item.reportBy === user.id)
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const claims = state.claims
    .filter((claim) => claim.studentId === user.studentId)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const reportList = document.querySelector('[data-recent-reports]');
  if (reportList) {
    reportList.innerHTML = reports.slice(0, 3).map((item) => `
      <div class="activity-item"><span>${item.itemName}</span><span class="status ${item.status}">${item.status}</span></div>
    `).join('') || '<p class="empty-state">No reports yet.</p>';
  }
  const claimList = document.querySelector('[data-recent-claims]');
  if (claimList) {
    claimList.innerHTML = claims.slice(0, 3).map((claim) => `
      <div class="activity-item"><span>${claim.reference}</span><span class="status ${claim.status}">${claim.status}</span></div>
    `).join('') || '<p class="empty-state">No claims yet.</p>';
  }
}

function renderAdminRecentActivity() {
  const state = getState();
  const reports = document.querySelector('[data-admin-recent-reports]');
  if (reports) {
    reports.innerHTML = [...state.lostItems]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .map((item) => `<div class="activity-item"><span>${item.itemName}</span><span class="status ${item.status}">${item.status}</span></div>`)
      .join('') || '<p class="empty-state">No reports yet.</p>';
  }
  const claims = document.querySelector('[data-admin-recent-claims]');
  if (claims) {
    claims.innerHTML = [...state.claims]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .map((claim) => `<div class="activity-item"><span>${claim.reference}</span><span class="status ${claim.status}">${claim.status}</span></div>`)
      .join('') || '<p class="empty-state">No claims yet.</p>';
  }
}

function renderAnalytics() {
  const state = getState();
  const totalItems = document.querySelector('[data-total-items]');
  if (!totalItems) return;
  const lostFound = document.querySelector('[data-lost-found]');
  const returned = document.querySelector('[data-returned-items]');
  const outstanding = document.querySelector('[data-outstanding-claims]');
  totalItems.textContent = state.lostItems.length + state.foundItems.length;
  if (lostFound) lostFound.textContent = `${state.lostItems.length} / ${state.foundItems.length}`;
  if (returned) returned.textContent = state.lostItems.filter((item) => item.status === 'resolved').length;
  if (outstanding) outstanding.textContent = state.claims.filter((claim) => ['pending', 'under_review'].includes(claim.status)).length;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.appReady;
  } catch (error) {
    showToast(`MongoDB service unavailable: ${error.message}`, 'error');
    return;
  }

  renderStudentNavigation();
  renderAdminNavigation();
  renderUserProfile();
  renderNotificationsList();
  renderPublicLatestItems();
  renderItemDetailPage();
  renderDashboardStats();
  renderAdminDashboardStats();
  renderDashboardActivity();
  renderAdminRecentActivity();
  renderAnalytics();
  populateAuthUserMenu();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      try {
        const user = await window.studentService.loginStudent(email, password);
        showToast('Signed in successfully.', 'success');
        setTimeout(() => {
          window.location.href = resolveAppPath(user.role === 'admin' ? 'pages/admin-dashboard.html' : 'dashboard.html');
        }, 600);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = {
        fullName: document.getElementById('fullName').value.trim(),
        studentId: document.getElementById('studentId').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        password: document.getElementById('password').value.trim(),
        confirmPassword: document.getElementById('confirmPassword').value.trim()
      };
      if (data.password !== data.confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }
      if (!data.fullName || !data.studentId || !data.email || !data.phone || !data.password) {
        showToast('Please complete all fields.', 'error');
        return;
      }
      try {
        await window.studentService.registerStudent({
          fullName: data.fullName,
          studentId: data.studentId,
          email: data.email,
          phone: data.phone,
          password: data.password
        });
        showToast('Registration successful. Please log in.', 'success');
        setTimeout(() => {
          window.location.href = resolveAppPath('login.html');
        }, 800);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const lostForm = document.getElementById('lostItemForm');
  if (lostForm) {
    lostForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const user = getCurrentUser();
      if (!user) {
        window.location.href = resolveAppPath('login.html');
        return;
      }
      const formData = new FormData(lostForm);
      const payload = {
        itemName: formData.get('itemName'),
        category: formData.get('category'),
        description: formData.get('description'),
        dateLost: formData.get('dateLost'),
        location: formData.get('location'),
        features: formData.get('features'),
        contact: formData.get('contact'),
        image: document.getElementById('imagePreview')?.src || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
        reportBy: user.id
      };
      try {
        await window.lostItemService.createLostItem(payload);
        window.notificationService.createNotification({
          userId: user.id,
          message: `Your lost item report for ${payload.itemName} was submitted successfully.`,
          type: 'report'
        });
        showToast('Lost item report submitted successfully.', 'success');
        setTimeout(() => {
          window.location.href = resolveAppPath('dashboard.html');
        }, 700);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const foundForm = document.getElementById('foundItemForm');
  if (foundForm) {
    foundForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(foundForm);
      const payload = {
        itemName: formData.get('itemName'),
        category: formData.get('category'),
        description: formData.get('description'),
        dateFound: formData.get('dateFound'),
        location: formData.get('location'),
        condition: formData.get('condition'),
        features: formData.get('features'),
        holdingLocation: formData.get('holdingLocation'),
        contact: formData.get('contact'),
        image: document.getElementById('imagePreview')?.src || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
        status: 'available'
      };
      try {
        await window.foundItemService.createFoundItem(payload);
        showToast('Found item report submitted successfully.', 'success');
        setTimeout(() => {
          window.location.href = resolveAppPath('pages/found-items.html');
        }, 700);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const claimForm = document.getElementById('claimForm');
  if (claimForm) {
    claimForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const params = new URLSearchParams(window.location.search);
      const foundItemId = params.get('itemId') || document.getElementById('foundItemSelect')?.value;
      const user = getCurrentUser();
      const claim = {
        foundItemId,
        studentId: document.getElementById('claimStudentId').value.trim(),
        explanation: document.getElementById('claimExplanation').value.trim(),
        distinguishingFeatures: document.getElementById('claimFeatures').value.trim(),
        additionalInfo: document.getElementById('claimAdditional').value.trim()
      };
      if (!foundItemId || !claim.studentId || !claim.explanation || !claim.distinguishingFeatures) {
        showToast('Please complete the required claim fields.', 'error');
        return;
      }
      try {
        await window.claimService.createClaim(claim);
        if (user) {
          window.notificationService.createNotification({
            userId: user.id,
            message: 'Your claim has been submitted and is now under review.',
            type: 'claim'
          });
        }
        showToast('Claim submitted successfully.', 'success');
        setTimeout(() => {
          window.location.href = resolveAppPath('pages/my-claims.html');
        }, 700);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  const passwordToggles = document.querySelectorAll('[data-password-toggle]');
  passwordToggles.forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.previousElementSibling;
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  const clearButton = document.getElementById('clearLostForm');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      const form = document.getElementById('lostItemForm');
      if (form) form.reset();
    });
  }

  const clearFoundButton = document.getElementById('clearFoundForm');
  if (clearFoundButton) {
    clearFoundButton.addEventListener('click', () => {
      const form = document.getElementById('foundItemForm');
      if (form) form.reset();
    });
  }

  const previewImage = document.getElementById('imagePreview');
  const uploadInput = document.getElementById('imageUpload');
  if (uploadInput && previewImage) {
    uploadInput.addEventListener('change', (event) => {
      const [file] = event.target.files;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const exportButton = document.querySelector('[data-export-csv]');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const state = getState();
      const rows = [
        ['type', 'itemName', 'category', 'status', 'createdAt'],
        ...state.lostItems.map((item) => ['lost', item.itemName, item.category, item.status, item.createdAt]),
        ...state.foundItems.map((item) => ['found', item.itemName, item.category, item.status, item.createdAt])
      ];
      const csv = rows.map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = 'campus-lost-found-report.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }
});
