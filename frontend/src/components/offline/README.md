# Offline UI Components

This directory contains UI components for managing offline functionality in the OmniCare healthcare application.

## Components Overview

### Core Status Components

#### `OfflineStatusBanner`
Global banner that shows the current offline/online status and sync information.

```tsx
import { OfflineStatusBanner } from '@/components/offline';

// Basic usage - automatically positioned at top
<OfflineStatusBanner />

// Customized
<OfflineStatusBanner 
  position="bottom"
  dismissible={true}
  showSyncProgress={true}
/>
```

#### `OfflineIndicator`
Small indicator for headers and navigation areas.

```tsx
import { OfflineIndicator } from '@/components/offline';

// Different variants
<OfflineIndicator variant="badge" />
<OfflineIndicator variant="icon" />
<OfflineIndicator variant="text" showPendingCount={true} />
<OfflineIndicator variant="indicator" />
```

### Sync Components

#### `SyncProgressIndicator`
Shows detailed sync progress with queue information.

```tsx
import { SyncProgressIndicator } from '@/components/offline';

// Fixed position (bottom-right)
<SyncProgressIndicator position="fixed" showDetails={true} />

// Inline in content
<SyncProgressIndicator position="relative" minimal={true} />
```

#### `SyncConflictDialog`
Modal for resolving data conflicts during sync.

```tsx
import { SyncConflictDialog } from '@/components/offline';

<SyncConflictDialog
  opened={conflictsExist}
  onClose={() => setConflictsExist(false)}
  conflicts={dataConflicts}
  onResolve={handleConflictResolution}
  allowBulkResolve={true}
/>
```

### Cache Components

#### `CacheStatusIndicator`
Shows cache status and staleness for specific data.

```tsx
import { CacheStatusIndicator } from '@/components/offline';

// In patient header
<CacheStatusIndicator
  lastSyncTime={patientData.lastSync}
  dataType="Patient data"
  variant="badge"
  onRefresh={handleRefresh}
/>

// Detailed card view
<CacheStatusIndicator
  variant="card"
  showDetails={true}
/>
```

#### `OfflineLoadingState`
Skeleton loading state with offline messaging.

```tsx
import { OfflineLoadingState } from '@/components/offline';

// Different layouts
<OfflineLoadingState type="list" rows={5} />
<OfflineLoadingState type="card" rows={3} />
<OfflineLoadingState type="table" rows={10} />
<OfflineLoadingState type="form" />
```

### Settings and Management

#### `OfflineSettings`
Complete settings panel for offline mode configuration.

```tsx
import { OfflineSettings } from '@/components/offline';

// Standalone settings page
<OfflineSettings showHeader={true} />

// Embedded in settings modal
<OfflineSettings showHeader={false} onClose={closeModal} />
```

#### `OfflineDataConflictBanner`
Banner for alerting users to unresolved conflicts.

```tsx
import { OfflineDataConflictBanner } from '@/components/offline';

<OfflineDataConflictBanner
  conflicts={pendingConflicts}
  onResolve={() => setShowConflictDialog(true)}
  onDismiss={() => setConflictsDismissed(true)}
/>
```

## Integration Patterns

### App Layout Integration

Add offline components to your app layout:

```tsx
// components/layout/AppLayout.tsx
import { OfflineStatusBanner, SyncProgressIndicator } from '@/components/offline';

export function AppLayout({ children }) {
  return (
    <>
      <OfflineStatusBanner position="top" />
      
      <AppShell>
        {/* Your app shell content */}
      </AppShell>
      
      <SyncProgressIndicator position="fixed" />
    </>
  );
}
```

### Component Updates for Offline Support

Update existing components to be offline-aware:

```tsx
// components/patient/PatientHeader.tsx
import { CacheStatusIndicator, OfflineLoadingState } from '@/components/offline';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function PatientHeader({ patient }) {
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return <OfflineLoadingState type="card" showMessage={!isOnline} />;
  }
  
  return (
    <Paper>
      <Group>
        <Text>{patient.name}</Text>
        {!isOnline && (
          <CacheStatusIndicator
            lastSyncTime={patient.lastSync}
            dataType="Patient"
          />
        )}
      </Group>
    </Paper>
  );
}
```

## State Management Integration

The components work with the following stores:

### `useSyncStore`
- Manages sync queue and progress
- Tracks sync errors and conflicts
- Handles retry logic

### `useOfflineStore`
- Manages offline settings and preferences
- Tracks cache metadata and size
- Handles cache cleanup

### `useNetworkStatus`
- Monitors network connectivity
- Detects connection quality
- Triggers sync when coming online

## Styling and Theming

All components use Mantine UI components and support:
- Color schemes (follows Mantine theme)
- Responsive design
- Dark mode compatibility
- Accessibility features

## Accessibility Features

- Screen reader support
- Keyboard navigation
- High contrast indicators
- Clear status announcements
- Progress information for assistive technologies

## Best Practices

1. **Always show offline status** in the header or navigation
2. **Use cache indicators** for data that might be stale
3. **Provide refresh options** when online
4. **Handle conflicts gracefully** with clear resolution options
5. **Show loading states** that indicate offline mode
6. **Allow manual sync** when connection is restored

## Performance Considerations

- Components are optimized for minimal re-renders
- Cache checks are debounced
- Network status is monitored efficiently
- IndexedDB operations are batched when possible