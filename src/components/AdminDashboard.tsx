'use client';

import React, { useState, useEffect } from 'react';
import { 
  UsersIcon, 
  CalendarIcon, 
  CurrencyDollarIcon, 
  DocumentTextIcon,
  CogIcon,
  ClipboardDocumentListIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { DashboardMetrics, SystemAlert } from '@/types/administrative';

interface AdminDashboardProps {
  userRole: string;
  userName: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ userRole, userName }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call to fetch dashboard metrics
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Mock data - replace with actual API call
        const mockMetrics: DashboardMetrics = {
          patientsRegisteredToday: 12,
          appointmentsToday: 89,
          pendingClaims: 45,
          overdueDocuments: 8,
          systemAlerts: [
            {
              id: '1',
              type: 'System',
              severity: 'High',
              title: 'Server Performance',
              message: 'High CPU usage detected on database server',
              triggeredAt: new Date(),
              status: 'Active'
            },
            {
              id: '2',
              type: 'Compliance',
              severity: 'Medium',
              title: 'Documentation Overdue',
              message: '5 clinical notes require completion within 24 hours',
              triggeredAt: new Date(),
              status: 'Active'
            }
          ],
          revenueThisMonth: 248750.50,
          patientSatisfactionScore: 4.2,
          averageWaitTime: 18
        };
        
        setMetrics(mockMetrics);
      } catch (error) {
        console.error('Failed to fetch dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const adminModules = [
    {
      id: 'patient-registration',
      name: 'Patient Registration',
      description: 'Manage patient onboarding and demographics',
      icon: UsersIcon,
      color: 'bg-blue-500',
      permissions: ['Front Desk Staff', 'Administrative Staff', 'Department Manager']
    },
    {
      id: 'appointment-management',
      name: 'Appointment Management',
      description: 'Schedule and manage patient appointments',
      icon: CalendarIcon,
      color: 'bg-green-500',
      permissions: ['Administrative Staff', 'Front Desk Staff', 'Department Manager']
    },
    {
      id: 'billing-revenue',
      name: 'Billing & Revenue Cycle',
      description: 'Process claims and manage revenue cycle',
      icon: CurrencyDollarIcon,
      color: 'bg-yellow-500',
      permissions: ['Billing Staff', 'Medical Coder', 'Financial Counselor', 'Department Manager']
    },
    {
      id: 'document-management',
      name: 'Document Management',
      description: 'Handle document scanning and release of information',
      icon: DocumentTextIcon,
      color: 'bg-purple-500',
      permissions: ['HIM Staff', 'Administrative Staff', 'Department Manager']
    },
    {
      id: 'system-admin',
      name: 'System Administration',
      description: 'Manage users, permissions, and system settings',
      icon: CogIcon,
      color: 'bg-gray-500',
      permissions: ['System Administrator', 'Security Administrator']
    },
    {
      id: 'inventory-supplies',
      name: 'Inventory & Supplies',
      description: 'Track and manage medical supplies and equipment',
      icon: ClipboardDocumentListIcon,
      color: 'bg-indigo-500',
      permissions: ['Administrative Staff', 'Department Manager']
    },
    {
      id: 'facility-security',
      name: 'Facility & Security',
      description: 'Manage facility operations and security',
      icon: BuildingOfficeIcon,
      color: 'bg-red-500',
      permissions: ['Security Administrator', 'Department Manager']
    },
    {
      id: 'reporting-analytics',
      name: 'Reporting & Analytics',
      description: 'Generate operational and compliance reports',
      icon: ChartBarIcon,
      color: 'bg-teal-500',
      permissions: ['Department Manager', 'Compliance Officer', 'Quality Manager']
    },
    {
      id: 'staff-management',
      name: 'Staff Management',
      description: 'Manage staff schedules and performance',
      icon: UserGroupIcon,
      color: 'bg-orange-500',
      permissions: ['Department Manager', 'System Administrator']
    },
    {
      id: 'patient-experience',
      name: 'Patient Experience',
      description: 'Track feedback and manage communications',
      icon: ChatBubbleLeftRightIcon,
      color: 'bg-pink-500',
      permissions: ['Administrative Staff', 'Department Manager']
    }
  ];

  const getAccessibleModules = () => {
    return adminModules.filter(module => 
      module.permissions.includes(userRole) || userRole === 'System Administrator'
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'text-red-600 bg-red-100';
      case 'High': return 'text-orange-600 bg-orange-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
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
              <h1 className="text-3xl font-bold text-gray-900">OmniCare EMR - Administrative Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back, {userName} ({userRole})</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UsersIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Patients Registered Today
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metrics.patientsRegisteredToday}
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
                    <CalendarIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Appointments Today
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metrics.appointmentsToday}
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
                    <CurrencyDollarIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Revenue This Month
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${metrics.revenueThisMonth.toLocaleString()}
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
                    <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Pending Claims
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metrics.pendingClaims}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Alerts */}
        {metrics?.systemAlerts && metrics.systemAlerts.length > 0 && (
          <div className="mb-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  System Alerts
                </h3>
                <div className="space-y-3">
                  {metrics.systemAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {alert.triggeredAt.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Administrative Modules */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Administrative Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getAccessibleModules().map((module) => {
              const IconComponent = module.icon;
              return (
                <div
                  key={module.id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setActiveModule(module.id)}
                >
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 p-3 rounded-md ${module.color}`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">
                          {module.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <span>Register New Patient</span>
                  <UsersIcon className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <span>Schedule Appointment</span>
                  <CalendarIcon className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <span>Process Billing</span>
                  <CurrencyDollarIcon className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <span>Generate Report</span>
                  <ChartBarIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Performance Metrics
              </h3>
              {metrics && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Patient Satisfaction</span>
                      <span className="font-medium">{metrics.patientSatisfactionScore}/5.0</span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${(metrics.patientSatisfactionScore / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Average Wait Time</span>
                      <span className="font-medium">{metrics.averageWaitTime} min</span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.max(0, 100 - metrics.averageWaitTime)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Claims Processing</span>
                      <span className="font-medium">92% Success Rate</span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;