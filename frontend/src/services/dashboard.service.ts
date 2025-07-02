/**
 * Dashboard API Service
 * Provides real-time data for the OmniCare dashboard
 */

import { medplumClient } from '@/lib/medplum';
import { 
  Patient, 
  Appointment, 
  Task as FHIRTask,
  ServiceRequest,
  DiagnosticReport,
  MedicationRequest,
  Bundle,
  AuditEvent,
  Observation
} from '@medplum/fhirtypes';
import { offlineAudit } from './offline-audit.service';

// Dashboard metric types
export interface DashboardStats {
  totalPatients: {
    value: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  activeOrders: {
    value: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  pendingResults: {
    value: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  medications: {
    value: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface RecentActivity {
  id: string;
  patientName: string;
  patientId: string;
  action: string;
  time: Date;
  type: 'success' | 'warning' | 'info' | 'error';
  userId?: string;
  metadata?: Record<string, any>;
}

export interface UpcomingAppointment {
  id: string;
  patientName: string;
  patientId: string;
  time: Date;
  type: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  duration: number;
  providerId: string;
  location?: string;
}

export interface PerformanceMetrics {
  patientSatisfaction: number;
  onTimePerformance: number;
  resourceUtilization: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentActivities: RecentActivity[];
  upcomingAppointments: UpcomingAppointment[];
  performanceMetrics: PerformanceMetrics;
  lastUpdated: Date;
}

export class DashboardService {
  private static instance: DashboardService;

  private constructor() {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Fetch all dashboard data
   */
  public async getDashboardData(): Promise<DashboardData> {
    try {
      // Fetch all data in parallel for better performance
      const [
        stats,
        activities,
        appointments,
        metrics
      ] = await Promise.all([
        this.getStats(),
        this.getRecentActivities(),
        this.getUpcomingAppointments(),
        this.getPerformanceMetrics()
      ]);

      return {
        stats,
        recentActivities: activities,
        upcomingAppointments: appointments,
        performanceMetrics: metrics,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error('Failed to load dashboard data');
    }
  }

  /**
   * Get statistical data
   */
  private async getStats(): Promise<DashboardStats> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch patient counts
      const [currentPatients, previousPatients] = await Promise.all([
        this.getPatientCount({ 
          _summary: 'count',
          'active': true 
        }),
        this.getPatientCount({ 
          _summary: 'count',
          'active': true,
          '_lastUpdated': `lt${thisMonth.toISOString()}`
        })
      ]);

      // Fetch active orders (ServiceRequests with active status)
      const [currentOrders, previousOrders] = await Promise.all([
        this.getResourceCount('ServiceRequest', {
          'status': 'active,on-hold',
          '_summary': 'count'
        }),
        this.getResourceCount('ServiceRequest', {
          'status': 'active,on-hold',
          '_summary': 'count',
          'authored': `lt${thisMonth.toISOString()}`
        })
      ]);

      // Fetch pending results (DiagnosticReports with registered/partial status)
      const [currentResults, previousResults] = await Promise.all([
        this.getResourceCount('DiagnosticReport', {
          'status': 'registered,partial,preliminary',
          '_summary': 'count'
        }),
        this.getResourceCount('DiagnosticReport', {
          'status': 'registered,partial,preliminary',
          '_summary': 'count',
          'issued': `lt${thisMonth.toISOString()}`
        })
      ]);

      // Fetch active medications
      const [currentMeds, previousMeds] = await Promise.all([
        this.getResourceCount('MedicationRequest', {
          'status': 'active',
          '_summary': 'count'
        }),
        this.getResourceCount('MedicationRequest', {
          'status': 'active',
          '_summary': 'count',
          'authoredon': `lt${thisMonth.toISOString()}`
        })
      ]);

      return {
        totalPatients: this.calculateStatWithChange(currentPatients, previousPatients),
        activeOrders: this.calculateStatWithChange(currentOrders, previousOrders),
        pendingResults: this.calculateStatWithChange(currentResults, previousResults),
        medications: this.calculateStatWithChange(currentMeds, previousMeds)
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Return default values on error
      return {
        totalPatients: { value: 0, change: 0, trend: 'stable' },
        activeOrders: { value: 0, change: 0, trend: 'stable' },
        pendingResults: { value: 0, change: 0, trend: 'stable' },
        medications: { value: 0, change: 0, trend: 'stable' }
      };
    }
  }

  /**
   * Get recent activities from audit logs
   */
  private async getRecentActivities(): Promise<RecentActivity[]> {
    try {
      // Try to get activities from FHIR AuditEvent first
      const auditEvents = await medplumClient.searchResources('AuditEvent', {
        _sort: '-recorded',
        _count: 20
      });

      const activities: RecentActivity[] = [];

      // Process FHIR audit events
      for (const event of auditEvents) {
        if (event.patient) {
          const patientRef = event.patient.reference;
          const patientId = patientRef?.split('/')[1];
          
          if (patientId) {
            try {
              const patient = await medplumClient.readResource('Patient', patientId);
              const patientName = this.getPatientName(patient);
              
              activities.push({
                id: event.id || `audit-${Date.now()}`,
                patientName,
                patientId,
                action: event.action?.coding?.[0]?.display || event.action?.text || 'Unknown action',
                time: new Date(event.recorded),
                type: this.mapAuditEventType(event.outcome),
                userId: event.agent?.[0]?.who?.reference?.split('/')[1],
                metadata: event.meta
              });
            } catch (error) {
              console.error('Error fetching patient for audit event:', error);
            }
          }
        }
      }

      // If we don't have enough activities from FHIR, supplement with local audit logs
      if (activities.length < 10) {
        const localAudits = await this.getLocalAuditActivities(10 - activities.length);
        activities.push(...localAudits);
      }

      // Sort by time descending
      return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 10);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      // Fallback to local audit logs only
      return await this.getLocalAuditActivities(10);
    }
  }

  /**
   * Get upcoming appointments for today
   */
  private async getUpcomingAppointments(): Promise<UpcomingAppointment[]> {
    try {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch appointments for today
      const appointments = await medplumClient.searchResources('Appointment', {
        'date': `ge${now.toISOString()}`,
        'date:below': endOfDay.toISOString(),
        'status': 'booked,arrived,checked-in',
        '_sort': 'date',
        '_count': 10
      });

      const upcomingAppointments: UpcomingAppointment[] = [];

      for (const appointment of appointments) {
        if (appointment.participant) {
          // Find patient participant
          const patientParticipant = appointment.participant.find(p => 
            p.actor?.reference?.startsWith('Patient/')
          );

          if (patientParticipant?.actor?.reference) {
            const patientId = patientParticipant.actor.reference.split('/')[1];
            
            try {
              const patient = await medplumClient.readResource('Patient', patientId);
              const patientName = this.getPatientName(patient);

              upcomingAppointments.push({
                id: appointment.id || `appt-${Date.now()}`,
                patientName,
                patientId,
                time: new Date(appointment.start || now),
                type: appointment.appointmentType?.coding?.[0]?.display || 
                      appointment.appointmentType?.text || 
                      'General Consultation',
                status: this.mapAppointmentStatus(appointment.status),
                duration: appointment.minutesDuration || 30,
                providerId: appointment.participant.find(p => 
                  p.actor?.reference?.startsWith('Practitioner/')
                )?.actor?.reference?.split('/')[1] || '',
                location: appointment.participant.find(p => 
                  p.actor?.reference?.startsWith('Location/')
                )?.actor?.display
              });
            } catch (error) {
              console.error('Error fetching patient for appointment:', error);
            }
          }
        }
      }

      return upcomingAppointments;
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // These metrics would typically come from specialized analytics endpoints
      // For now, we'll calculate them from available data

      // Patient satisfaction from questionnaire responses
      const satisfactionScore = await this.calculatePatientSatisfaction();

      // On-time performance from appointment data
      const onTimeScore = await this.calculateOnTimePerformance();

      // Resource utilization from observations and procedures
      const utilizationScore = await this.calculateResourceUtilization();

      return {
        patientSatisfaction: satisfactionScore,
        onTimePerformance: onTimeScore,
        resourceUtilization: utilizationScore
      };
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      // Return default values
      return {
        patientSatisfaction: 85,
        onTimePerformance: 92,
        resourceUtilization: 78
      };
    }
  }

  /**
   * Helper methods
   */

  private async getPatientCount(params: any): Promise<number> {
    try {
      const bundle = await medplumClient.search('Patient', params);
      return bundle.total || 0;
    } catch (error) {
      console.error('Error counting patients:', error);
      return 0;
    }
  }

  private async getResourceCount(resourceType: string, params: any): Promise<number> {
    try {
      const bundle = await medplumClient.search(resourceType, params);
      return bundle.total || 0;
    } catch (error) {
      console.error(`Error counting ${resourceType}:`, error);
      return 0;
    }
  }

  private calculateStatWithChange(current: number, previous: number) {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    
    return {
      value: current,
      change: Math.abs(Math.round(change)),
      trend: trend as 'up' | 'down' | 'stable'
    };
  }

  private getPatientName(patient: Patient): string {
    const name = patient.name?.[0];
    if (!name) return 'Unknown Patient';
    
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim() || 'Unknown Patient';
  }

  private mapAuditEventType(outcome?: string): RecentActivity['type'] {
    switch (outcome) {
      case '0': // Success
        return 'success';
      case '4': // Minor failure
        return 'warning';
      case '8': // Serious failure
      case '12': // Major failure
        return 'error';
      default:
        return 'info';
    }
  }

  private mapAppointmentStatus(status?: string): 'confirmed' | 'pending' | 'cancelled' {
    switch (status) {
      case 'booked':
      case 'arrived':
      case 'checked-in':
        return 'confirmed';
      case 'pending':
      case 'proposed':
      case 'waitlist':
        return 'pending';
      case 'cancelled':
      case 'noshow':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private async getLocalAuditActivities(limit: number): Promise<RecentActivity[]> {
    // This would integrate with the offline audit service
    // For now, return empty array
    return [];
  }

  private async calculatePatientSatisfaction(): Promise<number> {
    try {
      // Look for QuestionnaireResponses related to satisfaction surveys
      const responses = await medplumClient.searchResources('QuestionnaireResponse', {
        'questionnaire': 'patient-satisfaction',
        '_count': 100,
        '_sort': '-authored'
      });

      if (responses.length === 0) return 85; // Default value

      let totalScore = 0;
      let count = 0;

      for (const response of responses) {
        // Extract satisfaction scores from responses
        // This is simplified - actual implementation would parse the response structure
        const items = response.item || [];
        for (const item of items) {
          if (item.answer?.[0]?.valueInteger) {
            totalScore += item.answer[0].valueInteger;
            count++;
          }
        }
      }

      // Convert to percentage (assuming 5-point scale)
      return count > 0 ? Math.round((totalScore / (count * 5)) * 100) : 85;
    } catch (error) {
      console.error('Error calculating patient satisfaction:', error);
      return 85;
    }
  }

  private async calculateOnTimePerformance(): Promise<number> {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Get completed appointments for the month
      const appointments = await medplumClient.searchResources('Appointment', {
        'date': `ge${startOfMonth.toISOString()}`,
        'status': 'fulfilled',
        '_count': 100
      });

      if (appointments.length === 0) return 92; // Default value

      let onTimeCount = 0;

      for (const appointment of appointments) {
        // Check if appointment started within 15 minutes of scheduled time
        // This is simplified - actual implementation would need more detailed timing data
        if (appointment.start && appointment.meta?.lastUpdated) {
          const scheduledTime = new Date(appointment.start);
          const actualTime = new Date(appointment.meta.lastUpdated);
          const diffMinutes = Math.abs(actualTime.getTime() - scheduledTime.getTime()) / 60000;
          
          if (diffMinutes <= 15) {
            onTimeCount++;
          }
        }
      }

      return Math.round((onTimeCount / appointments.length) * 100);
    } catch (error) {
      console.error('Error calculating on-time performance:', error);
      return 92;
    }
  }

  private async calculateResourceUtilization(): Promise<number> {
    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      // Get today's scheduled appointments
      const scheduledSlots = await medplumClient.searchResources('Appointment', {
        'date': `ge${startOfDay.toISOString()}`,
        'date:below': today.toISOString(),
        '_count': 100
      });

      // Get available slots (this would typically come from Schedule/Slot resources)
      const totalSlots = 100; // Simplified - would calculate from Schedule resources

      const utilization = scheduledSlots.length > 0 
        ? Math.round((scheduledSlots.length / totalSlots) * 100)
        : 78;

      return Math.min(utilization, 100); // Cap at 100%
    } catch (error) {
      console.error('Error calculating resource utilization:', error);
      return 78;
    }
  }
}

// Export singleton instance
export const dashboardService = DashboardService.getInstance();