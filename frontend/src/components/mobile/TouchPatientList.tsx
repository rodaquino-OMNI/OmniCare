'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Patient } from '@medplum/fhirtypes';
import {
  Card,
  Group,
  Text,
  Badge,
  Avatar,
  Stack,
  ActionIcon,
  Box,
  Skeleton,
  Alert,
  Button,
  Transition,
  Paper,
  ScrollArea,
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMessage,
  IconEye,
  IconChevronRight,
  IconX,
  IconAlertCircle,
  IconHeart,
  IconClock,
  IconCalendar,
  IconSearch,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMedplum } from '@medplum/react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { patientHelpers } from '@/lib/medplum';

interface SwipeablePatientCardProps {
  patient: Patient;
  onCall?: (patient: Patient) => void;
  onMessage?: (patient: Patient) => void;
  onView?: (patient: Patient) => void;
  className?: string;
}

interface TouchPosition {
  x: number;
  y: number;
}

function SwipeablePatientCard({ 
  patient, 
  onCall, 
  onMessage, 
  onView, 
  className 
}: SwipeablePatientCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  
  const startPos = useRef<TouchPosition>({ x: 0, y: 0 });
  const currentPos = useRef<TouchPosition>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  
  const { buttonPress, navigation, successAction } = useHapticFeedback();

  const SWIPE_THRESHOLD = 80;
  const ACTION_THRESHOLD = 120;
  const MAX_SWIPE = 160;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    currentPos.current = { x: touch.clientX, y: touch.clientY };
    setIsSwipeActive(true);
    setIsPressed(true);
    buttonPress();
  }, [buttonPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipeActive) return;

    const touch = e.touches[0];
    currentPos.current = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = touch.clientX - startPos.current.x;
    const deltaY = Math.abs(touch.clientY - startPos.current.y);
    
    // Only allow horizontal swipes
    if (deltaY > 30) {
      setIsSwipeActive(false);
      return;
    }

    // Prevent default to stop scrolling during horizontal swipe
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }

    // Only allow right swipe (positive deltaX)
    if (deltaX > 0) {
      const constrainedOffset = Math.min(deltaX, MAX_SWIPE);
      setSwipeOffset(constrainedOffset);
      setShowActions(constrainedOffset > SWIPE_THRESHOLD);
    }
  }, [isSwipeActive]);

  const handleTouchEnd = useCallback(() => {
    setIsSwipeActive(false);
    setIsPressed(false);
    
    if (swipeOffset > ACTION_THRESHOLD) {
      // Trigger default action (view patient)
      successAction();
      onView?.(patient);
      setSwipeOffset(0);
      setShowActions(false);
    } else if (swipeOffset > SWIPE_THRESHOLD) {
      // Keep actions visible
      setSwipeOffset(MAX_SWIPE);
      setShowActions(true);
      navigation();
    } else {
      // Snap back
      setSwipeOffset(0);
      setShowActions(false);
    }
  }, [swipeOffset, patient, onView, successAction, navigation]);

  const handleActionClick = useCallback((action: 'call' | 'message' | 'view', e: React.MouseEvent) => {
    e.stopPropagation();
    successAction();
    
    switch (action) {
      case 'call':
        onCall?.(patient);
        break;
      case 'message':
        onMessage?.(patient);
        break;
      case 'view':
        onView?.(patient);
        break;
    }
    
    // Hide actions after interaction
    setSwipeOffset(0);
    setShowActions(false);
  }, [patient, onCall, onMessage, onView, successAction]);

  const handleCardClick = useCallback(() => {
    if (!showActions) {
      buttonPress();
      onView?.(patient);
    }
  }, [showActions, patient, onView, buttonPress]);

  // Smooth animation for swipe offset
  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (!isSwipeActive) {
      const animate = () => {
        setSwipeOffset(prev => {
          const target = showActions ? MAX_SWIPE : 0;
          const diff = target - prev;
          if (Math.abs(diff) < 1) {
            return target;
          }
          return prev + diff * 0.2;
        });
      };
      
      const step = () => {
        animate();
        animationRef.current = requestAnimationFrame(step);
      };
      
      animationRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSwipeActive, showActions]);

  const name = patientHelpers.getFullName(patient);
  const mrn = patientHelpers.getMRN(patient);
  const age = patientHelpers.getAge(patient);
  const contact = patientHelpers.getContactInfo(patient);
  const hasAllergies = patient.extension?.some(ext => 
    ext.url?.includes('allergy') || ext.valueString?.toLowerCase().includes('allergy')
  );

  return (
    <Box
      pos="relative"
      className={`touch-none select-none ${className || ''}`}
      style={{ overflow: 'hidden' }}
    >
      {/* Action buttons background */}
      <Box
        pos="absolute"
        top={0}
        right={0}
        h="100%"
        w={MAX_SWIPE}
        style={{
          background: 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%)',
          transform: `translateX(${MAX_SWIPE - swipeOffset}px)`,
          transition: isSwipeActive ? 'none' : 'transform 0.3s ease',
        }}
      >
        <Group h="100%" justify="center" gap="xs" px="sm">
          <ActionIcon
            size="lg"
            color="blue"
            variant="light"
            onClick={(e) => handleActionClick('call', e)}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Call patient"
          >
            <IconPhone size={20} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            color="green"
            variant="light"
            onClick={(e) => handleActionClick('message', e)}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Message patient"
          >
            <IconMessage size={20} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            color="primary"
            variant="light"
            onClick={(e) => handleActionClick('view', e)}
            className="min-h-[44px] min-w-[44px]"
            aria-label="View patient details"
          >
            <IconEye size={20} />
          </ActionIcon>
        </Group>
      </Box>

      {/* Main card */}
      <Paper
        ref={cardRef}
        p="md"
        withBorder
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipeActive ? 'none' : 'transform 0.3s ease',
          backgroundColor: isPressed ? '#f8f9fa' : 'white',
          cursor: 'pointer',
          minHeight: '88px', // Ensure minimum touch target
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        <Group justify="space-between" align="flex-start">
          <Group gap="md" style={{ flex: 1 }}>
            <Avatar
              size="lg"
              color="primary"
              radius="md"
              className="min-h-[44px] min-w-[44px]"
            >
              <IconUser size={24} />
            </Avatar>
            
            <Box style={{ flex: 1 }}>
              <Group gap="xs" align="center">
                <Text fw={600} size="sm" truncate style={{ maxWidth: '200px' }}>
                  {name}
                </Text>
                {hasAllergies && (
                  <Badge color="red" size="xs" variant="filled">
                    <IconAlertCircle size={10} />
                  </Badge>
                )}
              </Group>
              
              <Text size="xs" c="dimmed" mb={4}>
                MRN: {mrn} • Age: {age}
              </Text>
              
              <Group gap="xs">
                <Badge
                  color={patient.active ? 'green' : 'gray'}
                  variant="light"
                  size="xs"
                >
                  {patient.active ? 'Active' : 'Inactive'}
                </Badge>
                
                {contact.phone && (
                  <Badge color="blue" variant="outline" size="xs">
                    <IconPhone size={10} style={{ marginRight: 4 }} />
                    Phone
                  </Badge>
                )}
                
                {patient.gender && (
                  <Badge color="gray" variant="outline" size="xs">
                    {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                  </Badge>
                )}
              </Group>
            </Box>
          </Group>

          <Group gap="xs" align="center">
            {showActions && (
              <Text size="xs" c="blue" fw={500}>
                Swipe →
              </Text>
            )}
            <IconChevronRight 
              size={16} 
              color="#9ca3af"
              style={{
                transform: `rotate(${Math.min(swipeOffset / MAX_SWIPE * 90, 90)}deg)`,
                transition: 'transform 0.1s ease',
              }}
            />
          </Group>
        </Group>
      </Paper>
    </Box>
  );
}

interface TouchPatientListProps {
  searchQuery?: string;
  limit?: number;
  showSearch?: boolean;
  onPatientCall?: (patient: Patient) => void;
  onPatientMessage?: (patient: Patient) => void;
  onPatientView?: (patient: Patient) => void;
  className?: string;
}

export function TouchPatientList({
  searchQuery = '',
  limit = 20,
  showSearch = true,
  onPatientCall,
  onPatientMessage,
  onPatientView,
  className,
}: TouchPatientListProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const medplum = useMedplum();
  const router = useRouter();
  const { successAction, errorAction } = useHapticFeedback();

  const defaultPatientCall = useCallback((patient: Patient) => {
    const contact = patientHelpers.getContactInfo(patient);
    if (contact.phone) {
      window.open(`tel:${contact.phone}`, '_self');
      successAction();
    } else {
      errorAction();
      alert('No phone number available for this patient');
    }
  }, [successAction, errorAction]);

  const defaultPatientMessage = useCallback((patient: Patient) => {
    const contact = patientHelpers.getContactInfo(patient);
    if (contact.phone) {
      window.open(`sms:${contact.phone}`, '_self');
      successAction();
    } else {
      errorAction();
      alert('No phone number available for this patient');
    }
  }, [successAction, errorAction]);

  const defaultPatientView = useCallback((patient: Patient) => {
    if (patient.id) {
      router.push(`/patients/${patient.id}`);
      successAction();
    }
  }, [router, successAction]);

  const loadPatients = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const searchParams: any = {
        _sort: '-_lastUpdated',
        _count: limit.toString(),
      };

      if (searchQuery) {
        searchParams._query = searchQuery;
      }

      const result = await medplum.searchResources('Patient', searchParams);
      setPatients(result);
      
      if (refresh) {
        successAction();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load patients';
      setError(errorMessage);
      errorAction();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [medplum, searchQuery, limit, successAction, errorAction]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleRefresh = useCallback(() => {
    loadPatients(true);
  }, [loadPatients]);

  const memoizedPatientCards = useMemo(() => {
    return patients.map((patient) => (
      <SwipeablePatientCard
        key={patient.id}
        patient={patient}
        onCall={onPatientCall || defaultPatientCall}
        onMessage={onPatientMessage || defaultPatientMessage}
        onView={onPatientView || defaultPatientView}
      />
    ));
  }, [patients, onPatientCall, onPatientMessage, onPatientView, defaultPatientCall, defaultPatientMessage, defaultPatientView]);

  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="red"
        variant="light"
        title="Error Loading Patients"
        action={
          <Button
            color="red"
            size="xs"
            variant="outline"
            onClick={handleRefresh}
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Stack gap="xs" className={className}>
      {/* Loading skeletons */}
      {isLoading && (
        <>
          {Array.from({ length: 5 }).map((_, index) => (
            <Paper key={index} p="md" withBorder>
              <Group>
                <Skeleton height={56} width={56} radius="md" />
                <Box style={{ flex: 1 }}>
                  <Skeleton height={16} width="60%" mb={8} />
                  <Skeleton height={12} width="40%" mb={8} />
                  <Group gap="xs">
                    <Skeleton height={18} width={60} radius="sm" />
                    <Skeleton height={18} width={40} radius="sm" />
                  </Group>
                </Box>
              </Group>
            </Paper>
          ))}
        </>
      )}

      {/* Patient cards */}
      {!isLoading && patients.length > 0 && (
        <ScrollArea.Autosize maxHeight="calc(100vh - 200px)">
          <Stack gap="xs">
            {memoizedPatientCards}
          </Stack>
        </ScrollArea.Autosize>
      )}

      {/* Empty state */}
      {!isLoading && patients.length === 0 && (
        <Paper p="xl" ta="center">
          <IconSearch size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <Text size="lg" fw={500} mb="xs">
            No patients found
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            {searchQuery 
              ? 'Try adjusting your search criteria'
              : 'No patients have been added yet'
            }
          </Text>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Paper>
      )}

      {/* Pull to refresh indicator */}
      {refreshing && (
        <Box ta="center" py="sm">
          <Text size="sm" c="blue">
            Refreshing patients...
          </Text>
        </Box>
      )}
    </Stack>
  );
}

export default TouchPatientList;