# Swarm Dependency Coordination Guide

## Overview
This guide ensures proper commit ordering across multiple development agents to prevent build failures and maintain code integrity.

## Critical Commit Order Requirements

### ⚠️ MANDATORY SEQUENCE

#### Phase 1: Foundation (MUST COMMIT FIRST)
**Group: config-and-setup**
- **Files**: 40 configuration and setup files
- **Why First**: These establish the project structure, build configuration, and memory state
- **Includes**:
  - `.claude/config.json`, `.claude/settings.json`
  - `package.json`, `package-lock.json` files
  - TypeScript configurations (`tsconfig.json`)
  - Build configurations (`next.config.js`, `jest.config.js`, etc.)
  - Memory backups and project metadata

#### Phase 2: Type Definitions (COMMIT AFTER PHASE 1)
**Group: types-and-models**
- **Files**: 33 type definition and model files
- **Depends On**: config-and-setup
- **Why Second**: Provides type safety foundation for all subsequent code
- **Includes**:
  - All files in `/types/` directories
  - All files in `/models/` directories
  - Base model definitions (`base.model.ts`)
  - Type definition files (`.types.ts`)

#### Phase 3: Business Logic (COMMIT AFTER PHASE 2)
**Group: services-and-utils**
- **Files**: 81 service and utility files
- **Depends On**: types-and-models
- **Critical Dependencies**:
  - Authentication services depend on auth types
  - FHIR services depend on FHIR models
  - Integration services depend on integration types
- **Includes**:
  - All `/services/` directories
  - All `/utils/` directories
  - Middleware files

#### Phase 4A: API Layer (COMMIT AFTER PHASE 3)
**Group: controllers-and-routes**
- **Files**: 14 controller and routing files
- **Depends On**: services-and-utils
- **Critical**: API endpoints depend on business logic services

#### Phase 4B: Frontend Components (PARALLEL WITH 4A)
**Group: frontend-components**
- **Files**: 57 UI component and screen files
- **Depends On**: types-and-models
- **Can Commit In Parallel With**: controllers-and-routes
- **Includes**:
  - React components
  - Mobile screens
  - UI pages

#### Phase 5: Testing (COMMIT AFTER PHASE 4)
**Group: tests**
- **Files**: 10 test files
- **Depends On**: controllers-and-routes, frontend-components
- **Critical**: Tests validate the integrated system

#### Phase 6: Build Artifacts (COMMIT LAST - OPTIONAL)
**Group: build-outputs**
- **Files**: 6 compiled build files
- **Depends On**: All source code
- **Note**: Consider if these should be committed at all

## Package.json Dependency Analysis

### Critical Package Changes Detected:
1. **Root package.json**: Project dependencies and scripts
2. **backend/package.json**: Backend-specific dependencies
3. **frontend/package.json**: Frontend React dependencies  
4. **mobile/package.json**: React Native dependencies

### Lock File Coordination:
- **MUST** commit package.json before package-lock.json
- **MUST** ensure lock files match their corresponding package.json
- **AVOID** committing conflicting lock file states

## Agent Coordination Protocol

### For Development Agents:

#### Before Making Changes:
1. Check dependency map at: `swarm-auto-centralized-1750414726442/dependency-tracker/map`
2. Identify which commit group your changes belong to
3. Verify all dependencies are satisfied

#### Before Committing:
1. Ensure you're committing the correct phase
2. Check that prerequisite phases are already committed
3. If modifying types/models, coordinate with agents working on dependent services
4. If modifying package.json, ensure lock files are updated consistently

#### Coordination Commands:
```bash
# Check current commit phase status
git log --oneline -10 | grep -E "(config|types|services|controllers|components|tests|build)"

# Verify your changes don't break dependencies
npm run typecheck

# Test build before committing
npm run build
```

## File-Level Dependencies

### High-Impact Files (Changes Affect Many Files):
1. **Base Models**: `backend/src/models/base.model.ts`
   - Used by: All other model files, services, controllers
   - **CRITICAL**: Must commit before any dependent files

2. **Auth Configuration**: `src/config/auth.config.ts`
   - Used by: All authentication services, middleware, controllers
   - **CRITICAL**: Changes affect entire auth system

3. **FHIR Types**: `backend/src/types/fhir.ts`
   - Used by: All FHIR services, controllers, transformations
   - **CRITICAL**: Changes affect all clinical data handling

### Package Import Dependencies:
- **@medplum/fhirtypes**: Used across backend models and services
- **express**: Core backend framework dependency
- **react**: Core frontend framework dependency
- **@types/**: TypeScript definitions must be available before compilation

## Error Prevention Checklist

### Before Any Commit:
- [ ] TypeScript compilation passes
- [ ] No circular dependencies
- [ ] Package.json and lock files are consistent
- [ ] Tests pass (if applicable to your changes)

### Multi-Agent Scenarios:
- [ ] Agent A working on types commits before Agent B working on services
- [ ] Package.json changes are coordinated across agents
- [ ] Build configuration changes are committed before source code changes
- [ ] Memory state is consistent across agents

## Emergency Coordination

### If Build Breaks:
1. Check which commit group was last committed
2. Verify all dependencies for that group were committed first
3. Check for package.json/lock file mismatches
4. Coordinate with other agents to resolve conflicts

### Communication Protocol:
- Use git commit messages to indicate which coordination group
- Example: `feat: auth services (services-and-utils group)`
- Include dependency warnings in commit messages when needed

## Monitoring Commands

### For Swarm Coordinators:
```bash
# Check dependency map
cat swarm-auto-centralized-1750414726442/dependency-tracker/map | jq '.commitGroups'

# Verify commit group completion
git log --oneline | head -20

# Check current build status
npm run typecheck && npm run build
```

This coordination ensures smooth multi-agent development without breaking changes or build failures.