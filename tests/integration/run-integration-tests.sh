#!/bin/bash

# OmniCare EMR Integration Test Runner
# This script runs all integration tests and generates comprehensive reports

set -e

echo "======================================"
echo "OmniCare EMR Integration Test Suite"
echo "======================================"
echo ""

# Set environment
export NODE_ENV=test
export TEST_ENV=integration

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create necessary directories
mkdir -p test-results/integration
mkdir -p coverage/integration
mkdir -p logs/integration

# Function to run tests with proper error handling
run_test_suite() {
    local test_name=$1
    local test_file=$2
    
    echo -e "${YELLOW}Running $test_name...${NC}"
    
    if npm test -- "$test_file" --coverage --json --outputFile="test-results/integration/${test_name}-results.json" 2>&1 | tee "logs/integration/${test_name}.log"; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        return 1
    fi
}

# Start services if needed
echo "Starting test services..."
docker-compose -f devops/docker/docker-compose.test.yml up -d postgres redis

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Run database migrations
echo "Running database migrations..."
npm run db:migrate:test

# Clear previous test results
rm -rf test-results/integration/*
rm -rf coverage/integration/*

# Run integration test suites
echo ""
echo "Running Integration Test Suites..."
echo "================================="

# Track overall test status
TESTS_PASSED=0
TESTS_FAILED=0

# Full System Integration Tests
if run_test_suite "full-system-integration" "tests/integration/full-system-integration.test.ts"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Performance Benchmark Tests
if run_test_suite "performance-benchmark" "tests/integration/performance-benchmark.test.ts"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# FHIR Compliance Tests
if run_test_suite "fhir-compliance" "tests/integration/fhir-compliance.test.ts"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Generate consolidated test report
echo ""
echo "Generating Test Reports..."
echo "========================="

# Create summary report
cat > test-results/integration/summary.json <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "integration",
  "summary": {
    "total": $((TESTS_PASSED + TESTS_FAILED)),
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "success_rate": $(echo "scale=2; $TESTS_PASSED * 100 / ($TESTS_PASSED + $TESTS_FAILED)" | bc)
  },
  "test_suites": [
    {
      "name": "Full System Integration",
      "status": $([ -f "test-results/integration/full-system-integration-results.json" ] && echo '"passed"' || echo '"failed"')
    },
    {
      "name": "Performance Benchmark",
      "status": $([ -f "test-results/integration/performance-benchmark-results.json" ] && echo '"passed"' || echo '"failed"')
    },
    {
      "name": "FHIR Compliance",
      "status": $([ -f "test-results/integration/fhir-compliance-results.json" ] && echo '"passed"' || echo '"failed"')
    }
  ]
}
EOF

# Generate HTML report
npm run test:report:integration

# Generate coverage report
npm run coverage:report

# Check for performance regressions
if [ -f "test-results/integration/performance-report.json" ]; then
    echo ""
    echo "Checking Performance Metrics..."
    echo "=============================="
    
    node -e "
    const report = require('./test-results/integration/performance-report.json');
    const metrics = report.details;
    
    console.log('Average Response Times:');
    metrics.forEach(m => {
        const status = m.p95 < 200 ? '✓' : '✗';
        console.log(\`  \${status} \${m.operation}: \${m.avgResponseTime.toFixed(2)}ms (p95: \${m.p95.toFixed(2)}ms)\`);
    });
    
    console.log('\\nThroughput:');
    metrics.forEach(m => {
        const status = m.throughput > 100 ? '✓' : '✗';
        console.log(\`  \${status} \${m.operation}: \${m.throughput.toFixed(2)} req/s\`);
    });
    "
fi

# Check FHIR compliance
if [ -f "test-results/integration/fhir-compliance-report.json" ]; then
    echo ""
    echo "FHIR Compliance Status..."
    echo "========================"
    
    node -e "
    const report = require('./test-results/integration/fhir-compliance-report.json');
    const compliance = report.compliance;
    
    console.log('Core Compliance:');
    console.log(\`  ✓ RESTful API: \${compliance.core.restfulApi}\`);
    console.log(\`  ✓ Resource Types: \${compliance.core.resourceTypes.length} supported\`);
    console.log(\`  ✓ Search Parameters: \${compliance.core.searchParameters}\`);
    
    console.log('\\nAdvanced Features:');
    Object.entries(compliance.advanced).forEach(([key, value]) => {
        console.log(\`  \${value ? '✓' : '✗'} \${key}: \${value}\`);
    });
    "
fi

# Stop test services
echo ""
echo "Stopping test services..."
docker-compose -f devops/docker/docker-compose.test.yml down

# Final summary
echo ""
echo "======================================"
echo "Integration Test Summary"
echo "======================================"
echo -e "Total Test Suites: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All integration tests passed!${NC}"
    echo ""
    echo "Reports generated:"
    echo "  - Test Results: test-results/integration/"
    echo "  - Coverage Report: coverage/integration/index.html"
    echo "  - Performance Report: test-results/integration/performance-report.json"
    echo "  - FHIR Compliance Report: test-results/integration/fhir-compliance-report.json"
    exit 0
else
    echo -e "${RED}Some integration tests failed. Check the logs for details.${NC}"
    echo ""
    echo "Failed test logs:"
    ls -la logs/integration/*.log 2>/dev/null || echo "No log files found"
    exit 1
fi