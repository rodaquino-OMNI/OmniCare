'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import { 
  CalendarIcon, 
  ClockIcon, 
  UserIcon, 
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
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
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Confirmed': return 'bg-green-100 text-green-800';
      case 'Checked In': return 'bg-yellow-100 text-yellow-800';
      case 'In Progress': return 'bg-purple-100 text-purple-800';
      case 'Completed': return 'bg-gray-100 text-gray-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'No Show': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Appointment Management</h1>
              <p className="text-gray-600 mt-1">Schedule and manage patient appointments</p>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Schedule Appointment
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search patients, providers, or reason for visit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                >
                  <option value="all">All Statuses</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Checked In">Checked In</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="No Show">No Show</option>
                </select>
              </div>

              <div>
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                >
                  <option value="all">All Providers</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      Dr. {provider.firstName} {provider.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Appointment Calendar</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentView('day')}
                  className={`px-3 py-1 text-sm rounded-md ${currentView === 'day' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Day
                </button>
                <button
                  onClick={() => setCurrentView('week')}
                  className={`px-3 py-1 text-sm rounded-md ${currentView === 'week' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Week
                </button>
                <button
                  onClick={() => setCurrentView('month')}
                  className={`px-3 py-1 text-sm rounded-md ${currentView === 'month' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Month
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
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
          </div>
        </div>

        {/* Appointment Details Modal */}
        {selectedAppointment && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Appointment Details</h3>
                  <button
                    onClick={() => setSelectedAppointment(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Patient</label>
                      <p className="text-lg text-gray-900">{getPatientName(selectedAppointment.patientId)}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Provider</label>
                      <p className="text-lg text-gray-900">{getProviderName(selectedAppointment.providerId)}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Date & Time</label>
                      <p className="text-lg text-gray-900">
                        {moment(selectedAppointment.startTime).format('MMMM Do, YYYY')}
                        <br />
                        {moment(selectedAppointment.startTime).format('h:mm A')} - {moment(selectedAppointment.endTime).format('h:mm A')}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAppointment.status)}`}>
                        {selectedAppointment.status}
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Reason for Visit</label>
                      <p className="text-gray-900">{selectedAppointment.reasonForVisit}</p>
                    </div>

                    {selectedAppointment.notes && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-500">Notes</label>
                        <p className="text-gray-900">{selectedAppointment.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Status Update Actions */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500 block mb-2">Update Status</label>
                    <div className="flex flex-wrap gap-2">
                      {['Confirmed', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'No Show'].map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusUpdate(selectedAppointment.id, status)}
                          disabled={selectedAppointment.status === status}
                          className={`px-3 py-1 text-sm rounded-md border ${
                            selectedAppointment.status === status
                              ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500 block mb-2">Quick Actions</label>
                    <div className="flex flex-wrap gap-2">
                      <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <PhoneIcon className="h-4 w-4 mr-1" />
                        Call Patient
                      </button>
                      <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        Reschedule
                      </button>
                      <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <UserIcon className="h-4 w-4 mr-1" />
                        View Patient
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Appointment Summary */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Today's Appointments
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {appointments.filter(apt => 
                        moment(apt.startTime).isSame(moment(), 'day')
                      ).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Confirmed Appointments
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {appointments.filter(apt => 
                        apt.status === 'Confirmed' && moment(apt.startTime).isSame(moment(), 'day')
                      ).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pending Confirmations
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {appointments.filter(apt => 
                        apt.status === 'Scheduled' && moment(apt.startTime).isSame(moment(), 'day')
                      ).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentManagement;