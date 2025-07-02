'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { debounce } from 'lodash-es';

// Memory optimization hook
export const useMemoryOptimization = (componentName: string) => {
  const observerRef = useRef<PerformanceObserver | null>(null);
  const memoryUsageRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  // Memory monitoring
  useEffect(() => {
    if ('memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        memoryUsageRef.current = memory.usedJSHeapSize;
        
        // Warn if memory usage is high
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          console.warn(`High memory usage detected in ${componentName}: ${
            (memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
          }MB`);
        }
      };

      const debouncedCheck = debounce(checkMemory, 1000);
      
      // Check memory on each render
      renderCountRef.current++;
      debouncedCheck();

      return () => {
        debouncedCheck.cancel();
      };
    }
  });

  // Performance observer for long tasks
  useEffect(() => {
    if ('PerformanceObserver' in window) {
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > 50) { // Long task threshold
            console.warn(`Long task detected in ${componentName}: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });

      observerRef.current.observe({ entryTypes: ['longtask'] });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [componentName]);

  const getMemoryStats = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }, []);

  return {
    getMemoryStats,
    renderCount: renderCountRef.current,
    currentMemoryUsage: memoryUsageRef.current
  };
};

// Bundle size optimization hook
export const useBundleOptimization = () => {
  const bundleStats = useMemo(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    const scriptSizes = scripts.map(script => ({
      src: script.getAttribute('src') || '',
      async: script.hasAttribute('async'),
      defer: script.hasAttribute('defer')
    }));

    const styleSizes = styles.map(style => ({
      href: style.getAttribute('href') || '',
      preload: style.getAttribute('rel') === 'preload'
    }));

    return {
      scripts: scriptSizes,
      styles: styleSizes,
      totalScripts: scripts.length,
      totalStyles: styles.length
    };
  }, []);

  return bundleStats;
};

// Image loading optimization hook
export const useImageOptimization = () => {
  const observedImages = useRef(new Set<string>());
  
  const trackImageLoad = useCallback((src: string, loadTime: number) => {
    if (!observedImages.current.has(src)) {
      observedImages.current.add(src);
      
      if (loadTime > 1000) {
        console.warn(`Slow image load detected: ${src} took ${loadTime}ms`);
      }
    }
  }, []);

  const getImageStats = useCallback(() => {
    const images = Array.from(document.querySelectorAll('img'));
    const totalImages = images.length;
    const loadedImages = images.filter(img => img.complete).length;
    const lazyImages = images.filter(img => img.loading === 'lazy').length;

    return {
      total: totalImages,
      loaded: loadedImages,
      lazy: lazyImages,
      loadPercentage: totalImages > 0 ? (loadedImages / totalImages) * 100 : 0
    };
  }, []);

  return {
    trackImageLoad,
    getImageStats,
    observedCount: observedImages.current.size
  };
};

export default {
  useMemoryOptimization,
  useBundleOptimization,
  useImageOptimization
};