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

window.claimService = {
  getClaims() {
    return getState().claims || [];
  },
  getClaimById(id) {
    return this.getClaims().find((claim) => claim.id === id) || null;
  },
  createClaim(data) {
    const state = getState();
    const claim = {
      id: `claim-${Date.now()}`,
      reference: `BLF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...data
    };
    state.claims.unshift(claim);
    saveState(state);
    return claim;
  },
  updateClaimStatus(id, updates) {
    const state = getState();
    const index = state.claims.findIndex((claim) => claim.id === id);
    if (index === -1) return null;
    state.claims[index] = { ...state.claims[index], ...updates };
    saveState(state);
    return state.claims[index];
  }
};
