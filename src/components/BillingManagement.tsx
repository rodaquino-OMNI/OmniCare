'use client';

import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon, 
  DocumentTextIcon, 
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { Billing, DiagnosisCode, ProcedureCode, Patient, Provider } from '@/types/administrative';

interface BillingManagementProps {
  userRole: string;
  facilityId: string;
}

interface ClaimSummary {
  totalClaims: number;
  pendingClaims: number;
  paidClaims: number;
  deniedClaims: number;
  totalRevenue: number;
  collectionsRate: number;
  averageDaysInAR: number;
}

const BillingManagement: React.FC<BillingManagementProps> = ({ userRole, facilityId }) => {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBilling, setSelectedBilling] = useState<Billing | null>(null);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [claimSummary, setClaimSummary] = useState<ClaimSummary | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, [facilityId, dateRange, filterStatus, filterProvider]);

  const fetchBillingData = async () => {
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
          schedule: [],
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
          insurance: [{
            id: 'INS-001',
            planName: 'Blue Cross Blue Shield',
            policyNumber: 'BC123456789',
            subscriberId: 'BCBS001',
            subscriberName: 'John Smith',
            subscriberDateOfBirth: new Date('1980-05-15'),
            relationship: 'Self',
            isPrimary: true,
            effectiveDate: new Date('2024-01-01'),
            copay: 25,
            deductible: 1000,
            outOfPocketMax: 5000,
            eligibilityVerified: true,
            verificationDate: new Date(),
            verificationStatus: 'Verified',
            priorAuthRequired: false,
            referralRequired: false
          }],
          maritalStatus: 'Married',
          employmentStatus: 'Employed',
          preferredLanguage: 'English',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'Active'
        }
      ];

      const mockBillings: Billing[] = [
        {
          id: 'BILL-001',
          patientId: 'PAT-001',
          appointmentId: 'APT-001',
          providerId: 'PROV-001',
          facilityId: facilityId,
          encounterDate: new Date('2024-01-15'),
          diagnosisCodes: [
            { code: 'I10', description: 'Essential hypertension', isPrimary: true },
            { code: 'Z79.4', description: 'Long term use of insulin', isPrimary: false }
          ],
          procedureCodes: [
            { code: '99214', description: 'Office visit, established patient, moderate complexity', modifier: '', units: 1, amount: 225.00 },
            { code: '93000', description: 'Electrocardiogram, routine ECG with 12 leads', modifier: '', units: 1, amount: 85.00 }
          ],
          charges: [
            { id: 'CHG-001', procedureCode: '99214', amount: 225.00, units: 1, dateOfService: new Date('2024-01-15') },
            { id: 'CHG-002', procedureCode: '93000', amount: 85.00, units: 1, dateOfService: new Date('2024-01-15') }
          ],
          totalAmount: 310.00,
          insuranceAmount: 285.00,
          patientAmount: 25.00,
          status: 'Submitted',
          claimId: 'CLM-001',
          claimSubmissionDate: new Date('2024-01-16'),
          adjustments: [],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-16')
        },
        {
          id: 'BILL-002',
          patientId: 'PAT-001',
          providerId: 'PROV-001',
          facilityId: facilityId,
          encounterDate: new Date('2024-01-10'),
          diagnosisCodes: [
            { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', isPrimary: true }
          ],
          procedureCodes: [
            { code: '99395', description: 'Periodic comprehensive preventive medicine reevaluation, established patient, 18-39 years', modifier: '', units: 1, amount: 280.00 }
          ],
          charges: [
            { id: 'CHG-003', procedureCode: '99395', amount: 280.00, units: 1, dateOfService: new Date('2024-01-10') }
          ],
          totalAmount: 280.00,
          insuranceAmount: 280.00,
          patientAmount: 0.00,
          status: 'Paid',
          claimId: 'CLM-002',
          claimSubmissionDate: new Date('2024-01-11'),
          paymentDate: new Date('2024-01-25'),
          paymentAmount: 280.00,
          adjustments: [
            { id: 'ADJ-001', type: 'Insurance Payment', amount: 280.00, date: new Date('2024-01-25'), reason: 'Primary insurance payment', userId: 'USER-001' }
          ],
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-25')
        }
      ];

      const summary: ClaimSummary = {
        totalClaims: mockBillings.length,
        pendingClaims: mockBillings.filter(b => ['Ready to Bill', 'Submitted'].includes(b.status)).length,
        paidClaims: mockBillings.filter(b => b.status === 'Paid').length,
        deniedClaims: mockBillings.filter(b => b.status === 'Denied').length,
        totalRevenue: mockBillings.reduce((sum, b) => sum + (b.paymentAmount || 0), 0),
        collectionsRate: 85.2,
        averageDaysInAR: 32
      };

      setProviders(mockProviders);
      setPatients(mockPatients);
      setBillings(mockBillings);
      setClaimSummary(summary);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
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
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Ready to Bill': return 'bg-blue-100 text-blue-800';
      case 'Submitted': return 'bg-yellow-100 text-yellow-800';
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Partial Payment': return 'bg-yellow-100 text-yellow-800';
      case 'Denied': return 'bg-red-100 text-red-800';
      case 'Appeal Submitted': return 'bg-purple-100 text-purple-800';
      case 'Written Off': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid': return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'Denied': return <XCircleIcon className="h-4 w-4 text-red-600" />;
      case 'Submitted': return <ClipboardDocumentCheckIcon className="h-4 w-4 text-yellow-600" />;
      default: return <DocumentTextIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const filteredBillings = billings.filter(billing => {
    if (filterStatus !== 'all' && billing.status !== filterStatus) return false;
    if (filterProvider !== 'all' && billing.providerId !== filterProvider) return false;
    if (searchTerm) {
      const patientName = getPatientName(billing.patientId).toLowerCase();
      const providerName = getProviderName(billing.providerId).toLowerCase();
      const claimId = billing.claimId?.toLowerCase() || '';
      const searchLower = searchTerm.toLowerCase();
      return patientName.includes(searchLower) || 
             providerName.includes(searchLower) ||
             claimId.includes(searchLower);
    }
    return true;
  });

  const handleStatusUpdate = async (billingId: string, newStatus: string) => {
    try {
      setBillings(prev => 
        prev.map(bill => 
          bill.id === billingId 
            ? { ...bill, status: newStatus as any, updatedAt: new Date() }
            : bill
        )
      );
      
      if (selectedBilling?.id === billingId) {
        setSelectedBilling(prev => 
          prev ? { ...prev, status: newStatus as any } : null
        );
      }
    } catch (error) {
      console.error('Failed to update billing status:', error);
    }
  };

  const exportReport = (format: 'CSV' | 'PDF' | 'Excel') => {
    // Mock export functionality
    console.log(`Exporting billing report as ${format}`);
    alert(`Billing report exported as ${format}`);
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
              <h1 className="text-3xl font-bold text-gray-900">Billing & Revenue Cycle Management</h1>
              <p className="text-gray-600 mt-1">Process claims and manage revenue cycle operations</p>
            </div>
            <div className="flex space-x-3">
              <div className="relative">
                <select 
                  onChange={(e) => exportReport(e.target.value as any)}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  defaultValue=""
                >
                  <option value="" disabled>Export Report</option>
                  <option value="CSV">Export as CSV</option>
                  <option value="Excel">Export as Excel</option>
                  <option value="PDF">Export as PDF</option>
                </select>
                <ArrowDownTrayIcon className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={() => setShowNewClaimModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Claim
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Revenue Cycle Metrics */}
        {claimSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Claims</dt>
                      <dd className="text-lg font-medium text-gray-900">{claimSummary.totalClaims}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClipboardDocumentCheckIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending Claims</dt>
                      <dd className="text-lg font-medium text-gray-900">{claimSummary.pendingClaims}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CurrencyDollarIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                      <dd className="text-lg font-medium text-gray-900">${claimSummary.totalRevenue.toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Collections Rate</dt>
                      <dd className="text-lg font-medium text-gray-900">{claimSummary.collectionsRate}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                    placeholder="Search by patient, provider, or claim ID..."
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
                  <option value="Draft">Draft</option>
                  <option value="Ready to Bill">Ready to Bill</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial Payment">Partial Payment</option>
                  <option value="Denied">Denied</option>
                  <option value="Appeal Submitted">Appeal Submitted</option>
                  <option value="Written Off">Written Off</option>
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

              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  placeholder="From date"
                />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  placeholder="To date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Claims Management</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claim ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Encounter Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBillings.map((billing) => (
                  <tr key={billing.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {billing.claimId || billing.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getPatientName(billing.patientId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getProviderName(billing.providerId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {billing.encounterDate.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${billing.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(billing.status)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(billing.status)}`}>
                          {billing.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedBilling(billing)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <EyeIcon className="h-4 w-4 inline mr-1" />
                        View
                      </button>
                      {billing.status === 'Draft' && (
                        <button
                          onClick={() => handleStatusUpdate(billing.id, 'Ready to Bill')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Submit
                        </button>
                      )}
                      {billing.status === 'Denied' && (
                        <button
                          onClick={() => handleStatusUpdate(billing.id, 'Appeal Submitted')}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Appeal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredBillings.length === 0 && (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No claims found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new claim or adjusting your filters.
              </p>
            </div>
          )}
        </div>

        {/* Claim Details Modal */}
        {selectedBilling && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Claim Details</h3>
                  <button
                    onClick={() => setSelectedBilling(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Claim Information</h4>
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Claim ID</dt>
                          <dd className="text-sm text-gray-900">{selectedBilling.claimId || selectedBilling.id}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Encounter Date</dt>
                          <dd className="text-sm text-gray-900">{selectedBilling.encounterDate.toLocaleDateString()}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Status</dt>
                          <dd>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedBilling.status)}`}>
                              {selectedBilling.status}
                            </span>
                          </dd>
                        </div>
                        {selectedBilling.claimSubmissionDate && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Submission Date</dt>
                            <dd className="text-sm text-gray-900">{selectedBilling.claimSubmissionDate.toLocaleDateString()}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Patient & Provider</h4>
                      <dl className="space-y-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Patient</dt>
                          <dd className="text-sm text-gray-900">{getPatientName(selectedBilling.patientId)}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Provider</dt>
                          <dd className="text-sm text-gray-900">{getProviderName(selectedBilling.providerId)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Financial Summary</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Total Charges</dt>
                          <dd className="text-lg font-semibold text-gray-900">${selectedBilling.totalAmount.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Insurance Amount</dt>
                          <dd className="text-lg font-semibold text-gray-900">${selectedBilling.insuranceAmount.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Patient Responsibility</dt>
                          <dd className="text-lg font-semibold text-gray-900">${selectedBilling.patientAmount.toFixed(2)}</dd>
                        </div>
                      </div>
                      {selectedBilling.paymentAmount && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex justify-between">
                            <dt className="text-sm font-medium text-gray-500">Amount Paid</dt>
                            <dd className="text-sm font-semibold text-green-600">${selectedBilling.paymentAmount.toFixed(2)}</dd>
                          </div>
                          {selectedBilling.paymentDate && (
                            <div className="flex justify-between mt-1">
                              <dt className="text-sm font-medium text-gray-500">Payment Date</dt>
                              <dd className="text-sm text-gray-900">{selectedBilling.paymentDate.toLocaleDateString()}</dd>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diagnosis Codes */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Diagnosis Codes</h4>
                    <div className="space-y-2">
                      {selectedBilling.diagnosisCodes.map((diagnosis, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div>
                            <span className="font-medium text-gray-900">{diagnosis.code}</span>
                            {diagnosis.isPrimary && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Primary
                              </span>
                            )}
                            <p className="text-sm text-gray-600 mt-1">{diagnosis.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Procedure Codes */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Procedure Codes</h4>
                    <div className="space-y-2">
                      {selectedBilling.procedureCodes.map((procedure, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="font-medium text-gray-900">{procedure.code}</span>
                              {procedure.modifier && (
                                <span className="ml-2 text-sm text-gray-500">Modifier: {procedure.modifier}</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{procedure.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Units: {procedure.units}</p>
                            <p className="font-medium text-gray-900">${procedure.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Adjustments */}
                  {selectedBilling.adjustments.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Adjustments</h4>
                      <div className="space-y-2">
                        {selectedBilling.adjustments.map((adjustment) => (
                          <div key={adjustment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{adjustment.type}</p>
                              <p className="text-sm text-gray-600">{adjustment.reason}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">${adjustment.amount.toFixed(2)}</p>
                              <p className="text-sm text-gray-500">{adjustment.date.toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="border-t pt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedBilling.status === 'Draft' && (
                        <button
                          onClick={() => handleStatusUpdate(selectedBilling.id, 'Ready to Bill')}
                          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Submit Claim
                        </button>
                      )}
                      {selectedBilling.status === 'Denied' && (
                        <button
                          onClick={() => handleStatusUpdate(selectedBilling.id, 'Appeal Submitted')}
                          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        >
                          Submit Appeal
                        </button>
                      )}
                      <button className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Print Claim
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Edit Claim
                      </button>
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

export default BillingManagement;