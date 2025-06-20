# OmniCare EMR Dependency Tracker

## Overview
This dependency tracker ensures proper commit ordering across multiple development agents to prevent build failures, resolve dependency conflicts, and maintain code integrity in the OmniCare EMR system.

## 🎯 Purpose
- **Identify dependencies** between changed files
- **Analyze commit order** requirements
- **Ensure dependent code** is committed together
- **Track package.json changes** and lock file updates
- **Coordinate commit order** with other agents

## 📁 Files Structure
```
swarm-auto-centralized-1750414726442/dependency-tracker/
├── README.md                    # This file
├── SUMMARY.md                   # Analysis summary and findings
├── commit-coordination.md       # Coordination guide for agents
├── map                         # JSON dependency map (generated)
├── changed-files.txt           # List of changed files
├── analyze-dependencies.js     # Analysis script
└── check-dependencies.js      # Dependency checker tool
```

## 🚀 Quick Start

### For Development Agents:

#### Before Committing:
```bash
# Navigate to dependency tracker
cd swarm-auto-centralized-1750414726442/dependency-tracker

# Check your staged files
./check-dependencies.js check

# Check which group a specific file belongs to
./check-dependencies.js group src/services/auth.service.ts

# See overall status
./check-dependencies.js status
```

#### Example Workflow:
```bash
# Stage your files
git add src/models/patient.model.ts src/types/fhir.ts

# Check dependencies
./check-dependencies.js
# Output: ✅ Dependency check passed!

# Run verification
npm run typecheck && npm run build

# Commit with group indication
git commit -m "feat: add patient FHIR models (types-and-models)"
```

## 📊 Commit Groups (Priority Order)

### 1. config-and-setup (MUST COMMIT FIRST)
- Configuration files, package.json, tsconfig.json
- Memory backups and project metadata
- **40 files** - Foundation of the project

### 2. types-and-models  
- Type definitions and data models
- Base models that other services depend on
- **33 files** - Type safety foundation

### 3. services-and-utils
- Business logic services and utilities
- Core functionality implementation
- **81 files** - Business logic layer

### 4. controllers-and-routes & frontend-components (Parallel)
- API controllers and React components
- Can be committed in parallel
- **14 + 57 files** - Application layer

### 5. tests
- Test files and test configuration
- Integration and unit tests
- **10 files** - Validation layer

### 6. build-outputs (OPTIONAL - COMMIT LAST)
- Compiled TypeScript outputs
- Consider if these should be committed
- **6 files** - Generated artifacts

## 🔍 Dependency Analysis Results

### Critical Dependencies Identified:
- **Package.json Changes**: 4 files requiring coordination
- **Base Model Chain**: `base.model.ts` → 20+ dependent files
- **Auth Configuration**: Cascades through 25+ files  
- **FHIR Types**: Affects all clinical operations

### High-Impact Files:
1. `backend/src/models/base.model.ts` (20+ dependencies)
2. `backend/src/types/fhir.ts` (all FHIR operations)
3. `src/config/auth.config.ts` (entire auth system)
4. `backend/src/routes/index.ts` (API routing)

## 🛠️ Available Commands

### Dependency Checker Tool:
```bash
./check-dependencies.js                           # Check staged files
./check-dependencies.js check                     # Same as above
./check-dependencies.js group <filepath>          # Show file's group
./check-dependencies.js status                    # Overall status
./check-dependencies.js help                      # Show help
```

### Analysis Tool:
```bash
node analyze-dependencies.js                      # Re-run analysis
```

## ⚠️ Critical Rules

### MUST-DO:
- ✅ Commit config files before source code
- ✅ Commit types before services  
- ✅ Commit services before controllers
- ✅ Run `npm run typecheck` before committing
- ✅ Coordinate package.json changes

### NEVER-DO:
- ❌ Never commit services before types
- ❌ Never commit controllers before services
- ❌ Never commit conflicting package-lock.json
- ❌ Never skip build verification

## 🤝 Multi-Agent Coordination

### Communication Protocol:
```bash
# Commit message format
git commit -m "feat: description (dependency-group)"

# Examples:
git commit -m "feat: add FHIR models (types-and-models)"
git commit -m "feat: auth services (services-and-utils)"
git commit -m "feat: patient components (frontend-components)"
```

### Status Checking:
```bash
# Check what's been committed recently
git log --oneline -10

# Check build status
npm run typecheck && npm run build

# Check dependency status
./check-dependencies.js status
```

## 🚨 Troubleshooting

### Build Failures:
1. Check which commit group was last committed
2. Verify all dependencies were committed first
3. Check package.json/lock file consistency
4. Run dependency checker on problematic files

### Dependency Conflicts:
1. Use `./check-dependencies.js group <file>` to identify groups
2. Check the coordination guide in `commit-coordination.md`
3. Coordinate with other agents working on dependencies

### Package.json Issues:
1. Ensure lock files match their package.json
2. Commit package.json before package-lock.json
3. Coordinate changes across all agents

## 📈 Analysis Statistics
- **Total Files Analyzed**: 302
- **Source Files with Dependencies**: 272  
- **Package.json Files**: 4
- **Build Output Files**: 66
- **Commit Groups**: 8
- **Critical Dependency Chains**: 12

## 🔄 Re-running Analysis
If new files are added or dependencies change:
```bash
# Update changed files list
git status --porcelain | awk '{print $2}' | grep -E '\.(ts|tsx|js|jsx|json)$' | grep -v node_modules > changed-files.txt

# Re-run analysis
node analyze-dependencies.js

# Check updated dependencies
./check-dependencies.js status
```

## 📚 Additional Resources
- `SUMMARY.md` - Detailed analysis findings
- `commit-coordination.md` - Comprehensive coordination guide
- `map` - Raw JSON dependency data

---

**🤖 This dependency tracker ensures smooth multi-agent development without breaking changes or build failures across the OmniCare EMR system.**