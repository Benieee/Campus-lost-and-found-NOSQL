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

  window.notificationService = {
    getNotifications() {
      return getState().notifications || [];
    },
    createNotification(data) {
      const state = getState();
      const notification = {
        id: `note-${Date.now()}`,
        read: false,
        createdAt: new Date().toISOString(),
        ...data
      };
      state.notifications.unshift(notification);
      saveState(state);
      return notification;
    },
    markAsRead(id) {
      const state = getState();
      state.notifications = state.notifications.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      );
      saveState(state);
      return true;
    }
  };
})();
