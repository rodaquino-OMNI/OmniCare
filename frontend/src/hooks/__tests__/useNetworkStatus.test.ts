import { renderHook, act, waitFor } from '@testing-library/react';
import { useNetworkStatus, useResourceNetworkStatus } from '../useNetworkStatus';

// Mock the sync store
jest.mock('@/stores/sync', () => ({
  useSyncStore: () => ({
    triggerSync: jest.fn()
  })
}));

// Mock fetch
global.fetch = jest.fn();

// Mock performance.now
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now())
  }
});

describe('useNetworkStatus', () => {
  const mockConnection = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    effectiveType: '4g',
    downlink: 2.5,
    rtt: 50
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock navigator.connection
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      value: mockConnection
    });

    // Mock window methods
    Object.defineProperty(window, 'addEventListener', {
      writable: true,
      value: jest.fn()
    });

    Object.defineProperty(window, 'removeEventListener', {
      writable: true,
      value: jest.fn()
    });

    // Mock setInterval and clearInterval
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with online status', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(false);
      expect(result.current.connectionQuality).toBe('good');
    });

    it('should initialize with offline status when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);
      expect(result.current.connectionQuality).toBe('offline');
    });

    it('should handle server-side rendering', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);

      global.window = originalWindow;
    });
  });

  describe('Connection Quality Detection', () => {
    it('should detect good connection quality with 4G', () => {
      mockConnection.effectiveType = '4g';
      mockConnection.downlink = 2.5;

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.connectionQuality).toBe('good');
      expect(result.current.effectiveType).toBe('4g');
      expect(result.current.downlink).toBe(2.5);
    });

    it('should detect good connection quality with high downlink', () => {
      mockConnection.effectiveType = '3g';
      mockConnection.downlink = 2.0;

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.connectionQuality).toBe('good');
    });

    it('should detect poor connection quality with 3G', () => {
      mockConnection.effectiveType = '3g';
      mockConnection.downlink = 0.5;

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.connectionQuality).toBe('poor');
    });

    it('should detect poor connection quality with high RTT', () => {
      mockConnection.effectiveType = '4g';
      mockConnection.rtt = 400;

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.connectionQuality).toBe('poor');
    });

    it('should default to good quality when connection info is unavailable', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: undefined
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.connectionQuality).toBe('good');
    });
  });

  describe('Event Listeners', () => {
    it('should add event listeners on mount', () => {
      renderHook(() => useNetworkStatus());

      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockConnection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useNetworkStatus());

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockConnection.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should handle missing connection API gracefully', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: undefined
      });

      const { unmount } = renderHook(() => useNetworkStatus());

      // Should not throw error
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Online/Offline Transitions', () => {
    it('should detect when coming back online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const { result, rerender } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);
      expect(result.current.wasOffline).toBe(false);

      // Go online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      rerender();

      // Simulate online event
      act(() => {
        const onlineHandler = (window.addEventListener as jest.Mock).mock.calls
          .find(call => call[0] === 'online')[1];
        onlineHandler();
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(true);
    });

    it('should trigger sync when coming back online', () => {
      const { useSyncStore } = require('@/stores/sync');
      const triggerSync = jest.fn();
      useSyncStore.mockReturnValue({ triggerSync });

      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const { rerender } = renderHook(() => useNetworkStatus());

      // Go online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      rerender();

      // Simulate online event
      act(() => {
        const onlineHandler = (window.addEventListener as jest.Mock).mock.calls
          .find(call => call[0] === 'online')[1];
        onlineHandler();
      });

      expect(triggerSync).toHaveBeenCalled();
    });
  });

  describe('Periodic Updates', () => {
    it('should set up periodic status checks', () => {
      renderHook(() => useNetworkStatus());

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should clear interval on unmount', () => {
      const { unmount } = renderHook(() => useNetworkStatus());

      unmount();

      expect(clearInterval).toHaveBeenCalled();
    });

    it('should update status periodically', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Change connection quality
      mockConnection.effectiveType = '2g';

      // Fast-forward timer
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(result.current.connectionQuality).toBe('poor');
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle webkit connection API', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: undefined
      });

      Object.defineProperty(navigator, 'webkitConnection', {
        writable: true,
        value: mockConnection
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.effectiveType).toBe('4g');
    });

    it('should handle moz connection API', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: undefined
      });

      Object.defineProperty(navigator, 'mozConnection', {
        writable: true,
        value: mockConnection
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.effectiveType).toBe('4g');
    });
  });
});

describe('useResourceNetworkStatus', () => {
  const testUrl = 'https://api.example.com/health';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock performance.now
    let time = 0;
    (global.performance.now as jest.Mock).mockImplementation(() => {
      time += 100; // Simulate 100ms per call
      return time;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize with reachable status when online', () => {
      const { result } = renderHook(() => useResourceNetworkStatus(testUrl));

      expect(result.current.isReachable).toBe(true);
      expect(result.current.latency).toBeNull();
    });

    it('should mark as unreachable when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const { result } = renderHook(() => useResourceNetworkStatus(testUrl));

      expect(result.current.isReachable).toBe(false);
      expect(result.current.latency).toBeNull();
    });
  });

  describe('Reachability Checks', () => {
    it('should check reachability and measure latency', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const { result } = renderHook(() => useResourceNetworkStatus(testUrl));

      await waitFor(() => {
        expect(result.current.isReachable).toBe(true);
        expect(result.current.latency).toBe(100);
      });

      expect(global.fetch).toHaveBeenCalledWith(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
    });

    it('should mark as unreachable when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useResourceNetworkStatus(testUrl));

      await waitFor(() => {
        expect(result.current.isReachable).toBe(false);
        expect(result.current.latency).toBeNull();
      });
    });

    it('should perform periodic reachability checks', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      renderHook(() => useResourceNetworkStatus(testUrl));

      // Initial check
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Fast-forward to trigger periodic check
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear interval on unmount', () => {
      const { unmount } = renderHook(() => useResourceNetworkStatus(testUrl));

      unmount();

      expect(clearInterval).toHaveBeenCalled();
    });
  });

  describe('URL Changes', () => {
    it('should restart checks when URL changes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const { result, rerender } = renderHook(
        ({ url }) => useResourceNetworkStatus(url),
        { initialProps: { url: testUrl } }
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(testUrl, expect.any(Object));
      });

      // Change URL
      const newUrl = 'https://api.example.com/v2/health';
      rerender({ url: newUrl });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(newUrl, expect.any(Object));
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle latency measurement edge cases', async () => {
      // Mock performance.now to return same time (0 latency)
      (global.performance.now as jest.Mock).mockReturnValue(1000);

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useResourceNetworkStatus(testUrl));

      await waitFor(() => {
        expect(result.current.latency).toBe(0);
      });
    });

    it('should handle negative latency calculations', async () => {
      // Mock performance.now to go backwards (shouldn't happen but handle gracefully)
      let calls = 0;
      (global.performance.now as jest.Mock).mockImplementation(() => {
        calls++;
        return calls === 1 ? 1000 : 999;
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useResourceNetworkStatus(testUrl));

      await waitFor(() => {
        expect(result.current.latency).toBe(-1);
      });
    });

    it('should not perform checks when offline initially', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      renderHook(() => useResourceNetworkStatus(testUrl));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});