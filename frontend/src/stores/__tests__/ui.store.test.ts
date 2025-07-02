/**
 * @jest-environment jsdom
 */

import { 
  useUIStore, 
  useSidebar, 
  useModal, 
  useDrawer, 
  useNotifications, 
  useGlobalSearch, 
  usePreferences, 
  useLoading 
} from '../ui';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock Intl for timezone
Object.defineProperty(Intl, 'DateTimeFormat', {
  value: jest.fn(() => ({
    resolvedOptions: () => ({ timeZone: 'America/New_York' })
  }))
});

describe('UIStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useUIStore.setState({
      sidebar: {
        isOpen: true,
        isCollapsed: false,
        activeSection: null,
      },
      headerHeight: 64,
      footerHeight: 0,
      globalLoading: false,
      loadingStates: {},
      modal: {
        isOpen: false,
        type: null,
        data: null,
        size: 'md',
      },
      drawer: {
        isOpen: false,
        type: null,
        data: null,
        position: 'right',
      },
      notifications: [],
      globalSearchOpen: false,
      globalSearchQuery: '',
      recentSearches: [],
      preferences: {
        theme: 'light',
        language: 'en',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        compactMode: false,
        animations: true,
        soundEffects: false,
        keyboardShortcuts: true,
        autoSave: true,
        autoSaveInterval: 30,
      },
      quickActions: {
        isOpen: false,
        recentActions: [],
        favoriteActions: [],
      },
      breadcrumbs: [],
      currentPage: '',
      pageTitle: '',
      pageSubtitle: undefined,
    });
    
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useUIStore.getState();
      
      expect(state.sidebar.isOpen).toBe(true);
      expect(state.sidebar.isCollapsed).toBe(false);
      expect(state.sidebar.activeSection).toBeNull();
      expect(state.headerHeight).toBe(64);
      expect(state.footerHeight).toBe(0);
      expect(state.globalLoading).toBe(false);
      expect(state.loadingStates).toEqual({});
      expect(state.modal.isOpen).toBe(false);
      expect(state.drawer.isOpen).toBe(false);
      expect(state.notifications).toEqual([]);
      expect(state.globalSearchOpen).toBe(false);
      expect(state.globalSearchQuery).toBe('');
      expect(state.recentSearches).toEqual([]);
      expect(state.quickActions.isOpen).toBe(false);
      expect(state.breadcrumbs).toEqual([]);
      expect(state.currentPage).toBe('');
      expect(state.pageTitle).toBe('');
    });

    it('should have correct default preferences', () => {
      const { preferences } = useUIStore.getState();
      
      expect(preferences.theme).toBe('light');
      expect(preferences.language).toBe('en');
      expect(preferences.dateFormat).toBe('MM/DD/YYYY');
      expect(preferences.timeFormat).toBe('12h');
      expect(preferences.compactMode).toBe(false);
      expect(preferences.animations).toBe(true);
      expect(preferences.soundEffects).toBe(false);
      expect(preferences.keyboardShortcuts).toBe(true);
      expect(preferences.autoSave).toBe(true);
      expect(preferences.autoSaveInterval).toBe(30);
    });
  });

  describe('Sidebar Management', () => {
    it('should set sidebar open state', () => {
      const { setSidebarOpen } = useUIStore.getState();
      
      setSidebarOpen(false);
      expect(useUIStore.getState().sidebar.isOpen).toBe(false);
      
      setSidebarOpen(true);
      expect(useUIStore.getState().sidebar.isOpen).toBe(true);
    });

    it('should set sidebar collapsed state', () => {
      const { setSidebarCollapsed } = useUIStore.getState();
      
      setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebar.isCollapsed).toBe(true);
      
      setSidebarCollapsed(false);
      expect(useUIStore.getState().sidebar.isCollapsed).toBe(false);
    });

    it('should toggle sidebar', () => {
      const { toggleSidebar } = useUIStore.getState();
      
      expect(useUIStore.getState().sidebar.isOpen).toBe(true);
      
      toggleSidebar();
      expect(useUIStore.getState().sidebar.isOpen).toBe(false);
      
      toggleSidebar();
      expect(useUIStore.getState().sidebar.isOpen).toBe(true);
    });

    it('should toggle sidebar collapse', () => {
      const { toggleSidebarCollapse } = useUIStore.getState();
      
      expect(useUIStore.getState().sidebar.isCollapsed).toBe(false);
      
      toggleSidebarCollapse();
      expect(useUIStore.getState().sidebar.isCollapsed).toBe(true);
      
      toggleSidebarCollapse();
      expect(useUIStore.getState().sidebar.isCollapsed).toBe(false);
    });

    it('should set active section', () => {
      const { setActiveSection } = useUIStore.getState();
      
      setActiveSection('patients');
      expect(useUIStore.getState().sidebar.activeSection).toBe('patients');
      
      setActiveSection('encounters');
      expect(useUIStore.getState().sidebar.activeSection).toBe('encounters');
      
      setActiveSection(null);
      expect(useUIStore.getState().sidebar.activeSection).toBeNull();
    });
  });

  describe('Loading Management', () => {
    it('should set global loading state', () => {
      const { setGlobalLoading } = useUIStore.getState();
      
      setGlobalLoading(true);
      expect(useUIStore.getState().globalLoading).toBe(true);
      
      setGlobalLoading(false);
      expect(useUIStore.getState().globalLoading).toBe(false);
    });

    it('should manage individual loading states', () => {
      const { setLoading, getLoading } = useUIStore.getState();
      
      expect(getLoading('patients')).toBe(false);
      
      setLoading('patients', true);
      expect(getLoading('patients')).toBe(true);
      expect(useUIStore.getState().loadingStates.patients).toBe(true);
      
      setLoading('patients', false);
      expect(getLoading('patients')).toBe(false);
      expect(useUIStore.getState().loadingStates.patients).toBe(false);
    });

    it('should handle multiple loading states', () => {
      const { setLoading, getLoading } = useUIStore.getState();
      
      setLoading('patients', true);
      setLoading('encounters', true);
      setLoading('medications', false);
      
      expect(getLoading('patients')).toBe(true);
      expect(getLoading('encounters')).toBe(true);
      expect(getLoading('medications')).toBe(false);
      expect(getLoading('nonexistent')).toBe(false);
    });
  });

  describe('Modal Management', () => {
    it('should open modal with default size', () => {
      const { openModal } = useUIStore.getState();
      
      openModal('patient-form', { patientId: '123' });
      
      const modal = useUIStore.getState().modal;
      expect(modal.isOpen).toBe(true);
      expect(modal.type).toBe('patient-form');
      expect(modal.data).toEqual({ patientId: '123' });
      expect(modal.size).toBe('md');
    });

    it('should open modal with custom size', () => {
      const { openModal } = useUIStore.getState();
      
      openModal('patient-details', { patientId: '456' }, 'lg');
      
      const modal = useUIStore.getState().modal;
      expect(modal.isOpen).toBe(true);
      expect(modal.type).toBe('patient-details');
      expect(modal.data).toEqual({ patientId: '456' });
      expect(modal.size).toBe('lg');
    });

    it('should close modal', () => {
      const { openModal, closeModal } = useUIStore.getState();
      
      openModal('test-modal', { test: 'data' });
      expect(useUIStore.getState().modal.isOpen).toBe(true);
      
      closeModal();
      
      const modal = useUIStore.getState().modal;
      expect(modal.isOpen).toBe(false);
      expect(modal.type).toBeNull();
      expect(modal.data).toBeNull();
      expect(modal.size).toBe('md');
    });
  });

  describe('Drawer Management', () => {
    it('should open drawer with default position', () => {
      const { openDrawer } = useUIStore.getState();
      
      openDrawer('patient-summary', { patientId: '789' });
      
      const drawer = useUIStore.getState().drawer;
      expect(drawer.isOpen).toBe(true);
      expect(drawer.type).toBe('patient-summary');
      expect(drawer.data).toEqual({ patientId: '789' });
      expect(drawer.position).toBe('right');
    });

    it('should open drawer with custom position', () => {
      const { openDrawer } = useUIStore.getState();
      
      openDrawer('navigation', null, 'left');
      
      const drawer = useUIStore.getState().drawer;
      expect(drawer.isOpen).toBe(true);
      expect(drawer.type).toBe('navigation');
      expect(drawer.data).toBeNull();
      expect(drawer.position).toBe('left');
    });

    it('should close drawer', () => {
      const { openDrawer, closeDrawer } = useUIStore.getState();
      
      openDrawer('test-drawer', { test: 'data' }, 'top');
      expect(useUIStore.getState().drawer.isOpen).toBe(true);
      
      closeDrawer();
      
      const drawer = useUIStore.getState().drawer;
      expect(drawer.isOpen).toBe(false);
      expect(drawer.type).toBeNull();
      expect(drawer.data).toBeNull();
      expect(drawer.position).toBe('right');
    });
  });

  describe('Notification Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should add notification', () => {
      const { addNotification } = useUIStore.getState();
      
      const notification = {
        title: 'Success',
        message: 'Patient saved successfully',
        type: 'success' as const
      };
      
      addNotification(notification);
      
      const notifications = useUIStore.getState().notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject(notification);
      expect(notifications[0].id).toBeDefined();
    });

    it('should auto-remove notification with default timeout', () => {
      const { addNotification } = useUIStore.getState();
      
      addNotification({
        title: 'Info',
        message: 'Auto-remove test',
        type: 'info' as const
      });
      
      expect(useUIStore.getState().notifications).toHaveLength(1);
      
      jest.advanceTimersByTime(5000);
      
      expect(useUIStore.getState().notifications).toHaveLength(0);
    });

    it('should auto-remove notification with custom timeout', () => {
      const { addNotification } = useUIStore.getState();
      
      addNotification({
        title: 'Warning',
        message: 'Custom timeout test',
        type: 'warning' as const,
        autoClose: 2000
      });
      
      expect(useUIStore.getState().notifications).toHaveLength(1);
      
      jest.advanceTimersByTime(1500);
      expect(useUIStore.getState().notifications).toHaveLength(1);
      
      jest.advanceTimersByTime(1000);
      expect(useUIStore.getState().notifications).toHaveLength(0);
    });

    it('should not auto-remove notification when autoClose is false', () => {
      const { addNotification } = useUIStore.getState();
      
      addNotification({
        title: 'Persistent',
        message: 'This should stay',
        type: 'error' as const,
        autoClose: false
      });
      
      expect(useUIStore.getState().notifications).toHaveLength(1);
      
      jest.advanceTimersByTime(10000);
      expect(useUIStore.getState().notifications).toHaveLength(1);
    });

    it('should remove specific notification', () => {
      const { addNotification, removeNotification } = useUIStore.getState();
      
      addNotification({
        title: 'First',
        message: 'First notification',
        type: 'info' as const,
        autoClose: false
      });
      
      addNotification({
        title: 'Second',
        message: 'Second notification',
        type: 'info' as const,
        autoClose: false
      });
      
      const notifications = useUIStore.getState().notifications;
      expect(notifications).toHaveLength(2);
      
      removeNotification(notifications[0].id);
      
      const remaining = useUIStore.getState().notifications;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe('Second');
    });

    it('should clear all notifications', () => {
      const { addNotification, clearNotifications } = useUIStore.getState();
      
      // Add multiple notifications
      for (let i = 0; i < 5; i++) {
        addNotification({
          title: `Notification ${i}`,
          message: `Message ${i}`,
          type: 'info' as const,
          autoClose: false
        });
      }
      
      expect(useUIStore.getState().notifications).toHaveLength(5);
      
      clearNotifications();
      expect(useUIStore.getState().notifications).toHaveLength(0);
    });
  });

  describe('Search Management', () => {
    it('should manage global search state', () => {
      const { setGlobalSearchOpen, setGlobalSearchQuery } = useUIStore.getState();
      
      setGlobalSearchOpen(true);
      expect(useUIStore.getState().globalSearchOpen).toBe(true);
      
      setGlobalSearchQuery('test query');
      expect(useUIStore.getState().globalSearchQuery).toBe('test query');
      
      setGlobalSearchOpen(false);
      expect(useUIStore.getState().globalSearchOpen).toBe(false);
    });

    it('should manage recent searches', () => {
      const { addRecentSearch } = useUIStore.getState();
      
      addRecentSearch('first search');
      addRecentSearch('second search');
      addRecentSearch('third search');
      
      const recentSearches = useUIStore.getState().recentSearches;
      expect(recentSearches).toEqual(['third search', 'second search', 'first search']);
    });

    it('should limit recent searches to 10 items', () => {
      const { addRecentSearch } = useUIStore.getState();
      
      // Add 12 searches
      for (let i = 1; i <= 12; i++) {
        addRecentSearch(`search ${i}`);
      }
      
      const recentSearches = useUIStore.getState().recentSearches;
      expect(recentSearches).toHaveLength(10);
      expect(recentSearches[0]).toBe('search 12'); // Most recent first
      expect(recentSearches[9]).toBe('search 3'); // Oldest kept
    });

    it('should handle duplicate searches', () => {
      const { addRecentSearch } = useUIStore.getState();
      
      addRecentSearch('duplicate search');
      addRecentSearch('other search');
      addRecentSearch('duplicate search'); // Should move to top, not duplicate
      
      const recentSearches = useUIStore.getState().recentSearches;
      expect(recentSearches).toEqual(['duplicate search', 'other search']);
    });

    it('should ignore empty searches', () => {
      const { addRecentSearch } = useUIStore.getState();
      
      addRecentSearch('');
      addRecentSearch('   ');
      addRecentSearch('valid search');
      
      const recentSearches = useUIStore.getState().recentSearches;
      expect(recentSearches).toEqual(['valid search']);
    });

    it('should clear recent searches', () => {
      const { addRecentSearch, clearRecentSearches } = useUIStore.getState();
      
      addRecentSearch('search 1');
      addRecentSearch('search 2');
      expect(useUIStore.getState().recentSearches).toHaveLength(2);
      
      clearRecentSearches();
      expect(useUIStore.getState().recentSearches).toHaveLength(0);
    });
  });

  describe('Preference Management', () => {
    it('should update individual preferences', () => {
      const { setPreference } = useUIStore.getState();
      
      setPreference('theme', 'dark');
      expect(useUIStore.getState().preferences.theme).toBe('dark');
      
      setPreference('language', 'pt');
      expect(useUIStore.getState().preferences.language).toBe('pt');
      
      setPreference('compactMode', true);
      expect(useUIStore.getState().preferences.compactMode).toBe(true);
      
      setPreference('autoSaveInterval', 60);
      expect(useUIStore.getState().preferences.autoSaveInterval).toBe(60);
    });

    it('should reset preferences to defaults', () => {
      const { setPreference, resetPreferences } = useUIStore.getState();
      
      // Change some preferences
      setPreference('theme', 'dark');
      setPreference('language', 'es');
      setPreference('animations', false);
      
      resetPreferences();
      
      const preferences = useUIStore.getState().preferences;
      expect(preferences.theme).toBe('light');
      expect(preferences.language).toBe('en');
      expect(preferences.animations).toBe(true);
    });
  });

  describe('Quick Actions Management', () => {
    it('should manage quick actions open state', () => {
      const { setQuickActionsOpen } = useUIStore.getState();
      
      setQuickActionsOpen(true);
      expect(useUIStore.getState().quickActions.isOpen).toBe(true);
      
      setQuickActionsOpen(false);
      expect(useUIStore.getState().quickActions.isOpen).toBe(false);
    });

    it('should manage recent actions', () => {
      const { addRecentAction } = useUIStore.getState();
      
      addRecentAction('create-patient');
      addRecentAction('view-encounters');
      addRecentAction('generate-report');
      
      const recentActions = useUIStore.getState().quickActions.recentActions;
      expect(recentActions).toEqual(['generate-report', 'view-encounters', 'create-patient']);
    });

    it('should limit recent actions to 5 items', () => {
      const { addRecentAction } = useUIStore.getState();
      
      // Add 7 actions
      for (let i = 1; i <= 7; i++) {
        addRecentAction(`action-${i}`);
      }
      
      const recentActions = useUIStore.getState().quickActions.recentActions;
      expect(recentActions).toHaveLength(5);
      expect(recentActions[0]).toBe('action-7');
      expect(recentActions[4]).toBe('action-3');
    });

    it('should manage favorite actions', () => {
      const { addFavoriteAction, removeFavoriteAction } = useUIStore.getState();
      
      addFavoriteAction('create-patient');
      addFavoriteAction('view-calendar');
      
      let favoriteActions = useUIStore.getState().quickActions.favoriteActions;
      expect(favoriteActions).toEqual(['create-patient', 'view-calendar']);
      
      removeFavoriteAction('create-patient');
      favoriteActions = useUIStore.getState().quickActions.favoriteActions;
      expect(favoriteActions).toEqual(['view-calendar']);
    });

    it('should not duplicate favorite actions', () => {
      const { addFavoriteAction } = useUIStore.getState();
      
      addFavoriteAction('duplicate-action');
      addFavoriteAction('duplicate-action');
      
      const favoriteActions = useUIStore.getState().quickActions.favoriteActions;
      expect(favoriteActions).toEqual(['duplicate-action']);
    });
  });

  describe('Breadcrumb Management', () => {
    it('should set breadcrumbs', () => {
      const { setBreadcrumbs } = useUIStore.getState();
      
      const breadcrumbs = [
        { label: 'Home', path: '/' },
        { label: 'Patients', path: '/patients' },
        { label: 'John Doe', path: '/patients/123' }
      ];
      
      setBreadcrumbs(breadcrumbs);
      expect(useUIStore.getState().breadcrumbs).toEqual(breadcrumbs);
    });

    it('should add breadcrumb', () => {
      const { setBreadcrumbs, addBreadcrumb } = useUIStore.getState();
      
      setBreadcrumbs([
        { label: 'Home', path: '/' },
        { label: 'Patients', path: '/patients' }
      ]);
      
      addBreadcrumb({ label: 'John Doe', path: '/patients/123', icon: 'user' });
      
      const breadcrumbs = useUIStore.getState().breadcrumbs;
      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[2]).toEqual({ label: 'John Doe', path: '/patients/123', icon: 'user' });
    });
  });

  describe('Page State Management', () => {
    it('should set current page', () => {
      const { setCurrentPage } = useUIStore.getState();
      
      setCurrentPage('patients');
      expect(useUIStore.getState().currentPage).toBe('patients');
      
      setCurrentPage('encounters');
      expect(useUIStore.getState().currentPage).toBe('encounters');
    });

    it('should set page title and subtitle', () => {
      const { setPageTitle } = useUIStore.getState();
      
      setPageTitle('Patient Management');
      expect(useUIStore.getState().pageTitle).toBe('Patient Management');
      expect(useUIStore.getState().pageSubtitle).toBeUndefined();
      
      setPageTitle('Patient Details', 'John Doe');
      expect(useUIStore.getState().pageTitle).toBe('Patient Details');
      expect(useUIStore.getState().pageSubtitle).toBe('John Doe');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset UI state', () => {
      const { 
        setSidebarOpen, 
        setGlobalLoading, 
        openModal, 
        openDrawer, 
        addNotification,
        setGlobalSearchOpen,
        setCurrentPage,
        resetUI 
      } = useUIStore.getState();
      
      // Change various states
      setSidebarOpen(false);
      setGlobalLoading(true);
      openModal('test-modal', { test: 'data' });
      openDrawer('test-drawer', { test: 'data' });
      addNotification({ title: 'Test', message: 'Test message', type: 'info', autoClose: false });
      setGlobalSearchOpen(true);
      setCurrentPage('test-page');
      
      resetUI();
      
      const state = useUIStore.getState();
      expect(state.sidebar.isOpen).toBe(true);
      expect(state.globalLoading).toBe(false);
      expect(state.modal.isOpen).toBe(false);
      expect(state.drawer.isOpen).toBe(false);
      expect(state.notifications).toHaveLength(0);
      expect(state.globalSearchOpen).toBe(false);
      expect(state.currentPage).toBe('');
    });
  });

  describe('Convenience Hooks', () => {
    it('should provide sidebar hook', () => {
      const sidebarHook = useSidebar();
      
      expect(sidebarHook).toHaveProperty('isOpen');
      expect(sidebarHook).toHaveProperty('isCollapsed');
      expect(sidebarHook).toHaveProperty('activeSection');
      expect(sidebarHook).toHaveProperty('setOpen');
      expect(sidebarHook).toHaveProperty('setCollapsed');
      expect(sidebarHook).toHaveProperty('toggle');
      expect(sidebarHook).toHaveProperty('toggleCollapse');
      expect(sidebarHook).toHaveProperty('setActiveSection');
    });

    it('should provide modal hook', () => {
      const modalHook = useModal();
      
      expect(modalHook).toHaveProperty('isOpen');
      expect(modalHook).toHaveProperty('type');
      expect(modalHook).toHaveProperty('data');
      expect(modalHook).toHaveProperty('size');
      expect(modalHook).toHaveProperty('open');
      expect(modalHook).toHaveProperty('close');
    });

    it('should provide drawer hook', () => {
      const drawerHook = useDrawer();
      
      expect(drawerHook).toHaveProperty('isOpen');
      expect(drawerHook).toHaveProperty('type');
      expect(drawerHook).toHaveProperty('data');
      expect(drawerHook).toHaveProperty('position');
      expect(drawerHook).toHaveProperty('open');
      expect(drawerHook).toHaveProperty('close');
    });

    it('should provide notifications hook', () => {
      const notificationsHook = useNotifications();
      
      expect(notificationsHook).toHaveProperty('notifications');
      expect(notificationsHook).toHaveProperty('add');
      expect(notificationsHook).toHaveProperty('remove');
      expect(notificationsHook).toHaveProperty('clear');
    });

    it('should provide global search hook', () => {
      const searchHook = useGlobalSearch();
      
      expect(searchHook).toHaveProperty('isOpen');
      expect(searchHook).toHaveProperty('query');
      expect(searchHook).toHaveProperty('recentSearches');
      expect(searchHook).toHaveProperty('setOpen');
      expect(searchHook).toHaveProperty('setQuery');
      expect(searchHook).toHaveProperty('addRecent');
      expect(searchHook).toHaveProperty('clearRecent');
    });

    it('should provide preferences hook', () => {
      const preferencesHook = usePreferences();
      
      expect(preferencesHook).toHaveProperty('preferences');
      expect(preferencesHook).toHaveProperty('setPreference');
      expect(preferencesHook).toHaveProperty('reset');
    });

    it('should provide loading hook', () => {
      const loadingHook = useLoading();
      
      expect(loadingHook).toHaveProperty('globalLoading');
      expect(loadingHook).toHaveProperty('setGlobalLoading');
      expect(loadingHook).toHaveProperty('setLoading');
      expect(loadingHook).toHaveProperty('getLoading');
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid notification auto-close values', () => {
      const { addNotification } = useUIStore.getState();
      
      // Test with undefined autoClose
      addNotification({
        title: 'Test',
        message: 'Test message',
        type: 'info' as const,
        autoClose: undefined
      });
      
      // Should use default behavior
      expect(useUIStore.getState().notifications).toHaveLength(1);
    });

    it('should handle empty breadcrumb operations', () => {
      const { setBreadcrumbs, addBreadcrumb } = useUIStore.getState();
      
      setBreadcrumbs([]);
      expect(useUIStore.getState().breadcrumbs).toEqual([]);
      
      addBreadcrumb({ label: 'First', path: '/first' });
      expect(useUIStore.getState().breadcrumbs).toHaveLength(1);
    });

    it('should handle long notification lists', () => {
      const { addNotification } = useUIStore.getState();
      
      // Add many notifications
      for (let i = 0; i < 100; i++) {
        addNotification({
          title: `Notification ${i}`,
          message: `Message ${i}`,
          type: 'info' as const,
          autoClose: false
        });
      }
      
      expect(useUIStore.getState().notifications).toHaveLength(100);
    });

    it('should handle special characters in search queries', () => {
      const { addRecentSearch } = useUIStore.getState();
      
      const specialQueries = [
        'search with spaces',
        'special-chars!@#$%',
        'unicode: émojis 🚀',
        'numbers: 123456'
      ];
      
      specialQueries.forEach(query => addRecentSearch(query));
      
      const recentSearches = useUIStore.getState().recentSearches;
      expect(recentSearches).toEqual(specialQueries.reverse());
    });
  });
});