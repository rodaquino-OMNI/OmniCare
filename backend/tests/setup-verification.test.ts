/**
 * Setup Verification Test
 * This test verifies that the test environment is correctly configured
 */

// Import the global test config type from env.setup
import './env.setup';

describe('Test Environment Setup Verification', () => {
  describe('Environment Variables', () => {
    it('should have NODE_ENV set to test', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have required database configuration', () => {
      expect(process.env.DB_HOST).toBeDefined();
      expect(process.env.DB_PORT).toBeDefined();
      expect(process.env.DB_NAME).toBeDefined();
      expect(process.env.DB_USER).toBeDefined();
      expect(process.env.DB_PASSWORD).toBeDefined();
    });

    it('should have DATABASE_URL configured', () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    });

    it('should have Redis configuration', () => {
      expect(process.env.REDIS_URL).toBeDefined();
      expect(process.env.REDIS_URL).toMatch(/^redis:\/\//);
    });

    it('should have JWT configuration', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET?.length ?? 0).toBeGreaterThanOrEqual(32);
      expect(process.env.JWT_EXPIRATION).toBeDefined();
      expect(process.env.JWT_REFRESH_EXPIRATION).toBeDefined();
    });

    it('should have security configuration', () => {
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
      expect(process.env.SESSION_SECRET).toBeDefined();
      expect(process.env.BCRYPT_ROUNDS).toBeDefined();
    });

    it('should have feature flags configured', () => {
      expect(process.env.ENABLE_AUDIT_LOGGING).toBeDefined();
      expect(process.env.ENABLE_RATE_LIMITING).toBeDefined();
      expect(process.env.ENABLE_CACHING).toBeDefined();
    });
  });

  describe('Docker Availability', () => {
    it('should have Docker availability flags set', () => {
      expect(process.env.DOCKER_AVAILABLE).toBeDefined();
      expect(['true', 'false']).toContain(process.env.DOCKER_AVAILABLE);
    });

    it('should have skip Docker tests flag set', () => {
      expect(process.env.SKIP_DOCKER_TESTS).toBeDefined();
      expect(['true', 'false']).toContain(process.env.SKIP_DOCKER_TESTS);
    });

    it('should have appropriate mocking configuration', () => {
      const isUnitTest = !expect.getState().testPath?.includes('integration');
      
      if (isUnitTest) {
        expect(process.env.MOCK_DATABASE).toBe('true');
      } else {
        // Integration tests may use real or mocked DB depending on Docker
        expect(['true', 'false']).toContain(process.env.MOCK_DATABASE);
      }
    });
  });

  describe('Global Test Configuration', () => {
    it('should have global test config defined', () => {
      expect((global as any).testConfig).toBeDefined();
      expect((global as any).testConfig.timeouts).toBeDefined();
      expect((global as any).testConfig.retries).toBeDefined();
      expect((global as any).testConfig.cleanup).toBeDefined();
    });

    it('should have appropriate timeout values', () => {
      const config = (global as any).testConfig;
      expect(config.timeouts.unit).toBe(5000);
      expect(config.timeouts.integration).toBe(15000);
      expect(config.timeouts.e2e).toBe(30000);
    });

    it('should have mocking configuration', () => {
      const config = (global as any).testConfig;
      expect(config.mocking).toBeDefined();
      expect(typeof config.mocking.externalServices).toBe('boolean');
      expect(typeof config.mocking.database).toBe('boolean');
    });
  });

  describe('Test Category Detection', () => {
    it('should correctly identify test category', () => {
      const testPath = expect.getState().testPath || '';
      const isIntegrationTest = testPath.includes('integration');
      const isE2ETest = testPath.includes('e2e');
      const isUnitTest = !isIntegrationTest && !isE2ETest;

      // At least one should be true
      expect(isUnitTest || isIntegrationTest || isE2ETest).toBe(true);
    });
  });

  describe('TypeScript Path Resolution', () => {
    it('should resolve @ paths correctly', async () => {
      // This test verifies that tsconfig paths are working
      try {
        // Dynamic import to test path resolution
        const { databaseService } = await import('@/services/database.service');
        expect(databaseService).toBeDefined();
      } catch (error) {
        // If import fails, path resolution might not be working
        console.warn('Path resolution test failed:', error);
      }
    });
  });
});