# OmniCare Test Validator System

A comprehensive automated testing system that monitors commits from other agents and runs tests after each feature commit to ensure code remains in a working state.

## Overview

The Test Validator System provides continuous integration capabilities by:
- Monitoring Memory for commits from development agents
- Automatically running comprehensive tests (`npm run test`, `npm run lint`, `npm run typecheck`)
- Storing detailed test results with historical tracking
- Alerting responsible agents when tests fail
- Maintaining code quality and system stability

## Architecture

```
swarm-auto-centralized-1750414726442/test-validator/
├── scripts/
│   ├── test-validator.js       # Main monitoring and testing engine
│   ├── start-validator.sh      # Startup script
│   ├── stop-validator.sh       # Shutdown script
│   └── status-validator.sh     # Status and monitoring script
├── config/
│   └── validator-config.json   # Configuration settings
├── results/                    # Test results storage
│   ├── test-run-*.json        # Detailed test results
│   ├── latest-results.json    # Latest test summary
│   ├── current-alert.json     # Active alerts
│   └── validator-state.json   # System state
└── logs/                      # System logs
    ├── validator.log          # Main system log
    └── error-*.log           # Daily error logs
```

## Features

### 🔍 Commit Monitoring
- Continuously monitors the `memory/` directory for new agent commits
- Detects development activities through Memory backup analysis
- Identifies commits from specific agents (security, admin, architect, etc.)
- Tracks timestamp-based changes to avoid duplicate processing

### 🧪 Comprehensive Testing
- **Unit Tests**: `npm run test` - Jest test suite execution
- **Code Quality**: `npm run lint` - ESLint code quality checks  
- **Type Safety**: `npm run typecheck` - TypeScript type validation
- Configurable timeouts for each test type
- Detailed output capture and error reporting

### 📊 Results Management
- Structured JSON storage of all test results
- Historical tracking of test runs and trends
- Summary statistics (passed/failed/errors)
- Agent-specific result correlation
- Performance metrics and duration tracking

### 🚨 Alert System
- Automatic agent notification on test failures
- Detailed failure analysis and remediation guidance
- Current alert status tracking
- Memory-based notification system for agent communication

### 📈 Monitoring & Reporting
- Real-time status monitoring
- Process health checks
- Log file management with rotation
- Performance metrics collection

## Quick Start

### Start the Test Validator
```bash
cd swarm-auto-centralized-1750414726442/test-validator/scripts
./start-validator.sh
```

### Check Status
```bash
./status-validator.sh
```

### Stop the Validator
```bash
./stop-validator.sh
```

### View Live Logs
```bash
tail -f ../logs/validator.log
```

## Configuration

The system is configured through `config/validator-config.json`:

```json
{
  "monitoring": {
    "pollInterval": 10000,           // Check every 10 seconds
    "memoryPath": "memory",          // Memory directory to monitor
    "watchForPatterns": [            // Commit detection patterns
      "completed", "implementation", "development", "feature"
    ]
  },
  "testing": {
    "commands": [                    // Test commands to execute
      { "name": "test", "command": "npm run test", "timeout": 300000 },
      { "name": "lint", "command": "npm run lint", "timeout": 60000 },
      { "name": "typecheck", "command": "npm run typecheck", "timeout": 120000 }
    ]
  }
}
```

## Test Result Structure

Each test run generates a comprehensive result file:

```json
{
  "runId": "test-run-1640995200000",
  "timestamp": "2021-12-31T12:00:00.000Z",
  "commits": [                       // Commits that triggered this test
    {
      "agent": "security",
      "description": "Authentication implementation completed",
      "timestamp": "2021-12-31T11:58:00.000Z"
    }
  ],
  "results": [                       // Individual test results
    {
      "name": "test",
      "status": "passed",
      "duration": 45000,
      "output": "All tests passed successfully",
      "exitCode": 0
    }
  ],
  "overallStatus": "passed",
  "summary": {
    "total": 3,
    "passed": 3,
    "failed": 0,
    "errors": 0
  }
}
```

## Agent Notification System

When tests fail, the system creates alerts in multiple formats:

1. **Current Alert** (`current-alert.json`): Active alert status
2. **Notification Files** (`notification-*.json`): Detailed failure information
3. **Memory Integration**: Notifications stored for agent access

Alert structure:
```json
{
  "type": "test_failure_alert",
  "affectedAgents": ["security", "admin"],
  "failedTests": [
    {
      "name": "lint",
      "status": "failed",
      "error": "ESLint errors found",
      "command": "npm run lint"
    }
  ],
  "message": "Test validation failed for commits from agents: security, admin",
  "actionRequired": "Please review and fix the failing tests before proceeding"
}
```

## Monitoring and Maintenance

### Health Checks
- Process monitoring with PID file management
- Automatic restart capability
- Graceful shutdown handling
- Error recovery and logging

### Log Management
- Structured logging with timestamps
- Daily error log rotation
- Performance metrics tracking
- Debug information capture

### Performance Optimization
- Efficient Memory polling
- Configurable polling intervals
- Result caching and compression
- Memory usage optimization

## Integration with Development Workflow

### Agent Development Cycle
1. **Agent commits changes** → Memory entry created
2. **Test Validator detects** → Commit analysis performed
3. **Tests executed** → Comprehensive test suite runs
4. **Results processed** → Success/failure determination
5. **Agents notified** → Alerts sent if issues found
6. **Remediation cycle** → Agents fix issues and recommit

### Continuous Integration Benefits
- Early detection of integration issues
- Automated quality assurance
- Consistent testing across all agent contributions
- Historical tracking of code quality trends
- Reduced manual testing overhead

## Troubleshooting

### Common Issues

**Validator won't start**
- Check Node.js and npm are installed
- Verify npm scripts exist in package.json
- Check file permissions on scripts

**Tests not running**
- Verify test commands work manually
- Check timeout settings for large test suites
- Review log files for specific errors

**Memory monitoring not working**
- Confirm memory/ directory exists and is accessible
- Check polling interval settings
- Verify backup file format and structure

### Log Analysis
```bash
# View recent activity
tail -f logs/validator.log

# Check for errors
grep -i error logs/validator.log

# Monitor test execution
grep -i "test run" logs/validator.log
```

## Security Considerations

- **Output Sanitization**: Test outputs are sanitized to prevent log injection
- **File Permission Management**: Secure file access controls
- **Process Isolation**: Validator runs in isolated process space
- **Audit Logging**: Comprehensive activity logging for compliance

## Performance Metrics

The system tracks key performance indicators:
- **Test Execution Time**: Duration of each test command
- **Detection Latency**: Time from commit to test initiation
- **System Resource Usage**: CPU and memory consumption
- **Success Rate**: Historical test pass/fail rates
- **Agent Response Time**: Time to issue resolution

## Future Enhancements

- [ ] Parallel test execution for faster results
- [ ] Integration with external CI/CD systems
- [ ] Advanced agent notification methods (email, webhooks)
- [ ] Test result analytics and trending
- [ ] Automated fix suggestions for common issues
- [ ] Performance benchmarking and regression detection

---

**Status**: Active and Monitoring
**Version**: 1.0.0
**Last Updated**: 2025-06-20