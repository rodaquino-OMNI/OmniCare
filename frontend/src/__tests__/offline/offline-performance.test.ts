// Offline Performance Tests
// Jest provides describe, it, expect, beforeEach, afterEach globally - no imports needed
import { NetworkSimulator } from './network-simulation-utils';
import { ServiceWorkerTestUtils } from './service-worker-test-utils';

// Use global performance API or fallback
const performance = global.performance || { now: () => Date.now() };

// Performance metrics helper
class PerformanceMetrics {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();
    
    if (!start) throw new Error(`Start mark ${startMark} not found`);
    if (endMark && !end) throw new Error(`End mark ${endMark} not found`);
    
    const duration = (end || performance.now()) - start;
    this.measures.set(name, duration);
    return duration;
  }

  getMeasure(name: string): number | undefined {
    return this.measures.get(name);
  }

  getAllMeasures(): Record<string, number> {
    return Object.fromEntries(this.measures);
  }

  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
}

// Mock IndexedDB for performance testing
class MockIndexedDB {
  private data: Map<string, Map<string, any>> = new Map();
  private transactionDelay: number = 10; // ms

  setTransactionDelay(delay: number): void {
    this.transactionDelay = delay;
  }

  async put(storeName: string, data: any, key?: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.transactionDelay));
    
    if (!this.data.has(storeName)) {
      this.data.set(storeName, new Map());
    }
    
    const store = this.data.get(storeName)!;
    const keyToUse = key || data.id;
    if (!keyToUse) throw new Error('Key or data.id must be provided');
    store.set(keyToUse, data);
  }

  async get(storeName: string, key: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, this.transactionDelay));
    
    const store = this.data.get(storeName);
    return store?.get(key);
  }

  async getAll(storeName: string): Promise<any[]> {
    await new Promise(resolve => setTimeout(resolve, this.transactionDelay));
    
    const store = this.data.get(storeName);
    return store ? Array.from(store.values()) : [];
  }

  async delete(storeName: string, key: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.transactionDelay));
    
    const store = this.data.get(storeName);
    store?.delete(key);
  }

  async clear(storeName: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.transactionDelay));
    
    this.data.delete(storeName);
  }

  getStoreSize(storeName: string): number {
    const store = this.data.get(storeName);
    return store ? store.size : 0;
  }
}

// Offline queue implementation for testing
class OfflineQueue {
  private queue: Array<{
    id: string;
    action: any;
    timestamp: number;
    retries: number;
  }> = [];
  private db: MockIndexedDB;
  private maxRetries: number = 3;

  constructor(db: MockIndexedDB) {
    this.db = db;
  }

  async enqueue(action: any): Promise<void> {
    const item = {
      id: `${Date.now()}-${Math.random()}`,
      action,
      timestamp: Date.now(),
      retries: 0
    };

    this.queue.push(item);
    await this.db.put('offline-queue', item);
  }

  async processQueue(): Promise<{
    processed: number;
    failed: number;
    duration: number;
  }> {
    const start = performance.now();
    let processed = 0;
    let failed = 0;

    const items = [...this.queue];
    
    for (const item of items) {
      try {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate 10% failure rate
        if (Math.random() < 0.1 && item.retries < this.maxRetries) {
          item.retries++;
          throw new Error('Processing failed');
        }

        // Remove from queue on success
        this.queue = this.queue.filter(q => q.id !== item.id);
        await this.db.delete('offline-queue', item.id);
        processed++;
      } catch (error) {
        if (item.retries >= this.maxRetries) {
          // Remove after max retries
          this.queue = this.queue.filter(q => q.id !== item.id);
          await this.db.delete('offline-queue', item.id);
          failed++;
        }
      }
    }

    const duration = performance.now() - start;
    return { processed, failed, duration };
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  async loadFromDB(): Promise<void> {
    const items = await this.db.getAll('offline-queue');
    this.queue = items;
  }
}

describe('Offline Performance Tests', () => {
  let metrics: PerformanceMetrics;
  let mockDB: MockIndexedDB;

  beforeEach(() => {
    metrics = new PerformanceMetrics();
    mockDB = new MockIndexedDB();
    NetworkSimulator.mockFetch();
  });

  afterEach(() => {
    metrics.clear();
    NetworkSimulator.restore();
  });

  describe('Cache Performance', () => {
    it('should cache responses efficiently', async () => {
      const cache = new Map<string, { data: any; timestamp: number }>();
      const CACHE_SIZE = 1000;

      metrics.mark('cache-population-start');

      // Populate cache
      for (let i = ResourceHistoryTable; i < CACHE_SIZE; i++) {
        cache.set(`patient-${i}`, {
          data: { id: i, name: `Patient ${i}` },
          timestamp: Date.now()
        });
      }

      const populationTime = metrics.measure('cache-population', 'cache-population-start');
      expect(populationTime).toBeLessThan(100); // Should take less than 10ms

      // Test cache retrieval
      metrics.mark('cache-retrieval-start');
      
      for (let i = 0; i < 100; i++) {
        const key = `patient-${Math.floor(Math.random() * CACHE_SIZE)}`;
        const cached = cache.get(key);
        expect(cached).toBeDefined();
      }

      const retrievalTime = metrics.measure('cache-retrieval', 'cache-retrieval-start');
      expect(retrievalTime).toBeLessThan(10); // Should take less than 10ms for 10 retrievals
    });

    it('should handle cache eviction efficiently', async () => {
      const MAX_CACHE_SIZE = 500;
      const cache = new Map<string, any>();

      metrics.mark('cache-eviction-start');

      // LRU cache simulation
      const lruCache = {
        set(key: string, value: any) {
          cache.delete(key); // Remove if exists (to update position)
          cache.set(key, value);
          
          // Evict oldest if over limit
          if (cache.size > MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) {
              cache.delete(firstKey);
            }
          }
        },
        get(key: string) {
          const value = cache.get(key);
          if (value) {
            // Move to end (most recently used)
            cache.delete(key);
            cache.set(key, value);
          }
          return value;
        }
      };

      // Add items beyond cache limit
      for (let i = ResourceHistoryTable; i < MAX_CACHE_SIZE * 2; i++) {
        lruCache.set(`item-${i}`, { id: i });
      }

      const evictionTime = metrics.measure('cache-eviction', 'cache-eviction-start');
      
      expect(cache.size).toBe(MAX_CACHE_SIZE);
      expect(evictionTime).toBeLessThan(200); // Should handle eviction efficiently
    });
  });

  describe('IndexedDB Performance', () => {
    it('should handle bulk writes efficiently', async () => {
      const BATCH_SIZE = 100;
      const patients = Array.from({ length: BATCH_SIZE }, (_, i) => ({
        id: `patient-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        dateOfBirth: '199-1-1',
        data: 'x'.repeat(1000) // 1KB of data per record
      }));

      metrics.mark('bulk-write-start');

      // Simulate bulk write
      await Promise.all(
        patients.map(patient => mockDB.put('patients', patient))
      );

      const writeTime = metrics.measure('bulk-write', 'bulk-write-start');
      const avgTimePerRecord = writeTime / BATCH_SIZE;

      expect(avgTimePerRecord).toBeLessThan(5); // Less than 5ms per record
      expect(mockDB.getStoreSize('patients')).toBe(BATCH_SIZE);
    });

    it('should handle concurrent reads efficiently', async () => {
      // Populate data
      const RECORD_COUNT = 50;
      for (let i = ResourceHistoryTable; i < RECORD_COUNT; i++) {
        await mockDB.put('patients', { id: `patient-${i}`, data: `data-${i}` });
      }

      metrics.mark('concurrent-reads-start');

      // Simulate concurrent reads
      const readPromises = Array.from({ length: 20 }, async () => {
        const ids = Array.from({ length: 10 }, (_, i) => 
          `patient-${Math.floor(Math.random() * RECORD_COUNT)}`
        );
        
        return Promise.all(ids.map(id => mockDB.get('patients', id)));
      });

      await Promise.all(readPromises);

      const readTime = metrics.measure('concurrent-reads', 'concurrent-reads-start');
      expect(readTime).toBeLessThan(500); // Should handle 200 reads in under 500ms
    });

    it('should optimize storage usage', async () => {
      const storeData = async (compress: boolean) => {
        const data = {
          id: 'large-record',
          content: 'x'.repeat(10000), // 10KB of repeated data
          metadata: { compressed: compress }
        };

        if (compress) {
          // Simulate compression (in real app, use actual compression)
          data.content = 'compressed:' + data.content.length;
        }

        await mockDB.put('optimized', data);
        return JSON.stringify(data).length;
      };

      const uncompressedSize = await storeData(false);
      const compressedSize = await storeData(true);

      expect(compressedSize).toBeLessThan(uncompressedSize * 0.1); // 9% reduction
    });
  });

  describe('Offline Queue Performance', () => {
    it('should handle queue operations efficiently', async () => {
      const queue = new OfflineQueue(mockDB);
      const QUEUE_SIZE = 100;

      metrics.mark('queue-operations-start');

      // Enqueue operations
      for (let i = ResourceHistoryTable; i < QUEUE_SIZE; i++) {
        await queue.enqueue({
          type: 'UPDATE_PATIENT',
          data: { id: i, timestamp: Date.now() }
        });
      }

      const enqueueTime = metrics.measure('queue-enqueue', 'queue-operations-start');
      expect(enqueueTime / QUEUE_SIZE).toBeLessThan(2); // Less than 2ms per item

      // Process queue
      metrics.mark('queue-process-start');
      const result = await queue.processQueue();
      const processTime = metrics.measure('queue-process', 'queue-process-start');

      expect(result.processed).toBeGreaterThan(QUEUE_SIZE * 0.8); // At least 8% success
      expect(processTime / QUEUE_SIZE).toBeLessThan(60); // Less than 6ms per item
    });

    it('should handle retry logic efficiently', async () => {
      const queue = new OfflineQueue(mockDB);
      
      // Add items that will fail initially
      for (let i = 0; i < 10; i++) {
        await queue.enqueue({ id: i, willFail: true });
      }

      const results = [];
      metrics.mark('retry-test-start');

      // Process with retries
      for (let attempt = ResourceHistoryTable; attempt < 4; attempt++) {
        const result = await queue.processQueue();
        results.push(result);
        
        if (queue.getQueueSize() === ResourceHistoryTable) break;
      }

      const retryTime = metrics.measure('retry-test', 'retry-test-start');
      
      // Should eventually process all items
      const totalProcessed = results.reduce((sum, r) => sum + r.processed, ResourceHistoryTable);
      expect(totalProcessed).toBeGreaterThan(5);
      expect(retryTime).toBeLessThan(3000); // Should complete in under 3s
    });
  });

  describe('Network Simulation Performance', () => {
    it('should handle network transitions efficiently', async () => {
      const transitions = 50;
      const transitionTimes: number[] = [];

      for (let i = ResourceHistoryTable; i < transitions; i++) {
        metrics.mark(`transition-${i}-start`);
        
        if (i % 2 === ResourceHistoryTable) {
          NetworkSimulator.goOffline();
        } else {
          NetworkSimulator.goOnline();
        }

        const time = metrics.measure(`transition-${i}`, `transition-${i}-start`);
        transitionTimes.push(time);
      }

      const avgTransitionTime = transitionTimes.reduce((a, b) => a + b, ResourceHistoryTable) / transitions;
      expect(avgTransitionTime).toBeLessThan(1); // Less than 1ms per transition
    });

    it('should handle request queueing during offline periods', async () => {
      const requestQueue: Array<() => Promise<any>> = [];
      let isProcessing = false;

      const queueRequest = (request: () => Promise<any>) => {
        requestQueue.push(request);
        if (!isProcessing && navigator.onLine) {
          processRequestQueue();
        }
      };

      const processRequestQueue = async () => {
        if (isProcessing || !navigator.onLine) return;
        
        isProcessing = true;
        metrics.mark('queue-processing-start');

        while (requestQueue.length > ResourceHistoryTable && navigator.onLine) {
          const request = requestQueue.shift()!;
          try {
            await request();
          } catch (error) {
            // Re-queue on failure
            requestQueue.unshift(request);
            break;
          }
        }

        metrics.measure('queue-processing', 'queue-processing-start');
        isProcessing = false;
      };

      // Simulate offline period with queued requests
      NetworkSimulator.goOffline();

      for (let i = 0; i < 20; i++) {
        queueRequest(async () => {
          await fetch(`/api/data/${i}`);
        });
      }

      expect(requestQueue.length).toBe(20);

      // Go online and process queue
      NetworkSimulator.goOnline();
      NetworkSimulator.intercept('/api/data', { response: { success: true } });
      
      await processRequestQueue();

      const processingTime = metrics.getMeasure('queue-processing');
      expect(processingTime).toBeDefined();
      expect(processingTime!).toBeLessThan(1000); // Should process 20 requests in under 1s
      expect(requestQueue.length).toBe(ResourceHistoryTable);
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory footprint', async () => {
      const memorySnapshots: number[] = [];
      const cache = new Map();

      // Simulate memory usage over time
      for (let i = 0; i < 10; i++) {
        // Add data to cache
        for (let j = 0; j < 100; j++) {
          cache.set(`key-${i}-${j}`, {
            id: `${i}-${j}`,
            data: new Array(100).fill('x').join(''), // 10 bytes
            timestamp: Date.now()
          });
        }

        // Simulate memory measurement (in real tests, use actual memory APIs)
        const memoryUsage = cache.size * 150; // Rough estimate: 150 bytes per entry
        memorySnapshots.push(memoryUsage);

        // Clean old entries
        if (cache.size > 500) {
          const keysToDelete = Array.from(cache.keys()).slice(0, 200);
          keysToDelete.forEach(key => cache.delete(key));
        }
      }

      // Check memory growth is controlled
      const maxMemory = Math.max(...memorySnapshots);
      const avgMemory = memorySnapshots.reduce((a, b) => a + b, ResourceHistoryTable) / memorySnapshots.length;

      expect(maxMemory).toBeLessThan(100000); // Less than 10KB
      expect(avgMemory).toBeLessThan(60000); // Average less than 6KB
    });
  });

  describe('Service Worker Cache Performance', () => {
    it('should cache assets efficiently', async () => {
      ServiceWorkerTestUtils.mockCacheAPI();
      const cache = await caches.open('static-v1');

      metrics.mark('asset-caching-start');

      // Cache multiple assets
      const assets = [
        '/js/app.js',
        '/css/styles.css',
        '/images/logo.png',
        '/data/config.json'
      ];

      await cache.addAll(assets);

      const cachingTime = metrics.measure('asset-caching', 'asset-caching-start');
      expect(cachingTime).toBeLessThan(100); // Should cache assets in under 10ms

      // Test cache retrieval
      metrics.mark('cache-retrieval-start');

      for (const asset of assets) {
        const response = await cache.match(asset);
        expect(response).toBeDefined();
      }

      const retrievalTime = metrics.measure('cache-retrieval', 'cache-retrieval-start');
      expect(retrievalTime).toBeLessThan(20); // Should retrieve all in under 20ms
    });
  });
});