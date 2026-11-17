(function () {
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

  window.lostItemService = {
    getLostItems() {
      return getState().lostItems || [];
    },
    getLostItemById(id) {
      return this.getLostItems().find((item) => item.id === id) || null;
    },
    createLostItem(data) {
      const state = getState();
      const item = {
        id: `lost-${Date.now()}`,
        ...data,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      state.lostItems.unshift(item);
      saveState(state);
      return item;
    },
    updateLostItem(id, updates) {
      const state = getState();
      const index = state.lostItems.findIndex((item) => item.id === id);
      if (index === -1) return null;
      state.lostItems[index] = { ...state.lostItems[index], ...updates };
      saveState(state);
      return state.lostItems[index];
    },
    deleteLostItem(id) {
      const state = getState();
      state.lostItems = state.lostItems.filter((item) => item.id !== id);
      saveState(state);
      return true;
    }
  };
})();
