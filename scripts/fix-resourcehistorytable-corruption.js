#!/usr/bin/env node

/**
 * Fix ResourceHistoryTable corruption where numeric zeros were replaced
 */

const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/__tests__/offline/offline-component.test.tsx',
  'frontend/jest.setup.js',
  'frontend/src/services/indexeddb.sync.ts',
  'frontend/src/hooks/useOfflineSync.ts',
  'frontend/src/components/sync/SyncStatusIndicator.tsx',
  'frontend/src/services/offline-fhir.service.ts',
  'frontend/src/services/patient-sync.service.ts',
  'frontend/src/services/secure-storage.service.ts',
  'frontend/src/hooks/usePatientCache.ts',
  'frontend/src/components/patient/PatientList.tsx',
  'frontend/src/components/offline/SyncProgressIndicator.tsx',
  'frontend/src/components/admin/PatientRegistration.tsx',
  'frontend/src/components/network/NetworkAwareImage.tsx',
  'frontend/src/components/network/NetworkStatusIndicator.tsx',
  'frontend/src/services/offline-smarttext.service.ts',
  'frontend/src/services/cds.service.ts',
  'frontend/src/services/offline-notes.service.ts',
  'frontend/src/services/note-sync-queue.service.ts',
  'frontend/src/services/offline-audit.service.ts',
  'frontend/src/hooks/useNetworkAware.ts',
  'frontend/src/__tests__/offline/offline-performance.test.ts',
  'frontend/src/utils/network-utils.ts',
  'frontend/src/stores/patient.ts',
  'frontend/src/types/administrative.ts',
  'frontend/src/__tests__/offline/service-worker.test.ts',
  'frontend/src/__tests__/test-types.d.ts'
];

const patterns = [
  // Common numeric replacements
  { pattern: /pendingChanges: ResourceHistoryTable/g, replacement: 'pendingChanges: 0' },
  { pattern: /completed: ResourceHistoryTable/g, replacement: 'completed: 0' },
  { pattern: /failed: ResourceHistoryTable/g, replacement: 'failed: 0' },
  { pattern: /conflicts: ResourceHistoryTable/g, replacement: 'conflicts: 0' },
  { pattern: /i = ResourceHistoryTable/g, replacement: 'i = 0' },
  { pattern: /\[ResourceHistoryTable\]/g, replacement: '[0]' },
  { pattern: /=== ResourceHistoryTable/g, replacement: '=== 0' },
  { pattern: /> ResourceHistoryTable/g, replacement: '> 0' },
  { pattern: /< ResourceHistoryTable/g, replacement: '< 0' },
  { pattern: /!== ResourceHistoryTable/g, replacement: '!== 0' },
  { pattern: /\? ResourceHistoryTable/g, replacement: '? 0' },
  { pattern: /: ResourceHistoryTable/g, replacement: ': 0' },
  { pattern: /opacity: ResourceHistoryTable/g, replacement: 'opacity: 0' },
  { pattern: /fontSize: ResourceHistoryTable/g, replacement: 'fontSize: 0' },
  { pattern: /padding: ResourceHistoryTable/g, replacement: 'padding: 0' },
  { pattern: /margin: ResourceHistoryTable/g, replacement: 'margin: 0' },
  { pattern: /width: ResourceHistoryTable/g, replacement: 'width: 0' },
  { pattern: /height: ResourceHistoryTable/g, replacement: 'height: 0' },
  { pattern: /top: ResourceHistoryTable/g, replacement: 'top: 0' },
  { pattern: /left: ResourceHistoryTable/g, replacement: 'left: 0' },
  { pattern: /right: ResourceHistoryTable/g, replacement: 'right: 0' },
  { pattern: /bottom: ResourceHistoryTable/g, replacement: 'bottom: 0' },
  { pattern: /delay: ResourceHistoryTable/g, replacement: 'delay: 0' },
  { pattern: /timeout: ResourceHistoryTable/g, replacement: 'timeout: 0' },
  { pattern: /count: ResourceHistoryTable/g, replacement: 'count: 0' },
  { pattern: /total: ResourceHistoryTable/g, replacement: 'total: 0' },
  { pattern: /length: ResourceHistoryTable/g, replacement: 'length: 0' },
  { pattern: /size: ResourceHistoryTable/g, replacement: 'size: 0' },
  { pattern: /\(ResourceHistoryTable\)/g, replacement: '(0)' },
  { pattern: / ResourceHistoryTable,/g, replacement: ' 0,' },
  { pattern: / ResourceHistoryTable;/g, replacement: ' 0;' },
  { pattern: / ResourceHistoryTable\)/g, replacement: ' 0)' },
  { pattern: / ResourceHistoryTable /g, replacement: ' 0 ' }
];

let totalFixes = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      fixCount += matches.length;
      content = content.replace(pattern, replacement);
    }
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${fixCount} occurrences in ${file}`);
    totalFixes += fixCount;
  }
});

console.log(`\nTotal fixes applied: ${totalFixes}`);