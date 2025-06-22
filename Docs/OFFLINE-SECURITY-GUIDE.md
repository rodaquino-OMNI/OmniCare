# OmniCare EMR - Offline Security Guide

## Overview

The OmniCare EMR Offline Security system provides comprehensive security measures for protecting healthcare data when the application operates in offline mode. This guide covers implementation, usage, and compliance considerations.

## Key Features

### 1. Client-Side Encryption
- **AES-GCM 256-bit encryption** for all stored data
- Automatic key generation and management
- Secure key storage using Web Crypto API
- Data integrity verification with authentication tags

### 2. Secure Storage Management
- **IndexedDB-based** encrypted storage
- Automatic data classification (PHI, Sensitive, General)
- Size limits and quota management
- Automatic data compression for large items

### 3. Offline Session Management
- Secure offline session creation and validation
- Role-based session timeouts
- Device fingerprinting for session security
- Automatic session expiry and cleanup

### 4. HIPAA-Compliant Audit Logging
- Comprehensive audit trail for all data access
- PHI access tracking with purpose documentation
- Compliance report generation
- Anomaly detection and security alerts

### 5. Data Lifecycle Management
- Automatic data purging based on classification
- Configurable retention policies
- Secure data deletion with overwriting
- Emergency data clearance capabilities

## Implementation Guide

### Basic Setup

```typescript
import { useOfflineSecurity } from '@/hooks/useOfflineSecurity';

function MyComponent() {
  const {
    setSecureItem,
    getSecureItem,
    storePatientData,
    getPatientData,
    logAuditEvent,
    isOffline,
    session
  } = useOfflineSecurity();

  // Component logic
}
```

### Storing Encrypted Data

```typescript
// Store general data
await setSecureItem('user_preferences', {
  theme: 'dark',
  language: 'en'
}, {
  classification: 'general',
  ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// Store sensitive data
await setSecureItem('session_data', {
  authToken: 'xxx',
  refreshToken: 'yyy'
}, {
  classification: 'sensitive',
  ttl: 60 * 60 * 1000 // 1 hour
});

// Store PHI data
await storePatientData(patientId, 'vitals', {
  bloodPressure: '120/80',
  heartRate: 72,
  temperature: 98.6
});
```

### Retrieving Encrypted Data

```typescript
// Retrieve general data
const preferences = await getSecureItem<UserPreferences>('user_preferences');

// Retrieve patient data
const vitals = await getPatientData<VitalSigns>(patientId, 'vitals');
```

### Audit Logging

```typescript
// Log PHI access
await logAuditEvent('PHI_ACCESSED', 'Viewed patient medical history', {
  patientId,
  dataType: 'medical_history',
  purpose: 'Clinical Care'
});

// Log security events
await logAuditEvent('SECURITY_VIOLATION', 'Multiple failed login attempts', {
  attemptCount: 5,
  ipAddress: '192.168.1.1'
});
```

### Generating Compliance Reports

```typescript
// Generate monthly HIPAA compliance report
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 1);
const endDate = new Date();

const report = await generateComplianceReport(startDate, endDate);

// Export audit logs
const auditLogs = await exportAuditLogs('csv');
```

## Security Configuration

### Default Configuration

```typescript
const OFFLINE_SECURITY_CONFIG = {
  encryption: {
    algorithm: 'AES-GCM',
    keySize: 256,
    saltSize: 32,
    iterations: 100000,
    tagLength: 128
  },
  storage: {
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    maxItemSize: 5 * 1024 * 1024, // 5MB
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    allowedDomains: ['localStorage', 'sessionStorage', 'indexedDB']
  },
  session: {
    timeout: 15 * 60 * 1000, // 15 minutes
    maxOfflineSessions: 5,
    requireReauth: true
  },
  audit: {
    enabled: true,
    maxEntries: 10000,
    retentionDays: 90
  },
  purge: {
    enabled: true,
    interval: 60 * 60 * 1000, // 1 hour
    policies: {
      phi: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
      sensitive: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
      general: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
    }
  }
};
```

### Custom Configuration

```typescript
// Initialize with custom configuration
const offlineSecurity = new OfflineSecurityService({
  encryption: {
    keySize: 256,
    iterations: 150000 // Increased for better security
  },
  purge: {
    policies: {
      phi: { maxAge: 12 * 60 * 60 * 1000 } // 12 hours for PHI
    }
  }
});
```

## Data Classification Guidelines

### PHI (Protected Health Information)
- Patient medical records
- Diagnostic results
- Treatment plans
- Prescription information
- **Retention**: 24 hours offline
- **Access**: Requires explicit patient context

### Sensitive
- User authentication tokens
- Session data
- Personal preferences with PII
- **Retention**: 7 days offline
- **Access**: User-specific only

### General
- Application settings
- Non-identifiable usage data
- Public resources
- **Retention**: 30 days offline
- **Access**: No special restrictions

## Best Practices

### 1. Always Classify Data Appropriately
```typescript
// Good - Explicit classification
await setSecureItem('patient_notes', notes, {
  classification: 'phi',
  metadata: { patientId, encounterId }
});

// Bad - No classification
await setSecureItem('patient_notes', notes);
```

### 2. Implement Proper Error Handling
```typescript
try {
  const data = await getPatientData(patientId, 'medications');
  if (!data) {
    // Handle missing data
  }
} catch (error) {
  // Log error and inform user
  await logAuditEvent('DATA_ACCESS_ERROR', error.message);
}
```

### 3. Regular Compliance Checks
```typescript
// Set up monthly compliance report generation
const generateMonthlyReport = async () => {
  const report = await generateComplianceReport(
    startOfMonth,
    endOfMonth
  );
  
  // Check for violations
  if (report.compliance.violations.length > 0) {
    // Alert administrators
  }
};
```

### 4. Monitor Storage Usage
```typescript
const { stats, storageQuota } = useOfflineSecurity();

if (storageQuota && storageQuota.usage / storageQuota.quota > 0.8) {
  // Warning: Storage nearly full
  // Trigger cleanup or alert user
}
```

### 5. Implement Session Security
```typescript
// Validate session before sensitive operations
const isValid = await validateSession();
if (!isValid) {
  // Force re-authentication
  await createSession();
}
```

## Compliance Considerations

### HIPAA Requirements
1. **Encryption**: All PHI must be encrypted at rest and in transit
2. **Access Control**: User authentication required for PHI access
3. **Audit Trail**: All PHI access must be logged
4. **Minimum Necessary**: Only access data required for the task
5. **Data Integrity**: Ensure data hasn't been tampered with

### Implementation Checklist
- ✅ Enable encryption for all PHI storage
- ✅ Implement user authentication before PHI access
- ✅ Log all PHI access with purpose and user context
- ✅ Set appropriate retention policies for PHI
- ✅ Implement automatic purging of expired PHI
- ✅ Generate regular compliance reports
- ✅ Monitor for suspicious access patterns
- ✅ Implement emergency data clearance procedures

## Troubleshooting

### Common Issues

1. **Storage Quota Exceeded**
   ```typescript
   // Clear expired data
   await offlineSecurityService.purgeExpiredData();
   ```

2. **Encryption Key Not Found**
   ```typescript
   // Re-initialize security service
   await offlineSecurityService.initialize();
   ```

3. **Session Expired**
   ```typescript
   // Create new session
   const session = await createSession();
   ```

### Debug Mode

Enable debug logging for troubleshooting:
```typescript
// In development only
if (process.env.NODE_ENV === 'development') {
  window.OFFLINE_SECURITY_DEBUG = true;
}
```

## Security Incidents

### Incident Response

1. **Detect** - Monitor audit logs for anomalies
2. **Contain** - Lock affected accounts/data
3. **Investigate** - Review audit trails
4. **Remediate** - Fix vulnerabilities
5. **Report** - Generate compliance reports

### Emergency Procedures

```typescript
// Emergency data clearance
if (securityBreach) {
  await offlineSecurityService.clearAllOfflineData();
  await logAuditEvent('EMERGENCY_CLEARANCE', 'Security breach detected');
}

// Force logout all sessions
await destroySession();
```

## API Reference

### OfflineSecurityService

```typescript
class OfflineSecurityService {
  // Encryption
  encryptData(data: any, classification: DataClassification, userId?: string): Promise<EncryptedData>
  decryptData(encryptedData: EncryptedData): Promise<any>
  
  // Storage
  storeSecureData(encryptedData: EncryptedData): Promise<void>
  retrieveSecureData(dataId: string, userId?: string): Promise<EncryptedData | null>
  
  // Session Management
  createOfflineSession(userId: string, role: string, permissions: string[]): Promise<OfflineSession>
  validateSession(sessionId: string): Promise<boolean>
  destroySession(sessionId: string): Promise<void>
  
  // Audit
  getAuditLog(filters?: AuditFilters): Promise<OfflineAuditEntry[]>
  exportAuditLog(): Promise<string>
  
  // Utilities
  getStorageStats(): Promise<OfflineSecurityStats>
  clearAllOfflineData(): Promise<void>
}
```

### SecureStorageService

```typescript
class SecureStorageService {
  // Basic Operations
  setItem<T>(key: string, value: T, options?: SecureStorageOptions): Promise<void>
  getItem<T>(key: string): Promise<T | null>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
  
  // Patient Data
  storePatientData<T>(patientId: string, dataType: string, data: T): Promise<void>
  getPatientData<T>(patientId: string, dataType: string): Promise<T | null>
  
  // Batch Operations
  setItems(items: Array<{key: string; value: any; options?: SecureStorageOptions}>): Promise<void>
  getItems<T>(keys: string[]): Promise<Map<string, T | null>>
  
  // Import/Export
  exportData(): Promise<string>
  importData(jsonData: string): Promise<void>
}
```

## Performance Considerations

### Encryption Performance
- Small data (<1KB): ~1-2ms
- Medium data (1-100KB): ~5-10ms
- Large data (>100KB): ~20-50ms with compression

### Storage Limits
- Chrome: ~60% of total disk space
- Firefox: ~50% of total disk space
- Safari: ~1GB
- Mobile browsers: Varies (typically 50-500MB)

### Optimization Tips
1. Enable compression for large data
2. Batch operations when possible
3. Use appropriate data classifications
4. Implement lazy loading for large datasets
5. Monitor storage quota regularly

## Migration Guide

### From Unencrypted Storage

```typescript
// Migrate existing localStorage data
const migrateData = async () => {
  const keys = Object.keys(localStorage);
  
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        await setSecureItem(key, parsed, {
          classification: determineClassification(key)
        });
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to migrate ${key}:`, error);
      }
    }
  }
};
```

## Support

For additional support or security concerns:
- Review the security documentation
- Check audit logs for detailed error information
- Contact the security team for critical issues

Remember: **Security is everyone's responsibility**. Always follow best practices and report any suspicious activity immediately.