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

  window.foundItemService = {
    getFoundItems() {
      return getState().foundItems || [];
    },
    getFoundItemById(id) {
      return this.getFoundItems().find((item) => item.id === id) || null;
    },
    createFoundItem(data) {
      const state = getState();
      const item = {
        id: `found-${Date.now()}`,
        ...data,
        status: 'available',
        createdAt: new Date().toISOString()
      };
      state.foundItems.unshift(item);
      saveState(state);
      return item;
    },
    updateFoundItem(id, updates) {
      const state = getState();
      const index = state.foundItems.findIndex((item) => item.id === id);
      if (index === -1) return null;
      state.foundItems[index] = { ...state.foundItems[index], ...updates };
      saveState(state);
      return state.foundItems[index];
    },
    deleteFoundItem(id) {
      const state = getState();
      state.foundItems = state.foundItems.filter((item) => item.id !== id);
      saveState(state);
      return true;
    }
  };
})();
