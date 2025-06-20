#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyChecker {
  constructor() {
    this.mapPath = path.join(__dirname, 'map');
    this.dependencyData = null;
    this.loadDependencyMap();
  }

  loadDependencyMap() {
    try {
      const mapContent = fs.readFileSync(this.mapPath, 'utf8');
      this.dependencyData = JSON.parse(mapContent);
    } catch (error) {
      console.error('Error loading dependency map:', error.message);
      process.exit(1);
    }
  }

  checkFileGroup(filePath) {
    for (const group of this.dependencyData.commitGroups) {
      if (group.files.includes(filePath)) {
        return group;
      }
    }
    return null;
  }

  getCommittedFiles() {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      return output.split('\n').filter(line => line.trim());
    } catch (error) {
      console.warn('Could not get staged files:', error.message);
      return [];
    }
  }

  getUncommittedFiles() {
    try {
      const output = execSync('git status --porcelain', { encoding: 'utf8' });
      return output.split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3).trim())
        .filter(file => !file.includes('node_modules'));
    } catch (error) {
      console.warn('Could not get uncommitted files:', error.message);
      return [];
    }
  }

  checkDependencies(filesToCommit) {
    const issues = [];
    const warnings = [];
    
    // Group files by their commit groups
    const fileGroups = new Map();
    
    filesToCommit.forEach(file => {
      const group = this.checkFileGroup(file);
      if (group) {
        if (!fileGroups.has(group.id)) {
          fileGroups.set(group.id, { group, files: [] });
        }
        fileGroups.get(group.id).files.push(file);
      }
    });

    // Check if dependencies are satisfied
    for (const [groupId, { group, files }] of fileGroups) {
      if (group.dependsOn) {
        for (const dependency of group.dependsOn) {
          // Check if dependency group files are already committed
          const depGroup = this.dependencyData.commitGroups.find(g => g.id === dependency);
          if (depGroup) {
            const uncommittedDepFiles = depGroup.files.filter(file => {
              try {
                execSync(`git diff --name-only HEAD -- "${file}"`, { encoding: 'utf8' });
                return true; // File has uncommitted changes
              } catch {
                return false; // File is committed or doesn't exist
              }
            });

            if (uncommittedDepFiles.length > 0) {
              issues.push({
                type: 'dependency',
                group: groupId,
                issue: `Group "${groupId}" depends on "${dependency}" but the following files are not committed:`,
                files: uncommittedDepFiles.slice(0, 5), // Show first 5
                totalCount: uncommittedDepFiles.length
              });
            }
          }
        }
      }

      // Check for must-commit-first groups
      if (group.mustCommitFirst) {
        const otherGroups = Array.from(fileGroups.keys()).filter(id => id !== groupId);
        if (otherGroups.length > 0) {
          warnings.push({
            type: 'order',
            group: groupId,
            issue: `Group "${groupId}" should be committed first, but you're also committing files from other groups`,
            otherGroups
          });
        }
      }

      // Check for commit-last groups
      if (group.commitLast) {
        const earlierGroups = Array.from(fileGroups.keys()).filter(id => {
          const otherGroup = this.dependencyData.commitGroups.find(g => g.id === id);
          return otherGroup && otherGroup.priority < group.priority;
        });
        
        if (earlierGroups.length > 0) {
          warnings.push({
            type: 'order',
            group: groupId,
            issue: `Group "${groupId}" should be committed last, but you're committing it with earlier groups`,
            earlierGroups
          });
        }
      }
    }

    return { issues, warnings, fileGroups };
  }

  run(args) {
    const command = args[0] || 'check';

    switch (command) {
      case 'check':
        return this.checkCurrentCommit();
      case 'group':
        return this.showFileGroup(args[1]);
      case 'status':
        return this.showOverallStatus();
      case 'help':
        return this.showHelp();
      default:
        console.log('Unknown command. Use --help for usage information.');
        return false;
    }
  }

  checkCurrentCommit() {
    const stagedFiles = this.getCommittedFiles();
    
    if (stagedFiles.length === 0) {
      console.log('No files staged for commit.');
      return true;
    }

    console.log(`\n🔍 Checking dependencies for ${stagedFiles.length} staged files...\n`);

    const { issues, warnings, fileGroups } = this.checkDependencies(stagedFiles);

    // Show commit groups being committed
    console.log('📋 Commit Groups in this commit:');
    for (const [groupId, { group, files }] of fileGroups) {
      console.log(`  • ${groupId} (${files.length} files) - Priority ${group.priority}`);
      if (group.dependsOn) {
        console.log(`    Depends on: ${group.dependsOn.join(', ')}`);
      }
    }
    console.log('');

    // Show issues
    if (issues.length > 0) {
      console.log('❌ BLOCKING ISSUES:');
      issues.forEach(issue => {
        console.log(`  • ${issue.issue}`);
        if (issue.files) {
          issue.files.forEach(file => console.log(`    - ${file}`));
          if (issue.totalCount > issue.files.length) {
            console.log(`    ... and ${issue.totalCount - issue.files.length} more files`);
          }
        }
      });
      console.log('\n🛑 Please resolve these issues before committing.\n');
      return false;
    }

    // Show warnings
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      warnings.forEach(warning => {
        console.log(`  • ${warning.issue}`);
        if (warning.otherGroups) {
          console.log(`    Other groups: ${warning.otherGroups.join(', ')}`);
        }
        if (warning.earlierGroups) {
          console.log(`    Earlier groups: ${warning.earlierGroups.join(', ')}`);
        }
      });
      console.log('');
    }

    console.log('✅ Dependency check passed!');
    console.log('💡 Remember to run: npm run typecheck && npm run build');
    return true;
  }

  showFileGroup(filePath) {
    if (!filePath) {
      console.log('Please provide a file path. Example: node check-dependencies.js group src/services/auth.service.ts');
      return false;
    }

    const group = this.checkFileGroup(filePath);
    if (group) {
      console.log(`\n📁 File: ${filePath}`);
      console.log(`📋 Group: ${group.id} (Priority ${group.priority})`);
      console.log(`📝 Description: ${group.description}`);
      console.log(`📊 Files in group: ${group.files.length}`);
      
      if (group.dependsOn) {
        console.log(`🔗 Depends on: ${group.dependsOn.join(', ')}`);
      }
      
      if (group.mustCommitFirst) {
        console.log('🚨 Must commit first!');
      }
      
      if (group.commitLast) {
        console.log('⏰ Should commit last!');
      }

      if (group.note) {
        console.log(`📄 Note: ${group.note}`);
      }
    } else {
      console.log(`File ${filePath} not found in dependency map.`);
    }
    
    return true;
  }

  showOverallStatus() {
    console.log('\n📊 Overall Dependency Status\n');
    
    const uncommittedFiles = this.getUncommittedFiles();
    console.log(`Total uncommitted files: ${uncommittedFiles.length}`);
    
    // Group uncommitted files by commit groups
    const groupStatus = new Map();
    
    this.dependencyData.commitGroups.forEach(group => {
      const groupUncommitted = group.files.filter(file => uncommittedFiles.includes(file));
      if (groupUncommitted.length > 0) {
        groupStatus.set(group.id, {
          group,
          uncommittedCount: groupUncommitted.length,
          totalCount: group.files.length,
          readyToCommit: this.isGroupReadyToCommit(group)
        });
      }
    });

    console.log('\n📋 Groups with uncommitted changes:');
    for (const [groupId, status] of groupStatus) {
      const readyIcon = status.readyToCommit ? '✅' : '⏳';
      console.log(`  ${readyIcon} ${groupId}: ${status.uncommittedCount}/${status.totalCount} files`);
      console.log(`      ${status.group.description}`);
      
      if (!status.readyToCommit && status.group.dependsOn) {
        console.log(`      ⏳ Waiting for: ${status.group.dependsOn.join(', ')}`);
      }
    }

    return true;
  }

  isGroupReadyToCommit(group) {
    if (!group.dependsOn) return true;
    
    // Check if all dependent groups are fully committed
    return group.dependsOn.every(depId => {
      const depGroup = this.dependencyData.commitGroups.find(g => g.id === depId);
      if (!depGroup) return true;
      
      // Check if any files in the dependent group are uncommitted
      return !depGroup.files.some(file => {
        try {
          execSync(`git diff --name-only HEAD -- "${file}"`, { encoding: 'utf8' });
          return true; // File has uncommitted changes
        } catch {
          return false; // File is committed or doesn't exist
        }
      });
    });
  }

  showHelp() {
    console.log(`
🔧 Dependency Checker Usage:

Commands:
  check           Check dependencies for currently staged files (default)
  group <file>    Show which group a file belongs to
  status          Show overall status of all commit groups
  help            Show this help message

Examples:
  node check-dependencies.js
  node check-dependencies.js check
  node check-dependencies.js group src/services/auth.service.ts
  node check-dependencies.js status

Before committing:
  1. Stage your files: git add <files>
  2. Run dependency check: node check-dependencies.js
  3. Fix any issues if found
  4. Commit: git commit -m "your message"
`);
    return true;
  }
}

// Run the checker
const checker = new DependencyChecker();
const args = process.argv.slice(2);
const success = checker.run(args);
process.exit(success ? 0 : 1);