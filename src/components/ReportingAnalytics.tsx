'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  DocumentArrowDownIcon, 
  CalendarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowArrowTrendingUpIcon,
  ArrowArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Cell, Pie } from 'recharts';
import { OperationalReport, ReportType } from '@/types/administrative';

interface ReportingAnalyticsProps {
  userRole: string;
  facilityId: string;
}

interface DashboardMetrics {
  dailyRegistrations: number;
  dailyAppointments: number;
  dailyRevenue: number;
  patientSatisfaction: number;
  averageWaitTime: number;
  noShowRate: number;
  collectionRate: number;
  staffUtilization: number;
}

interface ChartData {
  name: string;
  value: number;
  change?: number;
}

const ReportingAnalytics: React.FC<ReportingAnalyticsProps> = ({ userRole, facilityId }) => {
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('Patient Registration');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [recentReports, setRecentReports] = useState<OperationalReport[]>([]);
  const [chartData, setChartData] = useState<{
    registrations: ChartData[];
    revenue: ChartData[];
    appointments: ChartData[];
    satisfaction: ChartData[];
  } | null>(null);
  const [complianceAlerts, setComplianceAlerts] = useState<Array<{
    id: string;
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    dueDate?: Date;
  }>>([]);

  useEffect(() => {
    fetchReportingData();
  }, [facilityId, dateRange]);

  const fetchReportingData = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API calls
      const mockMetrics: DashboardMetrics = {
        dailyRegistrations: 12,
        dailyAppointments: 89,
        dailyRevenue: 8450.75,
        patientSatisfaction: 4.2,
        averageWaitTime: 18,
        noShowRate: 8.5,
        collectionRate: 92.3,
        staffUtilization: 85.7
      };

      const mockRegistrationData: ChartData[] = [
        { name: 'Mon', value: 15, change: 5 },
        { name: 'Tue', value: 12, change: -3 },
        { name: 'Wed', value: 18, change: 6 },
        { name: 'Thu', value: 14, change: -4 },
        { name: 'Fri', value: 22, change: 8 },
        { name: 'Sat', value: 8, change: -14 },
        { name: 'Sun', value: 6, change: -2 }
      ];

      const mockRevenueData: ChartData[] = [
        { name: 'Jan', value: 245000 },
        { name: 'Feb', value: 268000 },
        { name: 'Mar', value: 289000 },
        { name: 'Apr', value: 275000 },
        { name: 'May', value: 298000 },
        { name: 'Jun', value: 315000 }
      ];

      const mockAppointmentData: ChartData[] = [
        { name: 'New Patient', value: 25 },
        { name: 'Follow-up', value: 45 },
        { name: 'Annual Physical', value: 15 },
        { name: 'Consultation', value: 10 },
        { name: 'Procedure', value: 5 }
      ];

      const mockSatisfactionData: ChartData[] = [
        { name: 'Excellent', value: 35 },
        { name: 'Good', value: 40 },
        { name: 'Fair', value: 20 },
        { name: 'Poor', value: 5 }
      ];

      const mockReports: OperationalReport[] = [
        {
          id: 'RPT-001',
          type: 'Patient Registration',
          name: 'Daily Registration Report',
          description: 'Daily patient registration statistics',
          parameters: [],
          generatedBy: 'System',
          generatedAt: new Date(),
          dateRange: { from: new Date(), to: new Date() },
          data: {},
          format: 'PDF'
        },
        {
          id: 'RPT-002',
          type: 'Revenue Cycle',
          name: 'Monthly Revenue Analysis',
          description: 'Comprehensive revenue cycle performance',
          parameters: [],
          generatedBy: 'System',
          generatedAt: new Date(),
          dateRange: { from: new Date(), to: new Date() },
          data: {},
          format: 'Excel'
        }
      ];

      const mockComplianceAlerts = [
        {
          id: 'COMP-001',
          type: 'Documentation',
          message: '15 clinical notes require completion within 24 hours',
          severity: 'high' as const,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        {
          id: 'COMP-002',
          type: 'Quality Metrics',
          message: 'Patient satisfaction scores below target (4.2/5.0)',
          severity: 'medium' as const
        },
        {
          id: 'COMP-003',
          type: 'Revenue Cycle',
          message: 'Claims aging report shows $25,000 in accounts > 90 days',
          severity: 'high' as const
        }
      ];

      setDashboardMetrics(mockMetrics);
      setChartData({
        registrations: mockRegistrationData,
        revenue: mockRevenueData,
        appointments: mockAppointmentData,
        satisfaction: mockSatisfactionData
      });
      setRecentReports(mockReports);
      setComplianceAlerts(mockComplianceAlerts);
    } catch (error) {
      console.error('Failed to fetch reporting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const reportTypes: ReportType[] = [
    'Patient Registration',
    'Appointment Analytics',
    'Revenue Cycle',
    'Productivity',
    'Patient Flow',
    'Quality Metrics',
    'Compliance',
    'Financial Performance',
    'Inventory',
    'Staff Performance'
  ];

  const generateReport = async (reportType: ReportType, format: 'PDF' | 'Excel' | 'CSV') => {
    try {
      // Mock report generation
      console.log(`Generating ${reportType} report in ${format} format`);
      
      const newReport: OperationalReport = {
        id: `RPT-${Date.now()}`,
        type: reportType,
        name: `${reportType} Report`,
        description: `Generated ${reportType.toLowerCase()} report`,
        parameters: [],
        generatedBy: 'Current User',
        generatedAt: new Date(),
        dateRange: {
          from: dateRange.from ? new Date(dateRange.from) : new Date(),
          to: dateRange.to ? new Date(dateRange.to) : new Date()
        },
        data: {},
        format,
        filePath: `/reports/${reportType.replace(' ', '_')}_${Date.now()}.${format.toLowerCase()}`
      };

      setRecentReports(prev => [newReport, ...prev.slice(0, 9)]);
      alert(`${reportType} report generated successfully!`);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

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
              <h1 className="text-3xl font-bold text-gray-900">Reporting & Analytics</h1>
              <p className="text-gray-600 mt-1">Operational metrics and compliance reporting</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="block w-full pl-3 pr-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="block w-full pl-3 pr-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Performance Indicators */}
        {dashboardMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UsersIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Daily Registrations</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{dashboardMetrics.dailyRegistrations}</div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          <ArrowTrendingUpIcon className="self-center flex-shrink-0 h-4 w-4 text-green-500" />
                          <span className="sr-only">Increased by</span>
                          12%
                        </div>
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
                    <CalendarIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Daily Appointments</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{dashboardMetrics.dailyAppointments}</div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          <ArrowTrendingUpIcon className="self-center flex-shrink-0 h-4 w-4 text-green-500" />
                          <span className="sr-only">Increased by</span>
                          8%
                        </div>
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
                    <CurrencyDollarIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Daily Revenue</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">${dashboardMetrics.dailyRevenue.toLocaleString()}</div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                          <ArrowTrendingDownIcon className="self-center flex-shrink-0 h-4 w-4 text-red-500" />
                          <span className="sr-only">Decreased by</span>
                          3%
                        </div>
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
                    <ClockIcon className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg Wait Time</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{dashboardMetrics.averageWaitTime}min</div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          <ArrowTrendingDownIcon className="self-center flex-shrink-0 h-4 w-4 text-green-500" />
                          <span className="sr-only">Decreased by</span>
                          15%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compliance Alerts */}
        {complianceAlerts.length > 0 && (
          <div className="mb-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Compliance Alerts
                </h3>
                <div className="space-y-3">
                  {complianceAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{alert.type}</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{alert.message}</p>
                        {alert.dueDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            Due: {alert.dueDate.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Registrations Chart */}
          {chartData && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Registrations</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.registrations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue Trend */}
          {chartData && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Appointment Types Distribution */}
          {chartData && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Appointment Types</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.appointments}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.appointments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Patient Satisfaction */}
          {chartData && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Satisfaction</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.satisfaction}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Report Generation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Report Generator */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Generate Reports
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Report Type</label>
                  <select
                    value={selectedReport}
                    onChange={(e) => setSelectedReport(e.target.value as ReportType)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  >
                    {reportTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => generateReport(selectedReport, 'PDF')}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    PDF
                  </button>
                  <button
                    onClick={() => generateReport(selectedReport, 'Excel')}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    Excel
                  </button>
                  <button
                    onClick={() => generateReport(selectedReport, 'CSV')}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                    CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Reports */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Recent Reports
              </h3>
              
              <div className="space-y-3">
                {recentReports.slice(0, 5).map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{report.name}</p>
                      <p className="text-sm text-gray-500">{report.generatedAt.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {report.format}
                      </span>
                      <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                        Download
                      </button>
                    </div>
                  </div>
                ))}
                
                {recentReports.length === 0 && (
                  <div className="text-center py-6">
                    <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No reports generated</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Generate your first report using the form above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics Summary */}
        {dashboardMetrics && (
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Performance Summary
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.patientSatisfaction}/5.0</div>
                    <div className="text-sm text-gray-500">Patient Satisfaction</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${(dashboardMetrics.patientSatisfaction / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.noShowRate}%</div>
                    <div className="text-sm text-gray-500">No-Show Rate</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-red-600 h-2 rounded-full"
                        style={{ width: `${dashboardMetrics.noShowRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.collectionRate}%</div>
                    <div className="text-sm text-gray-500">Collection Rate</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${dashboardMetrics.collectionRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.staffUtilization}%</div>
                    <div className="text-sm text-gray-500">Staff Utilization</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${dashboardMetrics.staffUtilization}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportingAnalytics;