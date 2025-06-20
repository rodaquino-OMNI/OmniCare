import React, { useState } from 'react';
import Head from 'next/head';
import AdminDashboard from '@/components/AdminDashboard';
import PatientRegistration from '@/components/PatientRegistration';
import AppointmentManagement from '@/components/AppointmentManagement';
import BillingManagement from '@/components/BillingManagement';
import ReportingAnalytics from '@/components/ReportingAnalytics';
import { Patient } from '@/types/administrative';

const AdminDashboardPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [userRole] = useState<string>('Department Manager'); // Mock user role
  const [userName] = useState<string>('Sarah Johnson'); // Mock user name
  const [facilityId] = useState<string>('FAC-001'); // Mock facility ID

  const handlePatientRegistrationComplete = (patient: Patient) => {
    console.log('Patient registered:', patient);
    // Handle successful registration
    setCurrentView('dashboard');
  };

  const handlePatientRegistrationCancel = () => {
    setCurrentView('dashboard');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'patient-registration':
        return (
          <PatientRegistration
            onComplete={handlePatientRegistrationComplete}
            onCancel={handlePatientRegistrationCancel}
          />
        );
      case 'appointment-management':
        return (
          <AppointmentManagement
            userRole={userRole}
            facilityId={facilityId}
          />
        );
      case 'billing-revenue':
        return (
          <BillingManagement
            userRole={userRole}
            facilityId={facilityId}
          />
        );
      case 'reporting-analytics':
        return (
          <ReportingAnalytics
            userRole={userRole}
            facilityId={facilityId}
          />
        );
      default:
        return (
          <AdminDashboard
            userRole={userRole}
            userName={userName}
          />
        );
    }
  };

  return (
    <>
      <Head>
        <title>OmniCare EMR - Administrative Dashboard</title>
        <meta name="description" content="OmniCare EMR Administrative Dashboard - Healthcare Management System" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation Bar - only show if not in specific module views */}
      {currentView === 'dashboard' && (
        <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 className="text-xl font-bold text-gray-900">OmniCare EMR</h1>
                </div>
                <div className="hidden md:ml-6 md:flex md:space-x-8">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`${
                      currentView === 'dashboard'
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setCurrentView('patient-registration')}
                    className={`${
                      currentView === 'patient-registration'
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Patient Registration
                  </button>
                  <button
                    onClick={() => setCurrentView('appointment-management')}
                    className={`${
                      currentView === 'appointment-management'
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Appointments
                  </button>
                  <button
                    onClick={() => setCurrentView('billing-revenue')}
                    className={`${
                      currentView === 'billing-revenue'
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Billing
                  </button>
                  <button
                    onClick={() => setCurrentView('reporting-analytics')}
                    className={`${
                      currentView === 'reporting-analytics'
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    Reports
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-sm text-gray-500">
                    {userName} ({userRole})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main>
        {renderCurrentView()}
      </main>
    </>
  );
};

export default AdminDashboardPage;