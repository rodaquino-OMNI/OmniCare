'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import {
  Card,
  Grid,
  Text,
  Group,
  Button,
  TextInput,
  Select,
  Stack,
  Badge,
  Modal,
  LoadingOverlay,
  Alert,
  Paper,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconCalendar, 
  IconClock, 
  IconUser, 
  IconPhone,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconSearch,
  IconPlus
} from '@tabler/icons-react';
import { Appointment, Provider, Patient } from '@/types/administrative';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

interface AppointmentManagementProps {
  userRole: string;
  facilityId: string;
}

interface AppointmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

const AppointmentManagement: React.FC<AppointmentManagementProps> = ({ userRole, facilityId }) => {
  const [currentView, setCurrentView] = useState<View>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  useEffect(() => {
    fetchAppointmentData();
  }, [currentDate, facilityId]);

  const fetchAppointmentData = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API calls
      const mockProviders: Provider[] = [
        {
          id: 'PROV-001',
          firstName: 'Sarah',
          lastName: 'Johnson',
          title: 'MD',
          specialty: 'Internal Medicine',
          npi: '1234567890',
          licenseNumber: 'MD123456',
          email: 'sarah.johnson@omnicare.com',
          phone: '(555) 123-4567',
          schedule: [
            { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isAvailable: true },
            { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isAvailable: true },
            { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isAvailable: true },
            { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isAvailable: true },
            { dayOfWeek: 5, startTime: '08:00', endTime: '12:00', isAvailable: true },
          ],
          isActive: true,
          facilityIds: [facilityId]
        },
        {
          id: 'PROV-002',
          firstName: 'Michael',
          lastName: 'Chen',
          title: 'MD',
          specialty: 'Cardiology',
          npi: '0987654321',
          licenseNumber: 'MD789012',
          email: 'michael.chen@omnicare.com',
          phone: '(555) 234-5678',
          schedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '16:00', isAvailable: true },
            { dayOfWeek: 3, startTime: '09:00', endTime: '16:00', isAvailable: true },
            { dayOfWeek: 5, startTime: '09:00', endTime: '16:00', isAvailable: true },
          ],
          isActive: true,
          facilityIds: [facilityId]
        }
      ];

      const mockPatients: Patient[] = [
        {
          id: 'PAT-001',
          firstName: 'John',
          lastName: 'Smith',
          dateOfBirth: new Date('1980-05-15'),
          gender: 'M',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'USA',
            addressType: 'Home'
          },
          phone: [{ number: '(555) 111-2222', type: 'Home', isPrimary: true }],
          emergencyContact: { name: 'Jane Smith', relationship: 'Spouse', phone: '(555) 111-3333' },
          insurance: [],
          maritalStatus: 'Married',
          employmentStatus: 'Employed',
          preferredLanguage: 'English',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'Active'
        }
      ];

      const mockAppointments: Appointment[] = [
        {
          id: 'APT-001',
          patientId: 'PAT-001',
          providerId: 'PROV-001',
          facilityId: facilityId,
          appointmentType: 'Follow-up',
          startTime: new Date(2024, 0, 15, 10, 0), // Jan 15, 2024, 10:00 AM
          endTime: new Date(2024, 0, 15, 10, 30),
          duration: 30,
          status: 'Scheduled',
          reasonForVisit: 'Follow-up for hypertension',
          notes: 'Patient reports feeling better on new medication',
          roomId: 'ROOM-101',
          remindersSent: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'APT-002',
          patientId: 'PAT-001',
          providerId: 'PROV-002',
          facilityId: facilityId,
          appointmentType: 'Consultation',
          startTime: new Date(2024, 0, 16, 14, 0), // Jan 16, 2024, 2:00 PM
          endTime: new Date(2024, 0, 16, 15, 0),
          duration: 60,
          status: 'Confirmed',
          reasonForVisit: 'Cardiology consultation for chest pain',
          notes: 'Referred by Dr. Johnson',
          roomId: 'ROOM-203',
          remindersSent: [
            { type: 'SMS', sentAt: new Date(), status: 'Delivered' }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      setProviders(mockProviders);
      setPatients(mockPatients);
      setAppointments(mockAppointments);
    } catch (error) {
      console.error('Failed to fetch appointment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient';
  };

  const getProviderName = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    return provider ? `Dr. ${provider.firstName} ${provider.lastName}` : 'Unknown Provider';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'blue';
      case 'Confirmed': return 'green';
      case 'Checked In': return 'yellow';
      case 'In Progress': return 'violet';
      case 'Completed': return 'gray';
      case 'Cancelled': return 'red';
      case 'No Show': return 'orange';
      default: return 'gray';
    }
  };

  const events: AppointmentEvent[] = appointments
    .filter(appointment => {
      if (filterStatus !== 'all' && appointment.status !== filterStatus) return false;
      if (filterProvider !== 'all' && appointment.providerId !== filterProvider) return false;
      if (searchTerm) {
        const patientName = getPatientName(appointment.patientId).toLowerCase();
        const providerName = getProviderName(appointment.providerId).toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        return patientName.includes(searchLower) || 
               providerName.includes(searchLower) ||
               appointment.reasonForVisit.toLowerCase().includes(searchLower);
      }
      return true;
    })
    .map(appointment => ({
      id: appointment.id,
      title: `${getPatientName(appointment.patientId)} - ${appointment.appointmentType}`,
      start: appointment.startTime,
      end: appointment.endTime,
      resource: appointment
    }));

  const handleSelectEvent = (event: AppointmentEvent) => {
    setSelectedAppointment(event.resource);
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    // Open scheduling modal for the selected time slot
    setShowScheduleModal(true);
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      // Update appointment status - replace with actual API call
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: newStatus as any, updatedAt: new Date() }
            : apt
        )
      );
      
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment(prev => 
          prev ? { ...prev, status: newStatus as any } : null
        );
      }
    } catch (error) {
      console.error('Failed to update appointment status:', error);
    }
  };

  const eventStyleGetter = (event: AppointmentEvent) => {
    const appointment = event.resource;
    let backgroundColor = '#3174ad';
    
    switch (appointment.status) {
      case 'Scheduled': backgroundColor = '#3b82f6'; break;
      case 'Confirmed': backgroundColor = '#10b981'; break;
      case 'Checked In': backgroundColor = '#f59e0b'; break;
      case 'In Progress': backgroundColor = '#8b5cf6'; break;
      case 'Completed': backgroundColor = '#6b7280'; break;
      case 'Cancelled': backgroundColor = '#ef4444'; break;
      case 'No Show': backgroundColor = '#f97316'; break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: 400 }}>
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  return (
    <Stack gap="xl">
      {/* Header */}
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <div>
            <Text size="xl" fw={700}>Appointment Management</Text>
            <Text c="dimmed">Schedule and manage patient appointments</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowScheduleModal(true)}
          >
            Schedule Appointment
          </Button>
        </Group>
      </Paper>

      {/* Filters and Search */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              placeholder="Search patients, providers, or reason for visit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              placeholder="All Statuses"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || 'all')}
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Scheduled', label: 'Scheduled' },
                { value: 'Confirmed', label: 'Confirmed' },
                { value: 'Checked In', label: 'Checked In' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Cancelled', label: 'Cancelled' },
                { value: 'No Show', label: 'No Show' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Select
              placeholder="All Providers"
              value={filterProvider}
              onChange={(value) => setFilterProvider(value || 'all')}
              data={[
                { value: 'all', label: 'All Providers' },
                ...providers.map(provider => ({
                  value: provider.id,
                  label: `Dr. ${provider.firstName} ${provider.lastName}`
                }))
              ]}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* Calendar */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={600}>
            Appointment Calendar
          </Text>
          <Group gap="sm">
            <Button
              variant={currentView === 'day' ? 'filled' : 'light'}
              size="sm"
              onClick={() => setCurrentView('day')}
            >
              Day
            </Button>
            <Button
              variant={currentView === 'week' ? 'filled' : 'light'}
              size="sm"
              onClick={() => setCurrentView('week')}
            >
              Week
            </Button>
            <Button
              variant={currentView === 'month' ? 'filled' : 'light'}
              size="sm"
              onClick={() => setCurrentView('month')}
            >
              Month
            </Button>
          </Group>
        </Group>
        
        <div style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={currentView}
            onView={setCurrentView}
            date={currentDate}
            onNavigate={setCurrentDate}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            eventPropGetter={eventStyleGetter}
            step={15}
            timeslots={4}
            min={new Date(0, 0, 0, 7, 0, 0)} // 7 AM
            max={new Date(0, 0, 0, 19, 0, 0)} // 7 PM
            formats={{
              timeGutterFormat: 'h:mm A',
              eventTimeRangeFormat: ({ start, end }) => 
                `${moment(start).format('h:mm A')} - ${moment(end).format('h:mm A')}`
            }}
          />
        </div>
      </Card>

      {/* Daily Summary Cards */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm">
              <IconCalendar size={20} className="text-gray-400" />
              <div>
                <Text size="sm" c="dimmed">Today's Appointments</Text>
                <Text size="lg" fw={700}>
                  {appointments.filter(apt => 
                    moment(apt.startTime).isSame(moment(), 'day')
                  ).length}
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm">
              <IconCheck size={20} className="text-green-400" />
              <div>
                <Text size="sm" c="dimmed">Confirmed Appointments</Text>
                <Text size="lg" fw={700}>
                  {appointments.filter(apt => 
                    apt.status === 'Confirmed' && moment(apt.startTime).isSame(moment(), 'day')
                  ).length}
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group gap="sm">
              <IconAlertTriangle size={20} className="text-yellow-400" />
              <div>
                <Text size="sm" c="dimmed">Pending Confirmations</Text>
                <Text size="lg" fw={700}>
                  {appointments.filter(apt => 
                    apt.status === 'Scheduled' && moment(apt.startTime).isSame(moment(), 'day')
                  ).length}
                </Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Appointment Details Modal */}
      <Modal
        opened={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment Details"
        size="lg"
      >
        {selectedAppointment && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Patient</Text>
                <Text fw={500}>{getPatientName(selectedAppointment.patientId)}</Text>
              </Grid.Col>
              
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Provider</Text>
                <Text fw={500}>{getProviderName(selectedAppointment.providerId)}</Text>
              </Grid.Col>

              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Date & Time</Text>
                <Text fw={500}>
                  {moment(selectedAppointment.startTime).format('MMMM Do, YYYY')}
                  <br />
                  {moment(selectedAppointment.startTime).format('h:mm A')} - {moment(selectedAppointment.endTime).format('h:mm A')}
                </Text>
              </Grid.Col>

              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Status</Text>
                <Badge color={getStatusColor(selectedAppointment.status)}>
                  {selectedAppointment.status}
                </Badge>
              </Grid.Col>

              <Grid.Col span={12}>
                <Text size="sm" c="dimmed">Reason for Visit</Text>
                <Text>{selectedAppointment.reasonForVisit}</Text>
              </Grid.Col>

              {selectedAppointment.notes && (
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">Notes</Text>
                  <Text>{selectedAppointment.notes}</Text>
                </Grid.Col>
              )}
            </Grid>

            {/* Status Update Actions */}
            <div>
              <Text size="sm" c="dimmed" mb="sm">Update Status</Text>
              <Group gap="sm">
                {['Confirmed', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'No Show'].map(status => (
                  <Button
                    key={status}
                    size="xs"
                    variant={selectedAppointment.status === status ? 'filled' : 'light'}
                    onClick={() => handleStatusUpdate(selectedAppointment.id, status)}
                    disabled={selectedAppointment.status === status}
                  >
                    {status}
                  </Button>
                ))}
              </Group>
            </div>

            {/* Quick Actions */}
            <div>
              <Text size="sm" c="dimmed" mb="sm">Quick Actions</Text>
              <Group gap="sm">
                <Button variant="light" leftSection={<IconPhone size={16} />} size="sm">
                  Call Patient
                </Button>
                <Button variant="light" leftSection={<IconCalendar size={16} />} size="sm">
                  Reschedule
                </Button>
                <Button variant="light" leftSection={<IconUser size={16} />} size="sm">
                  View Patient
                </Button>
              </Group>
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default AppointmentManagement;