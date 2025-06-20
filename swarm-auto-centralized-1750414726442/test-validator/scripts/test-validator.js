#!/usr/bin/env node

/**
 * Test Validator - Comprehensive Testing System for Agent Commits
 * Monitors commits from other agents via Memory and runs tests after each feature commit
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class TestValidator {
  constructor() {
    this.config = {
      testCommands: [
        { name: 'test', command: 'npm run test', timeout: 300000 }, // 5 minutes
        { name: 'lint', command: 'npm run lint', timeout: 60000 },  // 1 minute
        { name: 'typecheck', command: 'npm run typecheck', timeout: 120000 } // 2 minutes
      ],
      memoryPath: path.join(process.cwd(), 'memory'),
      resultsPath: path.join(process.cwd(), 'swarm-auto-centralized-1750414726442/test-validator/results'),
      logsPath: path.join(process.cwd(), 'swarm-auto-centralized-1750414726442/test-validator/logs'),
      pollInterval: 10000, // 10 seconds
      lastCheckedTimestamp: null
    };
    
    this.memoryBackups = [];
    this.isRunning = false;
    this.currentTestRun = null;
  }

  /**
   * Start the test validator monitoring system
   */
  async start() {
    console.log('🚀 Starting Test Validator System...');
    this.isRunning = true;
    
    // Initialize directories
    await this.initializeDirectories();
    
    // Load last checked timestamp
    await this.loadState();
    
    // Start monitoring loop
    this.monitorLoop();
    
    console.log('✅ Test Validator System started successfully');
    console.log(`📊 Monitoring Memory at: ${this.config.memoryPath}`);
    console.log(`📁 Results stored at: ${this.config.resultsPath}`);
    console.log(`🔄 Polling every ${this.config.pollInterval / 1000} seconds`);
  }

  /**
   * Stop the test validator system
   */
  stop() {
    console.log('🛑 Stopping Test Validator System...');
    this.isRunning = false;
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    const dirs = [this.config.resultsPath, this.config.logsPath];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load previous state from disk
   */
  async loadState() {
    const statePath = path.join(this.config.resultsPath, 'validator-state.json');
    
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        this.config.lastCheckedTimestamp = state.lastCheckedTimestamp;
        console.log(`📄 Loaded previous state - Last checked: ${new Date(this.config.lastCheckedTimestamp).toISOString()}`);
      } catch (error) {
        console.warn('⚠️  Failed to load previous state:', error.message);
      }
    }
  }

  /**
   * Save current state to disk
   */
  async saveState() {
    const statePath = path.join(this.config.resultsPath, 'validator-state.json');
    const state = {
      lastCheckedTimestamp: this.config.lastCheckedTimestamp,
      lastUpdate: new Date().toISOString()
    };
    
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Main monitoring loop
   */
  async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.checkForNewCommits();
        await this.sleep(this.config.pollInterval);
      } catch (error) {
        console.error('❌ Error in monitoring loop:', error);
        await this.logError('MonitorLoop', error);
        await this.sleep(this.config.pollInterval);
      }
    }
  }

  /**
   * Check Memory for new commits from agents
   */
  async checkForNewCommits() {
    const memoryBackupsPath = path.join(this.config.memoryPath, 'backups');
    
    if (!fs.existsSync(memoryBackupsPath)) {
      return;
    }

    const backupFiles = fs.readdirSync(memoryBackupsPath)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(memoryBackupsPath, file),
        timestamp: fs.statSync(path.join(memoryBackupsPath, file)).mtime
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (backupFiles.length === 0) {
      return;
    }

    // Check most recent backup
    const latestBackup = backupFiles[0];
    
    if (!this.config.lastCheckedTimestamp || latestBackup.timestamp > new Date(this.config.lastCheckedTimestamp)) {
      console.log(`🔍 New Memory activity detected: ${latestBackup.name}`);
      
      const commits = await this.analyzeMemoryBackup(latestBackup.path);
      
      if (commits.length > 0) {
        console.log(`📝 Found ${commits.length} new commits to validate`);
        await this.runTestsForCommits(commits);
      }
      
      this.config.lastCheckedTimestamp = latestBackup.timestamp.toISOString();
      await this.saveState();
    }
  }

  /**
   * Analyze memory backup for new commits
   */
  async analyzeMemoryBackup(backupPath) {
    try {
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const commits = [];
      
      for (const entry of backup.entries || []) {
        // Look for development progress entries that indicate commits
        if (this.isCommitEntry(entry)) {
          commits.push({
            id: entry.id,
            key: entry.key,
            agent: this.extractAgentFromKey(entry.key),
            timestamp: entry.createdAt,
            description: this.extractCommitDescription(entry.value),
            value: entry.value
          });
        }
      }
      
      return commits;
    } catch (error) {
      console.error('❌ Failed to analyze memory backup:', error);
      return [];
    }
  }

  /**
   * Check if memory entry represents a commit
   */
  isCommitEntry(entry) {
    const commitIndicators = [
      'completed',
      'implementation',
      'development',
      'feature',
      'component',
      'module',
      'system',
      'workflow'
    ];
    
    const key = entry.key.toLowerCase();
    
    // Handle both string and object values
    let value = '';
    if (typeof entry.value === 'string') {
      value = entry.value.toLowerCase();
    } else if (typeof entry.value === 'object' && entry.value !== null) {
      // Convert object to string for analysis
      value = JSON.stringify(entry.value).toLowerCase();
    }
    
    return commitIndicators.some(indicator => 
      key.includes(indicator) || value.includes(indicator)
    );
  }

  /**
   * Extract agent name from memory key
   */
  extractAgentFromKey(key) {
    const parts = key.split('/');
    if (parts.length >= 3) {
      return parts[1]; // e.g., 'security' from 'swarm-development-centralized-1750377747213/security/authentication'
    }
    return 'unknown';
  }

  /**
   * Extract commit description from value
   */
  extractCommitDescription(value) {
    if (typeof value === 'string') {
      return value.substring(0, 100) + (value.length > 100 ? '...' : '');
    } else if (typeof value === 'object' && value.summary) {
      return value.summary.substring(0, 100) + (value.summary.length > 100 ? '...' : '');
    }
    return 'Agent development activity';
  }

  /**
   * Run comprehensive tests for detected commits
   */
  async runTestsForCommits(commits) {
    const testRunId = `test-run-${Date.now()}`;
    this.currentTestRun = testRunId;
    
    console.log(`🧪 Starting test run: ${testRunId}`);
    console.log(`📋 Testing ${commits.length} commits from agents: ${[...new Set(commits.map(c => c.agent))].join(', ')}`);
    
    const testResults = {
      runId: testRunId,
      timestamp: new Date().toISOString(),
      commits: commits,
      results: [],
      overallStatus: 'running',
      duration: 0,
      summary: {
        total: this.config.testCommands.length,
        passed: 0,
        failed: 0,
        errors: 0
      }
    };

    const startTime = Date.now();

    try {
      // Run each test command
      for (const testCommand of this.config.testCommands) {
        console.log(`🔄 Running ${testCommand.name}...`);
        
        const result = await this.runSingleTest(testCommand);
        testResults.results.push(result);
        
        if (result.status === 'passed') {
          testResults.summary.passed++;
          console.log(`✅ ${testCommand.name} passed`);
        } else if (result.status === 'failed') {
          testResults.summary.failed++;
          console.log(`❌ ${testCommand.name} failed`);
        } else {
          testResults.summary.errors++;
          console.log(`💥 ${testCommand.name} error`);
        }
      }

      testResults.duration = Date.now() - startTime;
      testResults.overallStatus = testResults.summary.failed === 0 && testResults.summary.errors === 0 ? 'passed' : 'failed';

      // Save results
      await this.saveTestResults(testResults);

      // Send notifications if tests failed
      if (testResults.overallStatus === 'failed') {
        await this.notifyAgentsOfFailures(testResults, commits);
      }

      console.log(`🏁 Test run completed: ${testResults.overallStatus.toUpperCase()}`);
      console.log(`📊 Results: ${testResults.summary.passed} passed, ${testResults.summary.failed} failed, ${testResults.summary.errors} errors`);
      console.log(`⏱️  Duration: ${Math.round(testResults.duration / 1000)}s`);

    } catch (error) {
      testResults.overallStatus = 'error';
      testResults.duration = Date.now() - startTime;
      await this.logError('TestExecution', error);
      await this.saveTestResults(testResults);
      
      console.error('💥 Test run failed with error:', error.message);
    }

    this.currentTestRun = null;
  }

  /**
   * Run a single test command
   */
  async runSingleTest(testCommand) {
    const result = {
      name: testCommand.name,
      command: testCommand.command,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      status: 'running',
      output: '',
      error: null,
      exitCode: null
    };

    const testStartTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(testCommand.command, {
        cwd: process.cwd(),
        timeout: testCommand.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      result.output = stdout + stderr;
      result.status = 'passed';
      result.exitCode = 0;

    } catch (error) {
      result.error = error.message;
      result.output = error.stdout + error.stderr;
      result.exitCode = error.code;
      
      if (error.killed && error.signal === 'SIGTERM') {
        result.status = 'timeout';
      } else {
        result.status = 'failed';
      }
    }

    result.duration = Date.now() - testStartTime;
    result.endTime = new Date().toISOString();

    return result;
  }

  /**
   * Save test results to disk
   */
  async saveTestResults(testResults) {
    const resultsFile = path.join(this.config.resultsPath, `${testResults.runId}.json`);
    const summaryFile = path.join(this.config.resultsPath, 'latest-results.json');
    
    // Save detailed results
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    
    // Update latest results summary
    const summary = {
      lastRun: testResults.runId,
      timestamp: testResults.timestamp,
      status: testResults.overallStatus,
      summary: testResults.summary,
      duration: testResults.duration,
      commits: testResults.commits.length,
      agents: [...new Set(testResults.commits.map(c => c.agent))]
    };
    
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    console.log(`💾 Test results saved: ${resultsFile}`);
  }

  /**
   * Notify agents of test failures
   */
  async notifyAgentsOfFailures(testResults, commits) {
    console.log('📢 Notifying agents of test failures...');
    
    const failedTests = testResults.results.filter(r => r.status === 'failed' || r.status === 'error');
    const affectedAgents = [...new Set(commits.map(c => c.agent))];
    
    const notification = {
      type: 'test_failure_alert',
      timestamp: new Date().toISOString(),
      testRunId: testResults.runId,
      affectedAgents: affectedAgents,
      failedTests: failedTests.map(t => ({
        name: t.name,
        status: t.status,
        error: t.error,
        command: t.command
      })),
      summary: testResults.summary,
      message: `Test validation failed for commits from agents: ${affectedAgents.join(', ')}. ${failedTests.length} test(s) failed.`,
      actionRequired: 'Please review and fix the failing tests before proceeding with development.',
      resultsPath: path.join(this.config.resultsPath, `${testResults.runId}.json`)
    };

    // Save notification to memory for agents to see
    const notificationPath = path.join(this.config.resultsPath, `notification-${testResults.runId}.json`);
    fs.writeFileSync(notificationPath, JSON.stringify(notification, null, 2));
    
    // Also create a general alert file
    const alertPath = path.join(this.config.resultsPath, 'current-alert.json');
    fs.writeFileSync(alertPath, JSON.stringify(notification, null, 2));
    
    console.log(`🚨 Alert created for agents: ${affectedAgents.join(', ')}`);
    console.log(`📁 Notification saved: ${notificationPath}`);
  }

  /**
   * Log errors
   */
  async logError(context, error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context: context,
      message: error.message,
      stack: error.stack,
      currentTestRun: this.currentTestRun
    };
    
    const logFile = path.join(this.config.logsPath, `error-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTestRun: this.currentTestRun,
      lastCheckedTimestamp: this.config.lastCheckedTimestamp,
      config: {
        pollInterval: this.config.pollInterval,
        testCommands: this.config.testCommands.map(tc => tc.name),
        resultsPath: this.config.resultsPath
      }
    };
  }
}

// CLI Interface
if (require.main === module) {
  const validator = new TestValidator();
  
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    validator.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    validator.stop();
    process.exit(0);
  });
  
  validator.start().catch(error => {
    console.error('💥 Failed to start Test Validator:', error);
    process.exit(1);
  });
}

module.exports = TestValidator;