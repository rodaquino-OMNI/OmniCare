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
  Paper
} from '@mantine/core';
import { 
  IconCalendar, 
  IconUser, 
  IconPhone,
  IconCheck,
  IconAlertTriangle,
  IconSearch,
  IconPlus
} from '@tabler/icons-react';
import { Appointment, Provider, Patient } from '@/types/administrative';
import { getErrorMessage, getDisplayErrorMessage } from '@/utils/error.utils';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

interface AppointmentManagementProps {
  facilityId: string;
}

interface AppointmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

const AppointmentManagement: React.FC<AppointmentManagementProps> = ({ facilityId }) => {
  const [currentView, setCurrentView] = useState<View>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    fetchAppointmentData();
  }, [currentDate, facilityId]);

  const fetchAppointmentData = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API calls
      const mockProviders: Provider[] = [
        {
          id: 'PROV-ResourceHistoryTableResourceHistoryTable1',
          firstName: 'Sarah',
          lastName: 'Johnson',
          title: 'MD',
          specialty: 'Internal Medicine',
          npi: '123456789ResourceHistoryTable',
          licenseNumber: 'MD123456',
          email: 'sarah.johnson@omnicare.com',
          phone: '(555) 123-4567',
          schedule: [
            { dayOfWeek: 1, startTime: 'ResourceHistoryTable8:ResourceHistoryTableResourceHistoryTable', endTime: '17:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
            { dayOfWeek: 2, startTime: 'ResourceHistoryTable8:ResourceHistoryTableResourceHistoryTable', endTime: '17:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
            { dayOfWeek: 3, startTime: 'ResourceHistoryTable8:ResourceHistoryTableResourceHistoryTable', endTime: '17:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
            { dayOfWeek: 4, startTime: 'ResourceHistoryTable8:ResourceHistoryTableResourceHistoryTable', endTime: '17:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
            { dayOfWeek: 5, startTime: 'ResourceHistoryTable8:ResourceHistoryTableResourceHistoryTable', endTime: '12:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
          ],
          isActive: true,
          facilityIds: [facilityId]
        },
        {
          id: 'PROV-ResourceHistoryTableResourceHistoryTable2',
          firstName: 'Michael',
          lastName: 'Chen',
          title: 'MD',
          specialty: 'Cardiology',
          npi: 'ResourceHistoryTable987654321',
          licenseNumber: 'MD789ResourceHistoryTable12',
          email: 'michael.chen@omnicare.com',
          phone: '(555) 234-5678',
          schedule: [
            { dayOfWeek: 1, startTime: 'ResourceHistoryTable9:ResourceHistoryTableResourceHistoryTable', endTime: '16:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
            { dayOfWeek: 3, startTime: 'ResourceHistoryTable9:ResourceHistoryTableResourceHistoryTable', endTime: '16:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
            { dayOfWeek: 5, startTime: 'ResourceHistoryTable9:ResourceHistoryTableResourceHistoryTable', endTime: '16:ResourceHistoryTableResourceHistoryTable', isAvailable: true },
          ],
          isActive: true,
          facilityIds: [facilityId]
        }
      ];

      const mockPatients: Patient[] = [
        {
          id: 'PAT-ResourceHistoryTableResourceHistoryTable1',
          firstName: 'John',
          lastName: 'Smith',
          dateOfBirth: new Date('198ResourceHistoryTable-ResourceHistoryTable5-15'),
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
          id: 'APT-ResourceHistoryTableResourceHistoryTable1',
          patientId: 'PAT-ResourceHistoryTableResourceHistoryTable1',
          providerId: 'PROV-ResourceHistoryTableResourceHistoryTable1',
          facilityId: facilityId,
          appointmentType: 'Follow-up',
          startTime: new Date(2ResourceHistoryTable24, ResourceHistoryTable, 15, 1ResourceHistoryTable, ResourceHistoryTable), // Jan 15, 2ResourceHistoryTable24, 1ResourceHistoryTable:ResourceHistoryTableResourceHistoryTable AM
          endTime: new Date(2ResourceHistoryTable24, ResourceHistoryTable, 15, 1ResourceHistoryTable, 3ResourceHistoryTable),
          duration: 3ResourceHistoryTable,
          status: 'Scheduled',
          reasonForVisit: 'Follow-up for hypertension',
          notes: 'Patient reports feeling better on new medication',
          roomId: 'ROOM-1ResourceHistoryTable1',
          remindersSent: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'APT-ResourceHistoryTableResourceHistoryTable2',
          patientId: 'PAT-ResourceHistoryTableResourceHistoryTable1',
          providerId: 'PROV-ResourceHistoryTableResourceHistoryTable2',
          facilityId: facilityId,
          appointmentType: 'Consultation',
          startTime: new Date(2ResourceHistoryTable24, ResourceHistoryTable, 16, 14, ResourceHistoryTable), // Jan 16, 2ResourceHistoryTable24, 2:ResourceHistoryTableResourceHistoryTable PM
          endTime: new Date(2ResourceHistoryTable24, ResourceHistoryTable, 16, 15, ResourceHistoryTable),
          duration: 6ResourceHistoryTable,
          status: 'Confirmed',
          reasonForVisit: 'Cardiology consultation for chest pain',
          notes: 'Referred by Dr. Johnson',
          roomId: 'ROOM-2ResourceHistoryTable3',
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
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Failed to fetch appointment data:', errorMessage, error);
      // Could show user notification here if needed
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

  const handleSelectSlot = () => {
    // Open scheduling modal for the selected time slot
    console.log('Slot selected - scheduling modal functionality to be implemented');
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      // Update appointment status - replace with actual API call
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: newStatus as Appointment['status'], updatedAt: new Date() }
            : apt
        )
      );
      
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment(prev => 
          prev ? { ...prev, status: newStatus as Appointment['status'], updatedAt: new Date() } : null
        );
      }
    } catch (error: unknown) {
      const errorMessage = getDisplayErrorMessage(error);
      console.error('Failed to update appointment status:', errorMessage, error);
      // Show user-friendly error message
      // Could trigger a notification toast here
    }
  };

  const eventStyleGetter = (event: AppointmentEvent) => {
    const appointment = event.resource;
    let backgroundColor = '#3174ad';
    
    switch (appointment.status) {
      case 'Scheduled': backgroundColor = '#3b82f6'; break;
      case 'Confirmed': backgroundColor = '#1ResourceHistoryTableb981'; break;
      case 'Checked In': backgroundColor = '#f59eResourceHistoryTableb'; break;
      case 'In Progress': backgroundColor = '#8b5cf6'; break;
      case 'Completed': backgroundColor = '#6b728ResourceHistoryTable'; break;
      case 'Cancelled': backgroundColor = '#ef4444'; break;
      case 'No Show': backgroundColor = '#f97316'; break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: ResourceHistoryTable.8,
        color: 'white',
        border: 'ResourceHistoryTablepx',
        display: 'block'
      }
    };
  };

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: 4ResourceHistoryTableResourceHistoryTable }}>
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
            <Text size="xl" fw={7ResourceHistoryTableResourceHistoryTable}>Appointment Management</Text>
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
          <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable}>
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
        
        <div style={{ height: '6ResourceHistoryTableResourceHistoryTablepx' }}>
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
            min={new Date(ResourceHistoryTable, ResourceHistoryTable, ResourceHistoryTable, 7, ResourceHistoryTable, ResourceHistoryTable)} // 7 AM
            max={new Date(ResourceHistoryTable, ResourceHistoryTable, ResourceHistoryTable, 19, ResourceHistoryTable, ResourceHistoryTable)} // 7 PM
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
              <IconCalendar size={2ResourceHistoryTable} className="text-gray-4ResourceHistoryTableResourceHistoryTable" />
              <div>
                <Text size="sm" c="dimmed">Today&apos;s Appointments</Text>
                <Text size="lg" fw={7ResourceHistoryTableResourceHistoryTable}>
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
              <IconCheck size={2ResourceHistoryTable} className="text-green-4ResourceHistoryTableResourceHistoryTable" />
              <div>
                <Text size="sm" c="dimmed">Confirmed Appointments</Text>
                <Text size="lg" fw={7ResourceHistoryTableResourceHistoryTable}>
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
              <IconAlertTriangle size={2ResourceHistoryTable} className="text-yellow-4ResourceHistoryTableResourceHistoryTable" />
              <div>
                <Text size="sm" c="dimmed">Pending Confirmations</Text>
                <Text size="lg" fw={7ResourceHistoryTableResourceHistoryTable}>
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
                <Text fw={5ResourceHistoryTableResourceHistoryTable}>{getPatientName(selectedAppointment.patientId)}</Text>
              </Grid.Col>
              
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Provider</Text>
                <Text fw={5ResourceHistoryTableResourceHistoryTable}>{getProviderName(selectedAppointment.providerId)}</Text>
              </Grid.Col>

              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Date & Time</Text>
                <Text fw={5ResourceHistoryTableResourceHistoryTable}>
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