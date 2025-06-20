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
export declare class OperationalMetricsService extends EventEmitter {
    private realTimeData;
    private historicalMetrics;
    private benchmarks;
    constructor();
    getPatientFlowAnalytics(facilityId: string, period?: {
        start: Date;
        end: Date;
    }): Promise<PatientFlowMetrics>;
    getStaffUtilizationAnalytics(facilityId: string, period: {
        start: Date;
        end: Date;
    }, departmentId?: string): Promise<StaffUtilizationMetrics>;
    getAppointmentAnalytics(facilityId: string, period: {
        start: Date;
        end: Date;
    }): Promise<AppointmentAnalytics>;
    getQualityMetrics(facilityId: string, period: {
        start: Date;
        end: Date;
    }): Promise<QualityMetrics>;
    getOperationalDashboard(facilityId: string): Promise<OperationalDashboard>;
    getResourceUtilization(facilityId: string, period: {
        start: Date;
        end: Date;
    }): Promise<{
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
    }>;
    generateOperationalInsights(facilityId: string): Promise<{
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
    }>;
    private calculateCurrentPatientFlow;
    private identifyBottlenecks;
    private getHourlyFlowData;
    private calculateStaffUtilization;
    private calculateOvertimeMetrics;
    private generateStaffingRecommendations;
    private calculateAppointmentMetrics;
    private analyzeAppointmentTypes;
    private calculateProviderUtilization;
    private calculatePatientSatisfaction;
    private calculateClinicalMetrics;
    private calculateSafetyMetrics;
    private getRealTimeMetrics;
    private getTodaysPerformance;
    private getActiveAlerts;
    private calculateTrends;
    private calculateRoomUtilization;
    private calculateEquipmentUtilization;
    private generateResourceRecommendations;
    private getDepartmentName;
    private startRealTimeMonitoring;
    private initializeBenchmarks;
}
//# sourceMappingURL=operational-metrics.service.d.ts.map