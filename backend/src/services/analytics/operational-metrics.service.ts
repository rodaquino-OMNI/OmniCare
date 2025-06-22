/**
 * Operational Metrics Analytics Service
 * 
 * Comprehensive operational analytics including patient flow,
 * staff utilization, appointment analytics, and operational KPIs
 */

import { EventEmitter } from 'events';

export interface PatientFlowMetrics {
  totalPatients: number;
  averageWaitTime: number;
  averageVisitDuration: number;
  patientThroughput: number;
  bottlenecks: Array<{
    location: string;
    averageWaitTime: number;
    impactedPatients: number;
    severity: 'High' | 'Medium' | 'Low';
  }>;
  hourlyFlow: Array<{
    hour: number;
    checkedIn: number;
    inProgress: number;
    completed: number;
    averageWaitTime: number;
  }>;
}

export interface StaffUtilizationMetrics {
  departmentId?: string;
  departmentName?: string;
  totalStaff: number;
  averageUtilization: number;
  staffMetrics: Array<{
    staffId: string;
    staffName: string;
    role: string;
    scheduledHours: number;
    actualHours: number;
    utilizationRate: number;
    patientsSeen: number;
    avgTimePerPatient: number;
    productivityScore: number;
  }>;
  overtimeMetrics: {
    totalOvertimeHours: number;
    overtimeCost: number;
    staffWithOvertime: number;
  };
  recommendations: Array<{
    type: 'Staffing' | 'Scheduling' | 'Workflow';
    recommendation: string;
    expectedImpact: string;
    priority: 'High' | 'Medium' | 'Low';
  }>;
}

export interface AppointmentAnalytics {
  totalAppointments: number;
  scheduledAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  averageLeadTime: number;
  appointmentTypes: Array<{
    type: string;
    count: number;
    percentage: number;
    averageDuration: number;
    noShowRate: number;
  }>;
  providerUtilization: Array<{
    providerId: string;
    providerName: string;
    scheduledSlots: number;
    filledSlots: number;
    utilizationRate: number;
    averageAppointmentDuration: number;
  }>;
}

export interface QualityMetrics {
  patientSatisfaction: {
    overallScore: number;
    responseRate: number;
    npsScore: number;
    categories: Array<{
      category: string;
      score: number;
      benchmark: number;
      trend: 'Improving' | 'Stable' | 'Declining';
    }>;
  };
  clinicalMetrics: {
    readmissionRate: number;
    complicationRate: number;
    infectionRate: number;
    mortalityRate: number;
    lengthOfStay: number;
  };
  safetyMetrics: {
    adverseEvents: number;
    nearMisses: number;
    safetyScore: number;
    incidentsByType: Array<{
      type: string;
      count: number;
      severity: 'Critical' | 'High' | 'Medium' | 'Low';
    }>;
  };
}

export interface OperationalDashboard {
  realTimeMetrics: {
    currentlyInFacility: number;
    waitingPatients: number;
    inProgressEncounters: number;
    completedToday: number;
    averageWaitTime: number;
    staffOnDuty: number;
    availableRooms: number;
  };
  todaysPerformance: {
    appointmentsScheduled: number;
    appointmentsCompleted: number;
    walkInsProcessed: number;
    patientSatisfactionToday: number;
    revenueToday: number;
  };
  alerts: Array<{
    id: string;
    type: 'Critical' | 'Warning' | 'Info';
    title: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
  trends: {
    patientVolumeTrend: 'Up' | 'Down' | 'Stable';
    waitTimeTrend: 'Up' | 'Down' | 'Stable';
    satisfactionTrend: 'Up' | 'Down' | 'Stable';
  };
}

export class OperationalMetricsService extends EventEmitter {
  private realTimeData: Map<string, any> = new Map();
  private historicalMetrics: Map<string, any[]> = new Map();
  private benchmarks: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeBenchmarks();
    this.startRealTimeMonitoring();
  }

  /**
   * Get comprehensive patient flow analytics
   */
  async getPatientFlowAnalytics(
    facilityId: string,
    period?: { start: Date; end: Date }
  ): Promise<PatientFlowMetrics> {
    const currentFlow = await this.calculateCurrentPatientFlow(facilityId);
    const bottlenecks = await this.identifyBottlenecks(facilityId);
    const hourlyFlow = await this.getHourlyFlowData(facilityId, period);

    return {
      totalPatients: currentFlow.totalPatients,
      averageWaitTime: currentFlow.averageWaitTime,
      averageVisitDuration: currentFlow.averageVisitDuration,
      patientThroughput: currentFlow.patientThroughput,
      bottlenecks,
      hourlyFlow
    };
  }

  /**
   * Analyze staff utilization and productivity
   */
  async getStaffUtilizationAnalytics(
    facilityId: string,
    period: { start: Date; end: Date },
    departmentId?: string
  ): Promise<StaffUtilizationMetrics> {
    const staffMetrics = await this.calculateStaffUtilization(facilityId, period, departmentId);
    const overtimeMetrics = await this.calculateOvertimeMetrics(facilityId, period, departmentId);
    const recommendations = await this.generateStaffingRecommendations(staffMetrics, overtimeMetrics);

    const totalStaff = staffMetrics.length;
    const averageUtilization = staffMetrics.reduce((sum, s) => sum + s.utilizationRate, 0) / totalStaff;

    return {
      departmentId,
      departmentName: departmentId ? await this.getDepartmentName(departmentId) : 'All Departments',
      totalStaff,
      averageUtilization,
      staffMetrics,
      overtimeMetrics,
      recommendations
    };
  }

  /**
   * Get appointment analytics and scheduling insights
   */
  async getAppointmentAnalytics(
    facilityId: string,
    period: { start: Date; end: Date }
  ): Promise<AppointmentAnalytics> {
    const appointmentData = await this.calculateAppointmentMetrics(facilityId, period);
    const appointmentTypes = await this.analyzeAppointmentTypes(facilityId, period);
    const providerUtilization = await this.calculateProviderUtilization(facilityId, period);

    return {
      ...appointmentData,
      appointmentTypes,
      providerUtilization
    };
  }

  /**
   * Get quality and safety metrics
   */
  async getQualityMetrics(
    facilityId: string,
    period: { start: Date; end: Date }
  ): Promise<QualityMetrics> {
    const patientSatisfaction = await this.calculatePatientSatisfaction(facilityId, period);
    const clinicalMetrics = await this.calculateClinicalMetrics(facilityId, period);
    const safetyMetrics = await this.calculateSafetyMetrics(facilityId, period);

    return {
      patientSatisfaction,
      clinicalMetrics,
      safetyMetrics
    };
  }

  /**
   * Get real-time operational dashboard
   */
  async getOperationalDashboard(facilityId: string): Promise<OperationalDashboard> {
    const realTimeMetrics = await this.getRealTimeMetrics(facilityId);
    const todaysPerformance = await this.getTodaysPerformance(facilityId);
    const alerts = await this.getActiveAlerts(facilityId);
    const trends = await this.calculateTrends(facilityId);

    // Emit real-time update
    this.emit('dashboard-update', {
      facilityId,
      timestamp: new Date(),
      data: { realTimeMetrics, todaysPerformance, alerts, trends }
    });

    return {
      realTimeMetrics,
      todaysPerformance,
      alerts,
      trends
    };
  }

  /**
   * Analyze resource utilization (rooms, equipment)
   */
  async getResourceUtilization(
    facilityId: string,
    period: { start: Date; end: Date }
  ): Promise<{
    roomUtilization: Array<{
      roomId: string;
      roomName: string;
      roomType: string;
      utilizationRate: number;
      totalBookedHours: number;
      availableHours: number;
      turnaroundTime: number;
    }>;
    equipmentUtilization: Array<{
      equipmentId: string;
      equipmentName: string;
      utilizationRate: number;
      maintenanceHours: number;
      downtime: number;
      efficiency: number;
    }>;
    recommendations: Array<{
      resourceType: 'Room' | 'Equipment';
      resourceId: string;
      recommendation: string;
      expectedImpact: string;
      priority: 'High' | 'Medium' | 'Low';
    }>;
  }> {
    const roomUtilization = await this.calculateRoomUtilization(facilityId, period);
    const equipmentUtilization = await this.calculateEquipmentUtilization(facilityId, period);
    const recommendations = await this.generateResourceRecommendations(roomUtilization, equipmentUtilization);

    return {
      roomUtilization,
      equipmentUtilization,
      recommendations
    };
  }

  /**
   * Generate operational insights and predictions
   */
  async generateOperationalInsights(
    facilityId: string
  ): Promise<{
    insights: Array<{
      category: 'Patient Flow' | 'Staffing' | 'Quality' | 'Efficiency';
      insight: string;
      impact: 'High' | 'Medium' | 'Low';
      confidence: number;
      recommendations: string[];
    }>;
    predictions: Array<{
      metric: string;
      currentValue: number;
      predictedValue: number;
      timeframe: string;
      confidence: number;
      factors: string[];
    }>;
  }> {
    const patientFlow = await this.getPatientFlowAnalytics(facilityId);
    const quality = await this.getQualityMetrics(facilityId, {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    });

    const insights = [
      {
        category: 'Patient Flow' as const,
        insight: patientFlow.averageWaitTime > 30 ? 
          'Patient wait times exceed benchmark - workflow optimization needed' :
          'Patient flow performing within acceptable ranges',
        impact: patientFlow.averageWaitTime > 30 ? 'High' as const : 'Low' as const,
        confidence: 0.85,
        recommendations: patientFlow.averageWaitTime > 30 ? [
          'Analyze bottlenecks in check-in process',
          'Consider additional staffing during peak hours',
          'Implement patient flow management system'
        ] : ['Continue monitoring current performance']
      },
      {
        category: 'Quality' as const,
        insight: quality.patientSatisfaction.overallScore < 4.0 ?
          'Patient satisfaction below target - service improvements needed' :
          'Patient satisfaction meeting performance targets',
        impact: quality.patientSatisfaction.overallScore < 4.0 ? 'Medium' as const : 'Low' as const,
        confidence: 0.78,
        recommendations: quality.patientSatisfaction.overallScore < 4.0 ? [
          'Focus on communication and bedside manner training',
          'Reduce wait times and improve scheduling',
          'Implement patient feedback system'
        ] : ['Maintain current quality initiatives']
      }
    ];

    const predictions = [
      {
        metric: 'Average Wait Time',
        currentValue: patientFlow.averageWaitTime,
        predictedValue: patientFlow.averageWaitTime * 1.05, // 5% increase predicted
        timeframe: 'Next 30 days',
        confidence: 0.72,
        factors: ['Seasonal volume increase', 'Staff vacation schedules']
      },
      {
        metric: 'Patient Satisfaction',
        currentValue: quality.patientSatisfaction.overallScore,
        predictedValue: quality.patientSatisfaction.overallScore + 0.1,
        timeframe: 'Next quarter',
        confidence: 0.68,
        factors: ['Recent process improvements', 'Staff training initiatives']
      }
    ];

    return { insights, predictions };
  }

  private async calculateCurrentPatientFlow(facilityId: string): Promise<any> {
    // Mock implementation - would integrate with real-time EHR data
    return {
      totalPatients: 127,
      averageWaitTime: 18, // minutes
      averageVisitDuration: 45, // minutes
      patientThroughput: 85 // patients per day
    };
  }

  private async identifyBottlenecks(facilityId: string): Promise<any[]> {
    return [
      {
        location: 'Check-in Desk',
        averageWaitTime: 12,
        impactedPatients: 45,
        severity: 'Medium' as const
      },
      {
        location: 'Lab Draw Station',
        averageWaitTime: 25,
        impactedPatients: 28,
        severity: 'High' as const
      },
      {
        location: 'Exam Room 3',
        averageWaitTime: 8,
        impactedPatients: 15,
        severity: 'Low' as const
      }
    ];
  }

  private async getHourlyFlowData(facilityId: string, period?: any): Promise<any[]> {
    const hourlyData = [];
    
    for (let hour = 8; hour <= 18; hour++) {
      hourlyData.push({
        hour,
        checkedIn: Math.floor(Math.random() * 15) + 5,
        inProgress: Math.floor(Math.random() * 12) + 3,
        completed: Math.floor(Math.random() * 18) + 8,
        averageWaitTime: Math.floor(Math.random() * 20) + 10
      });
    }
    
    return hourlyData;
  }

  private async calculateStaffUtilization(
    facilityId: string,
    period: { start: Date; end: Date },
    departmentId?: string
  ): Promise<any[]> {
    return [
      {
        staffId: 'STAFF001',
        staffName: 'Sarah Johnson, RN',
        role: 'Registered Nurse',
        scheduledHours: 160,
        actualHours: 164,
        utilizationRate: 102.5,
        patientsSeen: 180,
        avgTimePerPatient: 35,
        productivityScore: 92
      },
      {
        staffId: 'STAFF002',
        staffName: 'Mike Chen, MA',
        role: 'Medical Assistant',
        scheduledHours: 160,
        actualHours: 155,
        utilizationRate: 96.9,
        patientsSeen: 220,
        avgTimePerPatient: 28,
        productivityScore: 88
      },
      {
        staffId: 'STAFF003',
        staffName: 'Lisa Rodriguez, RN',
        role: 'Registered Nurse',
        scheduledHours: 120,
        actualHours: 118,
        utilizationRate: 98.3,
        patientsSeen: 145,
        avgTimePerPatient: 32,
        productivityScore: 85
      }
    ];
  }

  private async calculateOvertimeMetrics(
    facilityId: string,
    period: { start: Date; end: Date },
    departmentId?: string
  ): Promise<any> {
    return {
      totalOvertimeHours: 48,
      overtimeCost: 2880, // $60/hour average
      staffWithOvertime: 3
    };
  }

  private async generateStaffingRecommendations(staffMetrics: any[], overtimeMetrics: any): Promise<any[]> {
    const recommendations = [];

    const avgUtilization = staffMetrics.reduce((sum, s) => sum + s.utilizationRate, 0) / staffMetrics.length;
    
    if (avgUtilization > 100) {
      recommendations.push({
        type: 'Staffing',
        recommendation: 'Consider adding additional staff to reduce overtime and improve work-life balance',
        expectedImpact: 'Reduce overtime costs by 30%, improve staff satisfaction',
        priority: 'High'
      });
    }

    if (overtimeMetrics.totalOvertimeHours > 40) {
      recommendations.push({
        type: 'Scheduling',
        recommendation: 'Optimize scheduling to better distribute workload and minimize overtime',
        expectedImpact: 'Reduce overtime hours by 25%',
        priority: 'Medium'
      });
    }

    return recommendations;
  }

  private async calculateAppointmentMetrics(facilityId: string, period: { start: Date; end: Date }): Promise<any> {
    const totalAppointments = 1250;
    const scheduledAppointments = 1200;
    const completedAppointments = 1050;
    const cancelledAppointments = 120;
    const noShowAppointments = 80;

    return {
      totalAppointments,
      scheduledAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      completionRate: (completedAppointments / scheduledAppointments) * 100,
      cancellationRate: (cancelledAppointments / scheduledAppointments) * 100,
      noShowRate: (noShowAppointments / scheduledAppointments) * 100,
      averageLeadTime: 14 // days
    };
  }

  private async analyzeAppointmentTypes(facilityId: string, period: { start: Date; end: Date }): Promise<any[]> {
    return [
      {
        type: 'Follow-up',
        count: 450,
        percentage: 42.9,
        averageDuration: 30,
        noShowRate: 6.2
      },
      {
        type: 'New Patient',
        count: 280,
        percentage: 26.7,
        averageDuration: 60,
        noShowRate: 8.5
      },
      {
        type: 'Annual Physical',
        count: 180,
        percentage: 17.1,
        averageDuration: 45,
        noShowRate: 4.8
      },
      {
        type: 'Urgent Care',
        count: 90,
        percentage: 8.6,
        averageDuration: 25,
        noShowRate: 12.1
      },
      {
        type: 'Procedure',
        count: 50,
        percentage: 4.8,
        averageDuration: 90,
        noShowRate: 3.2
      }
    ];
  }

  private async calculateProviderUtilization(facilityId: string, period: { start: Date; end: Date }): Promise<any[]> {
    return [
      {
        providerId: 'PROV001',
        providerName: 'Dr. Smith',
        scheduledSlots: 200,
        filledSlots: 185,
        utilizationRate: 92.5,
        averageAppointmentDuration: 35
      },
      {
        providerId: 'PROV002',
        providerName: 'Dr. Johnson',
        scheduledSlots: 180,
        filledSlots: 165,
        utilizationRate: 91.7,
        averageAppointmentDuration: 42
      },
      {
        providerId: 'PROV003',
        providerName: 'Dr. Williams',
        scheduledSlots: 160,
        filledSlots: 142,
        utilizationRate: 88.8,
        averageAppointmentDuration: 38
      }
    ];
  }

  private async calculatePatientSatisfaction(facilityId: string, period: { start: Date; end: Date }): Promise<any> {
    return {
      overallScore: 4.2,
      responseRate: 65,
      npsScore: 32,
      categories: [
        {
          category: 'Communication',
          score: 4.3,
          benchmark: 4.5,
          trend: 'Improving' as const
        },
        {
          category: 'Wait Time',
          score: 3.8,
          benchmark: 4.0,
          trend: 'Stable' as const
        },
        {
          category: 'Staff Courtesy',
          score: 4.5,
          benchmark: 4.3,
          trend: 'Stable' as const
        },
        {
          category: 'Facility Cleanliness',
          score: 4.6,
          benchmark: 4.4,
          trend: 'Improving' as const
        }
      ]
    };
  }

  private async calculateClinicalMetrics(facilityId: string, period: { start: Date; end: Date }): Promise<any> {
    return {
      readmissionRate: 8.5, // percentage
      complicationRate: 2.1,
      infectionRate: 0.8,
      mortalityRate: 0.2,
      lengthOfStay: 3.2 // days
    };
  }

  private async calculateSafetyMetrics(facilityId: string, period: { start: Date; end: Date }): Promise<any> {
    return {
      adverseEvents: 12,
      nearMisses: 45,
      safetyScore: 92,
      incidentsByType: [
        {
          type: 'Medication Error',
          count: 8,
          severity: 'Medium' as const
        },
        {
          type: 'Fall',
          count: 3,
          severity: 'High' as const
        },
        {
          type: 'Equipment Malfunction',
          count: 2,
          severity: 'Low' as const
        }
      ]
    };
  }

  private async getRealTimeMetrics(facilityId: string): Promise<any> {
    return {
      currentlyInFacility: 43,
      waitingPatients: 12,
      inProgressEncounters: 18,
      completedToday: 67,
      averageWaitTime: 15,
      staffOnDuty: 15,
      availableRooms: 8
    };
  }

  private async getTodaysPerformance(facilityId: string): Promise<any> {
    return {
      appointmentsScheduled: 85,
      appointmentsCompleted: 67,
      walkInsProcessed: 12,
      patientSatisfactionToday: 4.3,
      revenueToday: 18500
    };
  }

  private async getActiveAlerts(facilityId: string): Promise<any[]> {
    return [
      {
        id: 'ALERT001',
        type: 'Warning' as const,
        title: 'High Wait Times',
        message: 'Average wait time in Lab Draw Station exceeds 20 minutes',
        timestamp: new Date(),
        acknowledged: false
      },
      {
        id: 'ALERT002',
        type: 'Info' as const,
        title: 'Room Utilization',
        message: 'Exam Room 5 has been available for over 2 hours',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        acknowledged: true
      }
    ];
  }

  private async calculateTrends(facilityId: string): Promise<any> {
    return {
      patientVolumeTrend: 'Up' as const,
      waitTimeTrend: 'Stable' as const,
      satisfactionTrend: 'Up' as const
    };
  }

  private async calculateRoomUtilization(facilityId: string, period: { start: Date; end: Date }): Promise<any[]> {
    return [
      {
        roomId: 'ROOM001',
        roomName: 'Exam Room 1',
        roomType: 'Exam',
        utilizationRate: 85.2,
        totalBookedHours: 136,
        availableHours: 160,
        turnaroundTime: 12 // minutes
      },
      {
        roomId: 'ROOM002',
        roomName: 'Procedure Room A',
        roomType: 'Procedure',
        utilizationRate: 92.5,
        totalBookedHours: 148,
        availableHours: 160,
        turnaroundTime: 20
      }
    ];
  }

  private async calculateEquipmentUtilization(facilityId: string, period: { start: Date; end: Date }): Promise<any[]> {
    return [
      {
        equipmentId: 'EQ001',
        equipmentName: 'X-Ray Machine',
        utilizationRate: 78.5,
        maintenanceHours: 8,
        downtime: 2.5,
        efficiency: 92.3
      },
      {
        equipmentId: 'EQ002',
        equipmentName: 'EKG Machine',
        utilizationRate: 65.2,
        maintenanceHours: 4,
        downtime: 1.0,
        efficiency: 95.8
      }
    ];
  }

  private async generateResourceRecommendations(roomUtil: any[], equipUtil: any[]): Promise<any[]> {
    const recommendations = [];

    for (const room of roomUtil) {
      if (room.utilizationRate > 90) {
        recommendations.push({
          resourceType: 'Room',
          resourceId: room.roomId,
          recommendation: 'Consider adding capacity or optimizing scheduling',
          expectedImpact: 'Reduce wait times and improve patient flow',
          priority: 'High'
        });
      }
    }

    for (const equipment of equipUtil) {
      if (equipment.utilizationRate < 50) {
        recommendations.push({
          resourceType: 'Equipment',
          resourceId: equipment.equipmentId,
          recommendation: 'Evaluate need for this equipment or find additional uses',
          expectedImpact: 'Optimize resource allocation and reduce costs',
          priority: 'Medium'
        });
      }
    }

    return recommendations;
  }

  private async getDepartmentName(departmentId: string): Promise<string> {
    const departments: Record<string, string> = {
      'DEPT001': 'Emergency Department',
      'DEPT002': 'Internal Medicine',
      'DEPT003': 'Cardiology',
      'DEPT004': 'Orthopedics'
    };
    
    return departments[departmentId] || 'Unknown Department';
  }

  private startRealTimeMonitoring(): void {
    // Simulate real-time data updates
    setInterval(() => {
      this.emit('real-time-update', {
        timestamp: new Date(),
        metrics: {
          currentPatients: Math.floor(Math.random() * 50) + 20,
          waitingPatients: Math.floor(Math.random() * 15) + 5,
          averageWaitTime: Math.floor(Math.random() * 20) + 10
        }
      });
    }, 30000); // Update every 30 seconds
  }

  private initializeBenchmarks(): void {
    this.benchmarks.set('average-wait-time', 15);
    this.benchmarks.set('patient-satisfaction', 4.5);
    this.benchmarks.set('staff-utilization', 85);
    this.benchmarks.set('room-utilization', 80);
    this.benchmarks.set('no-show-rate', 10);
    this.benchmarks.set('cancellation-rate', 8);
  }
}