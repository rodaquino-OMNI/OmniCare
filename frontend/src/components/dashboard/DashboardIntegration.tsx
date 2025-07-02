'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Stack, Container, Group, Switch, Text, Badge } from '@mantine/core';
import { IconLayout, IconUser, IconStethoscope } from '@tabler/icons-react';
import { useAuth } from '@/stores/auth';
import { FourPanelDashboard } from './FourPanelDashboard';
import { UnifiedPatientSummary } from './UnifiedPatientSummary';
import { EnhancedNavigation } from '@/components/navigation/EnhancedNavigation';
import AppLayout from '@/components/layout/AppLayout';

interface DashboardIntegrationProps {
  patientId?: string;
  mode?: 'dashboard' | 'patient' | 'clinical';
  title?: string;
  subtitle?: string;
}

export function DashboardIntegration({
  patientId,
  mode = 'dashboard',
  title,
  subtitle
}: DashboardIntegrationProps) {
  const [viewMode, setViewMode] = useState<'panels' | 'unified'>('panels');
  const [selectedPatient, setSelectedPatient] = useState<string | undefined>(patientId);
  const { user, hasAnyRole } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract patient ID from URL if not provided
  useEffect(() => {
    const urlPatientId = searchParams.get('patient') || searchParams.get('patientId');
    if (urlPatientId && !selectedPatient) {
      setSelectedPatient(urlPatientId);
    }
  }, [searchParams, selectedPatient]);

  // Auto-switch to unified view when patient is selected
  useEffect(() => {
    if (selectedPatient && viewMode === 'panels') {
      setViewMode('unified');
    }
  }, [selectedPatient, viewMode]);

  // Navigation handler for deep linking
  const handleNavigate = (section: string, data?: any) => {
    console.log('Navigating to:', section, data);
    
    // Handle patient selection
    if (section === 'patients' && data?.patientId) {
      setSelectedPatient(data.patientId);
      setViewMode('unified');
      return;
    }
    
    // Handle patient-specific navigation
    if (data?.patientId && data.patientId !== selectedPatient) {
      setSelectedPatient(data.patientId);
    }
    
    // In a real app, this would use Next.js router to navigate
    // For now, we'll just log the navigation intent
    const navigationUrl = constructNavigationUrl(section, data);
    console.log('Would navigate to:', navigationUrl);
  };

  const constructNavigationUrl = (section: string, data?: any) => {
    const base = '/';
    
    switch (section) {
      case 'patients':
        if (data?.patientId) {
          return `${base}patients/${data.patientId}`;
        }
        return `${base}patients`;
      
      case 'encounters':
        if (data?.patientId) {
          return `${base}clinical/encounters?patient=${data.patientId}`;
        }
        return `${base}clinical/encounters`;
      
      case 'medications':
        if (data?.patientId) {
          return `${base}medications?patient=${data.patientId}`;
        }
        return `${base}medications`;
      
      case 'orders':
        if (data?.patientId) {
          return `${base}orders?patient=${data.patientId}`;
        }
        return `${base}orders`;
      
      case 'results':
        if (data?.patientId) {
          return `${base}results?patient=${data.patientId}`;
        }
        return `${base}results`;
      
      case 'scheduling':
        return `${base}scheduling`;
      
      case 'communication':
        return `${base}communication`;
      
      case 'admin':
        return `${base}admin`;
      
      default:
        return `${base}${section}`;
    }
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    
    if (mode === 'patient' && selectedPatient) {
      breadcrumbs.push({
        title: 'Patients',
        href: '/patients',
        icon: IconUser
      });
      breadcrumbs.push({
        title: `Patient ${selectedPatient}`,
        icon: IconUser
      });
    } else if (mode === 'clinical') {
      breadcrumbs.push({
        title: 'Clinical Workflow',
        href: '/clinical',
        icon: IconStethoscope
      });
    }
    
    return breadcrumbs;
  };

  const getLayoutProps = () => {
    const baseTitle = title || (
      mode === 'patient' ? 'Patient Dashboard' :
      mode === 'clinical' ? 'Clinical Workflow' :
      'Clinical Dashboard'
    );
    
    const baseSubtitle = subtitle || (
      selectedPatient ? `Patient ID: ${selectedPatient}` :
      'Four-panel clinical workflow system'
    );

    return {
      title: baseTitle,
      subtitle: baseSubtitle,
      breadcrumbs: getBreadcrumbs()
    };
  };

  const renderDashboardContent = () => {
    // Show unified patient view when patient is selected
    if (selectedPatient && viewMode === 'unified') {
      return (
        <UnifiedPatientSummary
          patientId={selectedPatient}
          onNavigate={handleNavigate}
          isFullScreen={true}
          showQuickActions={true}
        />
      );
    }
    
    // Show four-panel dashboard
    return (
      <FourPanelDashboard
        patientId={selectedPatient}
        initialLayout={mode === 'clinical' ? 'clinical-focused' : 'default'}
        onNavigate={handleNavigate}
      />
    );
  };

  return (
    <AppLayout {...getLayoutProps()}>
      <Container size="xl" p={0}>
        <Stack gap="md">
          {/* Enhanced Navigation */}
          <EnhancedNavigation
            breadcrumbs={getBreadcrumbs()}
            title={getLayoutProps().title}
            subtitle={getLayoutProps().subtitle}
            showSearch={true}
            showShortcuts={true}
          />
          
          {/* View Mode Controls */}
          <Group justify="space-between" align="center">
            <Group gap="md">
              {selectedPatient && (
                <Badge 
                  leftSection={<IconUser size={12} />}
                  variant="light" 
                  color="blue"
                  size="lg"
                >
                  Patient: {selectedPatient}
                </Badge>
              )}
              
              <Badge 
                leftSection={<IconLayout size={12} />}
                variant="light" 
                color="green"
              >
                {viewMode === 'unified' ? 'Unified View' : 'Four-Panel View'}
              </Badge>
            </Group>
            
            {/* View Toggle - only show when appropriate */}
            {(selectedPatient || hasAnyRole(['physician', 'nurse'])) && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Panel View
                </Text>
                <Switch
                  checked={viewMode === 'unified'}
                  onChange={(event) => setViewMode(event.currentTarget.checked ? 'unified' : 'panels')}
                  onLabel="Unified"
                  offLabel="Panels"
                  size="md"
                />
                <Text size="sm" c="dimmed">
                  Unified View
                </Text>
              </Group>
            )}
          </Group>
          
          {/* Main Dashboard Content */}
          {renderDashboardContent()}
        </Stack>
      </Container>
    </AppLayout>
  );
}

export default DashboardIntegration;