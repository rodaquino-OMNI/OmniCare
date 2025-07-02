import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { NotificationConfig } from '@/types';

interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  activeSection: string | null;
}

interface ModalState {
  isOpen: boolean;
  type: string | null;
  data: any;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

interface DrawerState {
  isOpen: boolean;
  type: string | null;
  data: any;
  position: 'left' | 'right' | 'top' | 'bottom';
}

interface UIState {
  // Layout state
  sidebar: SidebarState;
  headerHeight: number;
  footerHeight: number;
  
  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;
  
  // Modals and drawers
  modal: ModalState;
  drawer: DrawerState;
  
  // Notifications
  notifications: NotificationConfig[];
  
  // Search
  globalSearchOpen: boolean;
  globalSearchQuery: string;
  recentSearches: string[];
  
  // User preferences
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: 'en' | 'pt' | 'es';
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    compactMode: boolean;
    animations: boolean;
    soundEffects: boolean;
    keyboardShortcuts: boolean;
    autoSave: boolean;
    autoSaveInterval: number; // in seconds
  };
  
  // Quick actions
  quickActions: {
    isOpen: boolean;
    recentActions: string[];
    favoriteActions: string[];
  };
  
  // Breadcrumbs
  breadcrumbs: Array<{
    label: string;
    path: string;
    icon?: string;
  }>;
  
  // Page state
  currentPage: string;
  pageTitle: string;
  pageSubtitle?: string;
  
  // Actions
  // Sidebar
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setActiveSection: (section: string | null) => void;
  
  // Loading
  setGlobalLoading: (loading: boolean) => void;
  setLoading: (key: string, loading: boolean) => void;
  getLoading: (key: string) => boolean;
  
  // Modals
  openModal: (type: string, data?: any, size?: ModalState['size']) => void;
  closeModal: () => void;
  
  // Drawers
  openDrawer: (
    type: string,
    data?: any,
    position?: DrawerState['position']
  ) => void;
  closeDrawer: () => void;
  
  // Notifications
  addNotification: (notification: Omit<NotificationConfig, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Search
  setGlobalSearchOpen: (open: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  
  // Preferences
  setPreference: <K extends keyof UIState['preferences']>(
    key: K,
    value: UIState['preferences'][K]
  ) => void;
  resetPreferences: () => void;
  
  // Quick actions
  setQuickActionsOpen: (open: boolean) => void;
  addRecentAction: (action: string) => void;
  addFavoriteAction: (action: string) => void;
  removeFavoriteAction: (action: string) => void;
  
  // Breadcrumbs
  setBreadcrumbs: (breadcrumbs: UIState['breadcrumbs']) => void;
  addBreadcrumb: (breadcrumb: UIState['breadcrumbs'][0]) => void;
  
  // Page state
  setCurrentPage: (page: string) => void;
  setPageTitle: (title: string, subtitle?: string) => void;
  
  // Utilities
  resetUI: () => void;
}

const defaultPreferences: UIState['preferences'] = {
  theme: 'light',
  language: 'en',
  timezone: typeof window !== 'undefined' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : 'UTC',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  compactMode: false,
  animations: true,
  soundEffects: false,
  keyboardShortcuts: true,
  autoSave: true,
  autoSaveInterval: 3,
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
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
      preferences: defaultPreferences,
      quickActions: {
        isOpen: false,
        recentActions: [],
        favoriteActions: [],
      },
      breadcrumbs: [],
      currentPage: '',
      pageTitle: '',
      pageSubtitle: undefined,

      // Sidebar actions
      setSidebarOpen: (open: boolean) => {
        set((state) => ({
          sidebar: { ...state.sidebar, isOpen: open },
        }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set((state) => ({
          sidebar: { ...state.sidebar, isCollapsed: collapsed },
        }));
      },

      toggleSidebar: () => {
        set((state) => ({
          sidebar: { ...state.sidebar, isOpen: !state.sidebar.isOpen },
        }));
      },

      toggleSidebarCollapse: () => {
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            isCollapsed: !state.sidebar.isCollapsed,
          },
        }));
      },

      setActiveSection: (section: string | null) => {
        set((state) => ({
          sidebar: { ...state.sidebar, activeSection: section },
        }));
      },

      // Loading actions
      setGlobalLoading: (loading: boolean) => {
        set({ globalLoading: loading });
      },

      setLoading: (key: string, loading: boolean) => {
        set((state) => ({
          loadingStates: {
            ...state.loadingStates,
            [key]: loading,
          },
        }));
      },

      getLoading: (key: string) => {
        const { loadingStates } = get();
        return loadingStates[key] || false;
      },

      // Modal actions
      openModal: (type: string, data?: any, size: ModalState['size'] = 'md') => {
        set({
          modal: {
            isOpen: true,
            type,
            data,
            size,
          },
        });
      },

      closeModal: () => {
        set({
          modal: {
            isOpen: false,
            type: null,
            data: null,
            size: 'md',
          },
        });
      },

      // Drawer actions
      openDrawer: (
        type: string,
        data?: any,
        position: DrawerState['position'] = 'right'
      ) => {
        set({
          drawer: {
            isOpen: true,
            type,
            data,
            position,
          },
        });
      },

      closeDrawer: () => {
        set({
          drawer: {
            isOpen: false,
            type: null,
            data: null,
            position: 'right',
          },
        });
      },

      // Notification actions
      addNotification: (notification: Omit<NotificationConfig, 'id'>) => {
        const id = Date.now().toString();
        const newNotification: NotificationConfig = {
          ...notification,
          id,
        };

        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));

        // Auto-remove notification if autoClose is set
        if (notification.autoClose !== false) {
          const timeout = typeof notification.autoClose === 'number' 
            ? notification.autoClose 
            : 500;
          
          setTimeout(() => {
            get().removeNotification(id);
          }, timeout);
        }
      },

      removeNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      // Search actions
      setGlobalSearchOpen: (open: boolean) => {
        set({ globalSearchOpen: open });
      },

      setGlobalSearchQuery: (query: string) => {
        set({ globalSearchQuery: query });
      },

      addRecentSearch: (query: string) => {
        if (!query.trim()) return;
        
        set((state) => {
          const filtered = state.recentSearches.filter((s) => s !== query);
          return {
            recentSearches: [query, ...filtered].slice(0, 10), // Keep last 10
          };
        });
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] });
      },

      // Preference actions
      setPreference: (key, value) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [key]: value,
          },
        }));
      },

      resetPreferences: () => {
        set({ preferences: defaultPreferences });
      },

      // Quick actions
      setQuickActionsOpen: (open: boolean) => {
        set((state) => ({
          quickActions: { ...state.quickActions, isOpen: open },
        }));
      },

      addRecentAction: (action: string) => {
        set((state) => {
          const filtered = state.quickActions.recentActions.filter(
            (a) => a !== action
          );
          return {
            quickActions: {
              ...state.quickActions,
              recentActions: [action, ...filtered].slice(0, 5), // Keep last 5
            },
          };
        });
      },

      addFavoriteAction: (action: string) => {
        set((state) => {
          if (state.quickActions.favoriteActions.includes(action)) {
            return state;
          }
          return {
            quickActions: {
              ...state.quickActions,
              favoriteActions: [...state.quickActions.favoriteActions, action],
            },
          };
        });
      },

      removeFavoriteAction: (action: string) => {
        set((state) => ({
          quickActions: {
            ...state.quickActions,
            favoriteActions: state.quickActions.favoriteActions.filter(
              (a) => a !== action
            ),
          },
        }));
      },

      // Breadcrumb actions
      setBreadcrumbs: (breadcrumbs: UIState['breadcrumbs']) => {
        set({ breadcrumbs });
      },

      addBreadcrumb: (breadcrumb: UIState['breadcrumbs'][0]) => {
        set((state) => ({
          breadcrumbs: [...state.breadcrumbs, breadcrumb],
        }));
      },

      // Page state actions
      setCurrentPage: (page: string) => {
        set({ currentPage: page });
      },

      setPageTitle: (title: string, subtitle?: string) => {
        set({ pageTitle: title, pageSubtitle: subtitle });
      },

      // Utility actions
      resetUI: () => {
        set((state) => ({
          ...state,
          sidebar: {
            isOpen: true,
            isCollapsed: false,
            activeSection: null,
          },
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
          quickActions: {
            isOpen: false,
            recentActions: [],
            favoriteActions: [],
          },
          breadcrumbs: [],
          currentPage: '',
          pageTitle: '',
          pageSubtitle: undefined,
        }));
      },
    }),
    {
      name: 'omnicare-ui-storage',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      partialize: (state) => ({
        preferences: state.preferences,
        sidebar: {
          isCollapsed: state.sidebar.isCollapsed,
        },
        recentSearches: state.recentSearches,
        quickActions: {
          favoriteActions: state.quickActions.favoriteActions,
        },
      }),
      skipHydration: true,
    }
  )
);

// Convenience hooks for specific UI features
export const useSidebar = () => {
  const isOpen = useUIStore((state) => state.sidebar.isOpen);
  const isCollapsed = useUIStore((state) => state.sidebar.isCollapsed);
  const activeSection = useUIStore((state) => state.sidebar.activeSection);
  const setOpen = useUIStore((state) => state.setSidebarOpen);
  const setCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const toggle = useUIStore((state) => state.toggleSidebar);
  const toggleCollapse = useUIStore((state) => state.toggleSidebarCollapse);
  const setActiveSection = useUIStore((state) => state.setActiveSection);

  return {
    isOpen,
    isCollapsed,
    activeSection,
    setOpen,
    setCollapsed,
    toggle,
    toggleCollapse,
    setActiveSection,
  };
};

export const useModal = () => {
  const isOpen = useUIStore((state) => state.modal.isOpen);
  const type = useUIStore((state) => state.modal.type);
  const data = useUIStore((state) => state.modal.data);
  const size = useUIStore((state) => state.modal.size);
  const open = useUIStore((state) => state.openModal);
  const close = useUIStore((state) => state.closeModal);

  return {
    isOpen,
    type,
    data,
    size,
    open,
    close,
  };
};

export const useDrawer = () => {
  const isOpen = useUIStore((state) => state.drawer.isOpen);
  const type = useUIStore((state) => state.drawer.type);
  const data = useUIStore((state) => state.drawer.data);
  const position = useUIStore((state) => state.drawer.position);
  const open = useUIStore((state) => state.openDrawer);
  const close = useUIStore((state) => state.closeDrawer);

  return {
    isOpen,
    type,
    data,
    position,
    open,
    close,
  };
};

export const useNotifications = () => {
  const notifications = useUIStore((state) => state.notifications);
  const add = useUIStore((state) => state.addNotification);
  const remove = useUIStore((state) => state.removeNotification);
  const clear = useUIStore((state) => state.clearNotifications);

  return {
    notifications,
    add,
    remove,
    clear,
  };
};

export const useGlobalSearch = () => {
  const isOpen = useUIStore((state) => state.globalSearchOpen);
  const query = useUIStore((state) => state.globalSearchQuery);
  const recentSearches = useUIStore((state) => state.recentSearches);
  const setOpen = useUIStore((state) => state.setGlobalSearchOpen);
  const setQuery = useUIStore((state) => state.setGlobalSearchQuery);
  const addRecent = useUIStore((state) => state.addRecentSearch);
  const clearRecent = useUIStore((state) => state.clearRecentSearches);

  return {
    isOpen,
    query,
    recentSearches,
    setOpen,
    setQuery,
    addRecent,
    clearRecent,
  };
};

export const usePreferences = () => {
  const preferences = useUIStore((state) => state.preferences);
  const setPreference = useUIStore((state) => state.setPreference);
  const reset = useUIStore((state) => state.resetPreferences);

  return {
    preferences,
    setPreference,
    reset,
  };
};

export const useLoading = () => {
  const globalLoading = useUIStore((state) => state.globalLoading);
  const setGlobalLoading = useUIStore((state) => state.setGlobalLoading);
  const setLoading = useUIStore((state) => state.setLoading);
  const getLoading = useUIStore((state) => state.getLoading);

  return {
    globalLoading,
    setGlobalLoading,
    setLoading,
    getLoading,
  };
};