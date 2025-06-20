#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class DependencyAnalyzer {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.dependencyMap = new Map();
    this.packageDependencies = new Map();
    this.buildOutputMap = new Map();
    this.commitGroups = [];
  }

  // Parse import statements from a file
  parseImports(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const imports = new Set();
      
      // Match various import patterns
      const importPatterns = [
        /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
        /import\s+['"`]([^'"`]+)['"`]/g,
        /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      ];

      importPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          let importPath = match[1];
          
          // Resolve relative imports to absolute paths
          if (importPath.startsWith('.')) {
            const fileDir = path.dirname(filePath);
            const resolvedPath = path.resolve(fileDir, importPath);
            
            // Check for common file extensions
            const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
            for (const ext of extensions) {
              const fullPath = resolvedPath + ext;
              if (fs.existsSync(fullPath)) {
                imports.add(path.relative(this.rootDir, fullPath));
                break;
              }
            }
            
            // Check for index files
            const indexExtensions = extensions.map(ext => `/index${ext}`);
            for (const ext of indexExtensions) {
              const indexPath = resolvedPath + ext;
              if (fs.existsSync(indexPath)) {
                imports.add(path.relative(this.rootDir, indexPath));
                break;
              }
            }
          } else if (!importPath.startsWith('@') && !importPath.includes('/')) {
            // Node modules - track as external dependency
            imports.add(`node_modules:${importPath}`);
          } else if (importPath.startsWith('@/')) {
            // Path alias resolution (common in TypeScript projects)
            const aliasPath = importPath.replace('@/', 'src/');
            const fullAliasPath = path.join(this.rootDir, aliasPath);
            
            const extensions = ['.ts', '.tsx', '.js', '.jsx'];
            for (const ext of extensions) {
              const fullPath = fullAliasPath + ext;
              if (fs.existsSync(fullPath)) {
                imports.add(path.relative(this.rootDir, fullPath));
                break;
              }
            }
          }
        }
      });

      return Array.from(imports);
    } catch (error) {
      console.warn(`Could not parse imports from ${filePath}:`, error.message);
      return [];
    }
  }

  // Analyze package.json files
  analyzePackageJsons(filePaths) {
    const packageJsonFiles = filePaths.filter(file => file.endsWith('package.json'));
    
    packageJsonFiles.forEach(pkgPath => {
      try {
        const content = fs.readFileSync(path.join(this.rootDir, pkgPath), 'utf8');
        const pkgData = JSON.parse(content);
        
        this.packageDependencies.set(pkgPath, {
          dependencies: pkgData.dependencies || {},
          devDependencies: pkgData.devDependencies || {},
          peerDependencies: pkgData.peerDependencies || {},
          scripts: pkgData.scripts || {}
        });
      } catch (error) {
        console.warn(`Could not parse package.json at ${pkgPath}:`, error.message);
      }
    });
  }

  // Map build outputs to their sources
  mapBuildOutputs(filePaths) {
    filePaths.forEach(filePath => {
      if (filePath.includes('/dist/')) {
        // TypeScript build output
        const srcPath = filePath.replace('/dist/', '/src/').replace(/\.d\.ts$/, '.ts').replace(/\.js$/, '.ts');
        if (filePaths.includes(srcPath)) {
          this.buildOutputMap.set(filePath, srcPath);
        }
      }
    });
  }

  // Identify critical dependency chains
  identifyCriticalChains() {
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'jest.config.js',
      'tailwind.config.js'
    ];

    const chains = [];
    
    criticalFiles.forEach(criticalFile => {
      const dependents = [];
      for (const [file, deps] of this.dependencyMap) {
        if (deps.some(dep => dep.includes(criticalFile))) {
          dependents.push(file);
        }
      }
      
      if (dependents.length > 0) {
        chains.push({
          critical: criticalFile,
          dependents: dependents,
          priority: 'high'
        });
      }
    });

    return chains;
  }

  // Determine commit groups based on dependencies
  determineCommitGroups(filePaths) {
    const groups = [];
    const processed = new Set();

    // Group 1: Configuration and build files
    const configFiles = filePaths.filter(file => 
      file.endsWith('.json') || 
      file.endsWith('.config.js') || 
      file.endsWith('.config.ts') ||
      file.includes('.claude/') ||
      file.includes('memory/')
    ).filter(file => !processed.has(file));

    if (configFiles.length > 0) {
      groups.push({
        id: 'config-and-setup',
        description: 'Configuration files, memory backups, and project setup',
        files: configFiles,
        priority: 1,
        mustCommitFirst: true
      });
      configFiles.forEach(file => processed.add(file));
    }

    // Group 2: Type definitions and models
    const typeFiles = filePaths.filter(file => 
      file.includes('/types/') || 
      file.includes('/models/') ||
      file.endsWith('.types.ts') ||
      file.includes('base.model')
    ).filter(file => !processed.has(file));

    if (typeFiles.length > 0) {
      groups.push({
        id: 'types-and-models',
        description: 'Type definitions and data models',
        files: typeFiles,
        priority: 2,
        dependsOn: ['config-and-setup']
      });
      typeFiles.forEach(file => processed.add(file));
    }

    // Group 3: Services and utilities
    const serviceFiles = filePaths.filter(file => 
      file.includes('/services/') || 
      file.includes('/utils/') ||
      file.includes('middleware')
    ).filter(file => !processed.has(file));

    if (serviceFiles.length > 0) {
      groups.push({
        id: 'services-and-utils',
        description: 'Business logic services and utilities',
        files: serviceFiles,
        priority: 3,
        dependsOn: ['types-and-models']
      });
      serviceFiles.forEach(file => processed.add(file));
    }

    // Group 4: Controllers and routes
    const controllerFiles = filePaths.filter(file => 
      file.includes('/controllers/') || 
      file.includes('/routes/')
    ).filter(file => !processed.has(file));

    if (controllerFiles.length > 0) {
      groups.push({
        id: 'controllers-and-routes',
        description: 'API controllers and routing',
        files: controllerFiles,
        priority: 4,
        dependsOn: ['services-and-utils']
      });
      controllerFiles.forEach(file => processed.add(file));
    }

    // Group 5: Frontend components
    const componentFiles = filePaths.filter(file => 
      file.includes('/components/') ||
      file.includes('/screens/') ||
      file.includes('/pages/')
    ).filter(file => !processed.has(file));

    if (componentFiles.length > 0) {
      groups.push({
        id: 'frontend-components',
        description: 'UI components and screens',
        files: componentFiles,
        priority: 5,
        dependsOn: ['types-and-models']
      });
      componentFiles.forEach(file => processed.add(file));
    }

    // Group 6: Tests
    const testFiles = filePaths.filter(file => 
      file.includes('/test') || 
      file.includes('__tests__') ||
      file.endsWith('.test.ts') ||
      file.endsWith('.test.tsx') ||
      file.endsWith('.spec.ts')
    ).filter(file => !processed.has(file));

    if (testFiles.length > 0) {
      groups.push({
        id: 'tests',
        description: 'Test files and test configuration',
        files: testFiles,
        priority: 6,
        dependsOn: ['controllers-and-routes', 'frontend-components']
      });
      testFiles.forEach(file => processed.add(file));
    }

    // Group 7: Build outputs (should be committed last)
    const buildFiles = filePaths.filter(file => 
      file.includes('/dist/') ||
      file.includes('/build/')
    ).filter(file => !processed.has(file));

    if (buildFiles.length > 0) {
      groups.push({
        id: 'build-outputs',
        description: 'Compiled build outputs',
        files: buildFiles,
        priority: 7,
        dependsOn: ['controllers-and-routes', 'frontend-components'],
        commitLast: true,
        note: 'These are generated files - consider if they should be committed'
      });
      buildFiles.forEach(file => processed.add(file));
    }

    // Group 8: Remaining files
    const remainingFiles = filePaths.filter(file => !processed.has(file));
    if (remainingFiles.length > 0) {
      groups.push({
        id: 'miscellaneous',
        description: 'Other files not categorized',
        files: remainingFiles,
        priority: 8
      });
    }

    return groups;
  }

  // Main analysis function
  analyze(filePaths) {
    console.log('Analyzing dependencies...');
    
    // Parse imports for each file
    filePaths.forEach(filePath => {
      const fullPath = path.join(this.rootDir, filePath);
      if (fs.existsSync(fullPath) && !filePath.includes('node_modules') && 
          (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || 
           filePath.endsWith('.js') || filePath.endsWith('.jsx'))) {
        const imports = this.parseImports(fullPath);
        this.dependencyMap.set(filePath, imports);
      }
    });

    // Analyze package.json files
    this.analyzePackageJsons(filePaths);
    
    // Map build outputs
    this.mapBuildOutputs(filePaths);
    
    // Determine commit groups
    this.commitGroups = this.determineCommitGroups(filePaths);
    
    return {
      dependencyMap: Object.fromEntries(this.dependencyMap),
      packageDependencies: Object.fromEntries(this.packageDependencies),
      buildOutputMap: Object.fromEntries(this.buildOutputMap),
      commitGroups: this.commitGroups,
      criticalChains: this.identifyCriticalChains(),
      summary: {
        totalFiles: filePaths.length,
        sourceFiles: this.dependencyMap.size,
        packageJsonFiles: this.packageDependencies.size,
        buildOutputFiles: this.buildOutputMap.size,
        commitGroups: this.commitGroups.length
      }
    };
  }
}

// Read the changed files and analyze
const changedFilesPath = path.join(__dirname, 'changed-files.txt');
const changedFiles = fs.readFileSync(changedFilesPath, 'utf8')
  .split('\n')
  .filter(line => line.trim())
  .map(line => line.trim());

const analyzer = new DependencyAnalyzer(path.resolve(__dirname, '../..'));
const analysis = analyzer.analyze(changedFiles);

// Write the analysis to a JSON file
const outputPath = path.join(__dirname, 'map');
fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

console.log(`Analysis complete. Results written to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`- Total files analyzed: ${analysis.summary.totalFiles}`);
console.log(`- Source files with dependencies: ${analysis.summary.sourceFiles}`);
console.log(`- Package.json files: ${analysis.summary.packageJsonFiles}`);
console.log(`- Build output files: ${analysis.summary.buildOutputFiles}`);
console.log(`- Commit groups identified: ${analysis.summary.commitGroups}`);

console.log(`\nCommit Groups (in order):`);
analysis.commitGroups.forEach((group, index) => {
  console.log(`${index + 1}. ${group.id}: ${group.files.length} files`);
  console.log(`   Description: ${group.description}`);
  if (group.dependsOn) {
    console.log(`   Depends on: ${group.dependsOn.join(', ')}`);
  }
  if (group.mustCommitFirst) {
    console.log(`   ⚠️  Must commit first`);
  }
  if (group.commitLast) {
    console.log(`   ⚠️  Should commit last`);
  }
  if (group.note) {
    console.log(`   Note: ${group.note}`);
  }
  console.log('');
});