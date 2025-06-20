"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationalMetricsService = void 0;
const common_1 = require("@nestjs/common");
const events_1 = require("events");
let OperationalMetricsService = class OperationalMetricsService extends events_1.EventEmitter {
    realTimeData = new Map();
    historicalMetrics = new Map();
    benchmarks = new Map();
    constructor() {
        super();
        this.initializeBenchmarks();
        this.startRealTimeMonitoring();
    }
    async getPatientFlowAnalytics(facilityId, period) {
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
    async getStaffUtilizationAnalytics(facilityId, period, departmentId) {
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
    async getAppointmentAnalytics(facilityId, period) {
        const appointmentData = await this.calculateAppointmentMetrics(facilityId, period);
        const appointmentTypes = await this.analyzeAppointmentTypes(facilityId, period);
        const providerUtilization = await this.calculateProviderUtilization(facilityId, period);
        return {
            ...appointmentData,
            appointmentTypes,
            providerUtilization
        };
    }
    async getQualityMetrics(facilityId, period) {
        const patientSatisfaction = await this.calculatePatientSatisfaction(facilityId, period);
        const clinicalMetrics = await this.calculateClinicalMetrics(facilityId, period);
        const safetyMetrics = await this.calculateSafetyMetrics(facilityId, period);
        return {
            patientSatisfaction,
            clinicalMetrics,
            safetyMetrics
        };
    }
    async getOperationalDashboard(facilityId) {
        const realTimeMetrics = await this.getRealTimeMetrics(facilityId);
        const todaysPerformance = await this.getTodaysPerformance(facilityId);
        const alerts = await this.getActiveAlerts(facilityId);
        const trends = await this.calculateTrends(facilityId);
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
    async getResourceUtilization(facilityId, period) {
        const roomUtilization = await this.calculateRoomUtilization(facilityId, period);
        const equipmentUtilization = await this.calculateEquipmentUtilization(facilityId, period);
        const recommendations = await this.generateResourceRecommendations(roomUtilization, equipmentUtilization);
        return {
            roomUtilization,
            equipmentUtilization,
            recommendations
        };
    }
    async generateOperationalInsights(facilityId) {
        const patientFlow = await this.getPatientFlowAnalytics(facilityId);
        const quality = await this.getQualityMetrics(facilityId, {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date()
        });
        const insights = [
            {
                category: 'Patient Flow',
                insight: patientFlow.averageWaitTime > 30 ?
                    'Patient wait times exceed benchmark - workflow optimization needed' :
                    'Patient flow performing within acceptable ranges',
                impact: patientFlow.averageWaitTime > 30 ? 'High' : 'Low',
                confidence: 0.85,
                recommendations: patientFlow.averageWaitTime > 30 ? [
                    'Analyze bottlenecks in check-in process',
                    'Consider additional staffing during peak hours',
                    'Implement patient flow management system'
                ] : ['Continue monitoring current performance']
            },
            {
                category: 'Quality',
                insight: quality.patientSatisfaction.overallScore < 4.0 ?
                    'Patient satisfaction below target - service improvements needed' :
                    'Patient satisfaction meeting performance targets',
                impact: quality.patientSatisfaction.overallScore < 4.0 ? 'Medium' : 'Low',
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
                predictedValue: patientFlow.averageWaitTime * 1.05,
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
    async calculateCurrentPatientFlow(facilityId) {
        return {
            totalPatients: 127,
            averageWaitTime: 18,
            averageVisitDuration: 45,
            patientThroughput: 85
        };
    }
    async identifyBottlenecks(facilityId) {
        return [
            {
                location: 'Check-in Desk',
                averageWaitTime: 12,
                impactedPatients: 45,
                severity: 'Medium'
            },
            {
                location: 'Lab Draw Station',
                averageWaitTime: 25,
                impactedPatients: 28,
                severity: 'High'
            },
            {
                location: 'Exam Room 3',
                averageWaitTime: 8,
                impactedPatients: 15,
                severity: 'Low'
            }
        ];
    }
    async getHourlyFlowData(facilityId, period) {
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
    async calculateStaffUtilization(facilityId, period, departmentId) {
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
    async calculateOvertimeMetrics(facilityId, period, departmentId) {
        return {
            totalOvertimeHours: 48,
            overtimeCost: 2880,
            staffWithOvertime: 3
        };
    }
    async generateStaffingRecommendations(staffMetrics, overtimeMetrics) {
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
    async calculateAppointmentMetrics(facilityId, period) {
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
            averageLeadTime: 14
        };
    }
    async analyzeAppointmentTypes(facilityId, period) {
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
    async calculateProviderUtilization(facilityId, period) {
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
    async calculatePatientSatisfaction(facilityId, period) {
        return {
            overallScore: 4.2,
            responseRate: 65,
            npsScore: 32,
            categories: [
                {
                    category: 'Communication',
                    score: 4.3,
                    benchmark: 4.5,
                    trend: 'Improving'
                },
                {
                    category: 'Wait Time',
                    score: 3.8,
                    benchmark: 4.0,
                    trend: 'Stable'
                },
                {
                    category: 'Staff Courtesy',
                    score: 4.5,
                    benchmark: 4.3,
                    trend: 'Stable'
                },
                {
                    category: 'Facility Cleanliness',
                    score: 4.6,
                    benchmark: 4.4,
                    trend: 'Improving'
                }
            ]
        };
    }
    async calculateClinicalMetrics(facilityId, period) {
        return {
            readmissionRate: 8.5,
            complicationRate: 2.1,
            infectionRate: 0.8,
            mortalityRate: 0.2,
            lengthOfStay: 3.2
        };
    }
    async calculateSafetyMetrics(facilityId, period) {
        return {
            adverseEvents: 12,
            nearMisses: 45,
            safetyScore: 92,
            incidentsByType: [
                {
                    type: 'Medication Error',
                    count: 8,
                    severity: 'Medium'
                },
                {
                    type: 'Fall',
                    count: 3,
                    severity: 'High'
                },
                {
                    type: 'Equipment Malfunction',
                    count: 2,
                    severity: 'Low'
                }
            ]
        };
    }
    async getRealTimeMetrics(facilityId) {
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
    async getTodaysPerformance(facilityId) {
        return {
            appointmentsScheduled: 85,
            appointmentsCompleted: 67,
            walkInsProcessed: 12,
            patientSatisfactionToday: 4.3,
            revenueToday: 18500
        };
    }
    async getActiveAlerts(facilityId) {
        return [
            {
                id: 'ALERT001',
                type: 'Warning',
                title: 'High Wait Times',
                message: 'Average wait time in Lab Draw Station exceeds 20 minutes',
                timestamp: new Date(),
                acknowledged: false
            },
            {
                id: 'ALERT002',
                type: 'Info',
                title: 'Room Utilization',
                message: 'Exam Room 5 has been available for over 2 hours',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
                acknowledged: true
            }
        ];
    }
    async calculateTrends(facilityId) {
        return {
            patientVolumeTrend: 'Up',
            waitTimeTrend: 'Stable',
            satisfactionTrend: 'Up'
        };
    }
    async calculateRoomUtilization(facilityId, period) {
        return [
            {
                roomId: 'ROOM001',
                roomName: 'Exam Room 1',
                roomType: 'Exam',
                utilizationRate: 85.2,
                totalBookedHours: 136,
                availableHours: 160,
                turnaroundTime: 12
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
    async calculateEquipmentUtilization(facilityId, period) {
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
    async generateResourceRecommendations(roomUtil, equipUtil) {
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
    async getDepartmentName(departmentId) {
        const departments = {
            'DEPT001': 'Emergency Department',
            'DEPT002': 'Internal Medicine',
            'DEPT003': 'Cardiology',
            'DEPT004': 'Orthopedics'
        };
        return departments[departmentId] || 'Unknown Department';
    }
    startRealTimeMonitoring() {
        setInterval(() => {
            this.emit('real-time-update', {
                timestamp: new Date(),
                metrics: {
                    currentPatients: Math.floor(Math.random() * 50) + 20,
                    waitingPatients: Math.floor(Math.random() * 15) + 5,
                    averageWaitTime: Math.floor(Math.random() * 20) + 10
                }
            });
        }, 30000);
    }
    initializeBenchmarks() {
        this.benchmarks.set('average-wait-time', 15);
        this.benchmarks.set('patient-satisfaction', 4.5);
        this.benchmarks.set('staff-utilization', 85);
        this.benchmarks.set('room-utilization', 80);
        this.benchmarks.set('no-show-rate', 10);
        this.benchmarks.set('cancellation-rate', 8);
    }
};
exports.OperationalMetricsService = OperationalMetricsService;
exports.OperationalMetricsService = OperationalMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], OperationalMetricsService);
//# sourceMappingURL=operational-metrics.service.js.map