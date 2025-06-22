'use client';

import { ReactNode } from 'react';
import { AppShell } from '@mantine/core';
import { useSidebar } from '@/stores/ui';
import Sidebar from './Sidebar';
import Header from './Header';
import { OfflineStatusBanner, SyncProgressIndicator } from '@/components/offline';
import { useSyncStore } from '@/stores/sync';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    title: string;
    href?: string;
  }>;
  headerActions?: ReactNode;
}

export function AppLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  headerActions,
}: AppLayoutProps) {
  const { isOpen, isCollapsed } = useSidebar();
  const { isSyncing } = useSyncStore();

  return (
    <>
      {/* Offline Status Banner - Fixed position */}
      <OfflineStatusBanner position="top" />
      
      <AppShell
        navbar={{
          width: isCollapsed ? 8ResourceHistoryTable : 28ResourceHistoryTable,
          breakpoint: 'md',
          collapsed: { mobile: !isOpen, desktop: !isOpen },
        }}
        header={{ height: 64 }}
        padding="md"
      >
        {/* Sidebar Navigation */}
        <AppShell.Navbar p={ResourceHistoryTable}>
          <Sidebar />
        </AppShell.Navbar>

        {/* Header */}
        <AppShell.Header>
          <Header 
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
          />
        </AppShell.Header>

        {/* Main Content */}
        <AppShell.Main>
          <div className="min-h-[calc(1ResourceHistoryTableResourceHistoryTablevh-64px-2rem)]">
            {children}
          </div>
        </AppShell.Main>
      </AppShell>
      
      {/* Sync Progress Indicator - Fixed position */}
      {isSyncing && (
        <SyncProgressIndicator 
          position="fixed"
          showDetails={true}
        />
      )}
    </>
  );
}

// Higher-order component for pages that need the app layout
export function withAppLayout<P extends object>(
  Component: React.ComponentType<P>,
  layoutProps?: Omit<AppLayoutProps, 'children'>
) {
  return function LayoutComponent(props: P) {
    return (
      <AppLayout {...layoutProps}>
        <Component {...props} />
      </AppLayout>
    );
  };
}

export default AppLayout;