/**
 * Global Test Setup for Frontend
 * Runs once before all tests start
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

module.exports = async function globalSetup() {
  console.log('🚀 Starting frontend test environment setup...');

  try {
    // Setup test server if needed for integration tests
    await setupTestServer();

    // Initialize test databases (IndexedDB, localStorage)
    await setupTestDatabases();

    // Setup mock services
    await setupMockServices();

    // Setup test data
    await setupTestData();

    console.log('✅ Frontend test environment setup completed successfully');
  } catch (error) {
    console.error('❌ Failed to setup frontend test environment:', error);
    process.exit(1);
  }
};

async function setupTestServer() {
  if (process.env.SKIP_TEST_SERVER === 'true') {
    console.log('🌐 Skipping test server setup (SKIP_TEST_SERVER=true)');
    return;
  }

  try {
    console.log('🌐 Setting up test server...');

    // Only setup server for integration tests
    if (process.env.TEST_TYPE === 'integration') {
      const dev = process.env.NODE_ENV !== 'production';
      const app = next({ dev, dir: __dirname });
      const handle = app.getRequestHandler();

      await app.prepare();

      const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
      });

      const port = process.env.TEST_PORT || 3333;
      
      await new Promise((resolve, reject) => {
        server.listen(port, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ Test server running on http://localhost:${port}`);
            global.__TEST_SERVER__ = server;
            resolve();
          }
        });
      });
    }

    console.log('✅ Test server setup completed');
  } catch (error) {
    console.warn('⚠️ Failed to setup test server (continuing without server):', error);
  }
}

async function setupTestDatabases() {
  try {
    console.log('💾 Setting up test databases...');

    // Setup IndexedDB for offline functionality tests
    const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
    const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;

    // Clear localStorage and sessionStorage
    if (typeof Storage !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }

    // Initialize test IndexedDB databases
    const testDatabases = [
      'omnicare-patients',
      'omnicare-encounters',
      'omnicare-cache',
      'omnicare-sync'
    ];

    for (const dbName of testDatabases) {
      try {
        const request = indexedDB.open(dbName, 1);
        
        await new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create basic object stores for testing
            if (!db.objectStoreNames.contains('data')) {
              db.createObjectStore('data', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('cache')) {
              db.createObjectStore('cache', { keyPath: 'key' });
            }
          };
        });

        console.log(`📊 Test database '${dbName}' initialized`);
      } catch (error) {
        console.warn(`⚠️ Failed to initialize test database '${dbName}':`, error);
      }
    }

    console.log('✅ Test databases setup completed');
  } catch (error) {
    console.error('❌ Failed to setup test databases:', error);
    throw error;
  }
}

async function setupMockServices() {
  try {
    console.log('🎭 Setting up mock services...');

    // Setup API mock server
    const mockApiConfig = {
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api',
      endpoints: {
        auth: '/auth',
        patients: '/patients',
        encounters: '/encounters',
        observations: '/observations',
        practitioners: '/practitioners',
      },
      responses: {
        login: {
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          user: {
            id: 'test-user-1',
            email: 'test@omnicare.com',
            role: 'physician',
            permissions: ['read:patients', 'write:patients'],
          },
        },
        patients: [
          {
            id: 'test-patient-1',
            name: 'John Doe',
            mrn: 'MRN001',
            birthDate: '1990-01-01',
          },
          {
            id: 'test-patient-2',
            name: 'Jane Smith',
            mrn: 'MRN002',
            birthDate: '1985-05-15',
          },
        ],
      },
    };

    global.__MOCK_API_CONFIG__ = mockApiConfig;

    // Setup FHIR mock server
    const mockFhirConfig = {
      baseUrl: process.env.NEXT_PUBLIC_FHIR_BASE_URL || 'http://localhost:8080/fhir/R4',
      capabilities: {
        fhirVersion: '4.0.1',
        acceptUnknown: 'no',
        format: ['json', 'xml'],
      },
    };

    global.__MOCK_FHIR_CONFIG__ = mockFhirConfig;

    console.log('✅ Mock services setup completed');
  } catch (error) {
    console.error('❌ Failed to setup mock services:', error);
    throw error;
  }
}

async function setupTestData() {
  try {
    console.log('📝 Setting up test data...');

    // Create test users
    const testUsers = [
      {
        id: 'test-doctor-1',
        email: 'doctor@test.com',
        role: 'physician',
        name: 'Dr. Test Doctor',
        active: true,
      },
      {
        id: 'test-nurse-1',
        email: 'nurse@test.com',
        role: 'nurse',
        name: 'Test Nurse',
        active: true,
      },
      {
        id: 'test-admin-1',
        email: 'admin@test.com',
        role: 'admin',
        name: 'Test Admin',
        active: true,
      },
    ];

    // Create test patients
    const testPatients = [
      {
        id: 'test-patient-1',
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }],
        gender: 'male',
        birthDate: '1990-01-01',
        mrn: 'MRN001',
        active: true,
      },
      {
        id: 'test-patient-2',
        resourceType: 'Patient',
        name: [{ given: ['Jane'], family: 'Smith' }],
        gender: 'female',
        birthDate: '1985-05-15',
        mrn: 'MRN002',
        active: true,
      },
    ];

    // Create test encounters
    const testEncounters = [
      {
        id: 'test-encounter-1',
        resourceType: 'Encounter',
        status: 'in-progress',
        subject: { reference: 'Patient/test-patient-1' },
        participant: [{ individual: { reference: 'Practitioner/test-doctor-1' } }],
      },
    ];

    // Store test data globally
    global.__TEST_DATA__ = {
      users: testUsers,
      patients: testPatients,
      encounters: testEncounters,
    };

    // Initialize localStorage with some test data
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('test-setup-complete', 'true');
      localStorage.setItem('test-timestamp', new Date().toISOString());
    }

    console.log('✅ Test data setup completed');
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
    throw error;
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, cleaning up frontend test environment...');
  
  if (global.__TEST_SERVER__) {
    await new Promise((resolve) => {
      global.__TEST_SERVER__.close(resolve);
    });
  }
  
  process.exit(0);
});