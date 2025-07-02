/**
 * OmniCare EMR Backend - Load Testing Configuration
 * Comprehensive performance testing for production readiness
 */

module.exports = {
  target: process.env.LOAD_TEST_TARGET || 'http://localhost:8080',
  phases: [
    // Warm-up phase
    {
      duration: '30s',
      arrivalRate: 1,
      name: 'warmup'
    },
    // Ramp-up phase
    {
      duration: '2m',
      arrivalRate: 5,
      rampTo: 20,
      name: 'rampup'
    },
    // Sustained load phase
    {
      duration: '5m',
      arrivalRate: 20,
      name: 'sustained'
    },
    // Peak load phase
    {
      duration: '2m',
      arrivalRate: 20,
      rampTo: 50,
      name: 'peak'
    },
    // Cool-down phase
    {
      duration: '1m',
      arrivalRate: 50,
      rampTo: 1,
      name: 'cooldown'
    }
  ],
  payload: {
    path: './test-data.csv',
    fields: ['patientId', 'encounterId', 'practitionerId']
  },
  variables: {
    jwtToken: process.env.LOAD_TEST_JWT || 'Bearer test-token'
  },
  plugins: {
    'expect': {},
    'metrics-by-endpoint': {
      'useOnlyRequestNames': true
    }
  },
  http: {
    timeout: 30000,
    pool: 10
  },
  scenarios: [
    {
      name: 'FHIR Patient Operations',
      weight: 40,
      flow: [
        {
          get: {
            url: '/fhir/R4/Patient',
            headers: {
              'Authorization': '{{ jwtToken }}',
              'Accept': 'application/fhir+json'
            },
            capture: {
              json: '$.entry[0].resource.id',
              as: 'patientId'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'resourceType' },
              { hasProperty: 'entry' }
            ]
          }
        },
        {
          get: {
            url: '/fhir/R4/Patient/{{ patientId }}',
            headers: {
              'Authorization': '{{ jwtToken }}',
              'Accept': 'application/fhir+json'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'resourceType' },
              { contentType: 'application/fhir+json' }
            ]
          }
        },
        {
          get: {
            url: '/fhir/R4/Patient/{{ patientId }}/$everything',
            headers: {
              'Authorization': '{{ jwtToken }}',
              'Accept': 'application/fhir+json'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'resourceType' }
            ]
          }
        }
      ]
    },
    {
      name: 'FHIR Observation Search',
      weight: 30,
      flow: [
        {
          get: {
            url: '/fhir/R4/Observation?patient={{ patientId }}&category=vital-signs',
            headers: {
              'Authorization': '{{ jwtToken }}',
              'Accept': 'application/fhir+json'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'resourceType' }
            ]
          }
        }
      ]
    },
    {
      name: 'Performance Monitoring',
      weight: 20,
      flow: [
        {
          get: {
            url: '/api/performance/health',
            expect: [
              { statusCode: 200 },
              { hasProperty: 'status' }
            ]
          }
        },
        {
          get: {
            url: '/api/performance/metrics',
            expect: [
              { statusCode: 200 },
              { hasProperty: 'metrics' }
            ]
          }
        }
      ]
    },
    {
      name: 'Cache Performance Test',
      weight: 10,
      flow: [
        {
          get: {
            url: '/fhir/R4/metadata',
            headers: {
              'Accept': 'application/fhir+json'
            },
            expect: [
              { statusCode: 200 },
              { hasProperty: 'resourceType' }
            ]
          }
        },
        {
          get: {
            url: '/fhir/R4/metadata',
            headers: {
              'Accept': 'application/fhir+json'
            },
            expect: [
              { statusCode: 200 },
              { hasHeader: 'x-cache' }
            ]
          }
        }
      ]
    }
  ],
  
  // Performance thresholds
  ensure: {
    'http.response_time.p95': 200, // 95th percentile should be under 200ms
    'http.response_time.p99': 500, // 99th percentile should be under 500ms
    'http.request_rate': { min: 100 }, // At least 100 requests per second
    'http.codes.200': { count: { min: 95 } }, // At least 95% success rate
    'vusers.failed': { count: { max: 5 } } // No more than 5% failed virtual users
  }
};
