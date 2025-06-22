'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { 
  UserIcon, 
  IdentificationIcon, 
  ShieldCheckIcon,
  DocumentTextIcon,
  CameraIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { PatientRegistrationForm, Patient, InsuranceInfo, EmergencyContact } from '@/types/administrative';

// Validation schema
const patientRegistrationSchema = yup.object({
  patient: yup.object({
    firstName: yup.string().required('First name is required'),
    lastName: yup.string().required('Last name is required'),
    dateOfBirth: yup.date().required('Date of birth is required'),
    gender: yup.string().oneOf(['M', 'F', 'O', 'U']).required('Gender is required'),
    ssn: yup.string().matches(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in format XXX-XX-XXXX'),
    address: yup.object({
      street: yup.string().required('Street address is required'),
      city: yup.string().required('City is required'),
      state: yup.string().required('State is required'),
      zipCode: yup.string().matches(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').required('ZIP code is required'),
      country: yup.string().required('Country is required')
    }),
    phone: yup.array().of(yup.object({
      number: yup.string().matches(/^\(\d{3}\) \d{3}-\d{4}$/, 'Phone must be in format (XXX) XXX-XXXX').required(),
      type: yup.string().required(),
      isPrimary: yup.boolean().required()
    })).min(1, 'At least one phone number is required'),
    email: yup.string().email('Invalid email format'),
    emergencyContact: yup.object({
      name: yup.string().required('Emergency contact name is required'),
      relationship: yup.string().required('Relationship is required'),
      phone: yup.string().matches(/^\(\d{3}\) \d{3}-\d{4}$/, 'Phone must be in format (XXX) XXX-XXXX').required('Phone is required')
    }),
    insurance: yup.array().default([]),
    preferredLanguage: yup.string().required('Preferred language is required'),
    maritalStatus: yup.string().required('Marital status is required'),
    employmentStatus: yup.string().required('Employment status is required'),
    status: yup.string().default('Active')
  }),
  consentForms: yup.array().of(yup.string()).min(1, 'At least one consent form must be signed'),
  emergencyContacts: yup.array().of(yup.object({
    name: yup.string().required('Emergency contact name is required'),
    relationship: yup.string().required('Relationship is required'),
    phone: yup.string().matches(/^\(\d{3}\) \d{3}-\d{4}$/, 'Phone must be in format (XXX) XXX-XXXX').required('Phone is required')
  })).min(1, 'At least one emergency contact is required'),
  insuranceVerification: yup.object({
    primaryInsuranceVerified: yup.boolean(),
    secondaryInsuranceVerified: yup.boolean(),
    copayAmount: yup.number().min(0, 'Copay must be positive'),
    authorizationRequired: yup.boolean()
  })
});

interface PatientRegistrationProps {
  onComplete: (patient: Patient) => void;
  onCancel: () => void;
}

const PatientRegistration: React.FC<PatientRegistrationProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ status: 'none' | 'checking' | 'found' | 'clear' }>({ status: 'none' });
  const [insuranceVerificationStatus, setInsuranceVerificationStatus] = useState<'none' | 'verifying' | 'verified' | 'failed'>('none');
  const [photoCapture, setPhotoCapture] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<PatientRegistrationForm>({
    resolver: yupResolver(patientRegistrationSchema),
    mode: 'onChange',
    defaultValues: {
      patient: {
        firstName: '',
        lastName: '',
        middleName: '',
        dateOfBirth: new Date(),
        gender: 'U',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'USA',
          addressType: 'Home'
        },
        phone: [{
          number: '',
          type: 'Home',
          isPrimary: true
        }],
        email: '',
        emergencyContact: {
          name: '',
          relationship: '',
          phone: ''
        },
        insurance: [],
        maritalStatus: 'Single',
        employmentStatus: 'Employed',
        preferredLanguage: 'English',
        race: '',
        ethnicity: '',
        status: 'Active'
      },
      consentForms: [],
      emergencyContacts: [],
      insuranceVerification: {
        primaryInsuranceVerified: false,
        secondaryInsuranceVerified: false,
        copayAmount: 0,
        authorizationRequired: false
      }
    }
  });

  const watchedFields = watch();

  // Duplicate patient check
  useEffect(() => {
    const { firstName, lastName, dateOfBirth } = watchedFields.patient || {};
    if (firstName && lastName && dateOfBirth) {
      setDuplicateCheck({ status: 'checking' });
      
      // Simulate duplicate check API call
      const checkDuplicates = setTimeout(() => {
        // Mock duplicate check logic
        const isDuplicate = Math.random() < 0.1; // 10% chance of duplicate for demo
        setDuplicateCheck({ status: isDuplicate ? 'found' : 'clear' });
      }, 1500);

      return () => clearTimeout(checkDuplicates);
    }
    return undefined;
  }, [watchedFields.patient?.firstName, watchedFields.patient?.lastName, watchedFields.patient?.dateOfBirth]);

  const steps = [
    { id: 1, name: 'Patient Information', icon: UserIcon },
    { id: 2, name: 'Contact & Demographics', icon: IdentificationIcon },
    { id: 3, name: 'Insurance Information', icon: ShieldCheckIcon },
    { id: 4, name: 'Consent & Documentation', icon: DocumentTextIcon },
    { id: 5, name: 'Verification & Completion', icon: CheckCircleIcon }
  ];

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return value;
  };

  const formatSSN = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{2})(\d{4})$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return value;
  };

  const verifyInsurance = async () => {
    setInsuranceVerificationStatus('verifying');
    
    // Simulate insurance verification API call
    setTimeout(() => {
      const isVerified = Math.random() < 0.8; // 80% success rate for demo
      setInsuranceVerificationStatus(isVerified ? 'verified' : 'failed');
      
      if (isVerified) {
        setValue('insuranceVerification.primaryInsuranceVerified', true);
        setValue('insuranceVerification.copayAmount', 25);
        setValue('insuranceVerification.authorizationRequired', false);
      }
    }, 2000);
  };

  const capturePhoto = () => {
    // Simulate photo capture
    setPhotoCapture('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...');
  };

  const onSubmit = async (data: PatientRegistrationForm) => {
    setLoading(true);
    
    try {
      // Simulate patient registration API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newPatient: Patient = {
        id: `PAT-${Date.now()}`,
        ...data.patient,
        createdAt: new Date(),
        updatedAt: new Date(),
        photographPath: photoCapture || undefined,
        patientPortalCredentials: {
          username: `${data.patient.firstName.toLowerCase()}.${data.patient.lastName.toLowerCase()}`,
          isActivated: false
        }
      };
      
      onComplete(newPatient);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name *</label>
                <Controller
                  name="patient.firstName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter first name"
                    />
                  )}
                />
                {errors.patient?.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.patient.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                <Controller
                  name="patient.lastName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter last name"
                    />
                  )}
                />
                {errors.patient?.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.patient.lastName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                <Controller
                  name="patient.middleName"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter middle name"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth *</label>
                <Controller
                  name="patient.dateOfBirth"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="date"
                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                />
                {errors.patient?.dateOfBirth && (
                  <p className="mt-1 text-sm text-red-600">{errors.patient.dateOfBirth.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Gender *</label>
                <Controller
                  name="patient.gender"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="U">Prefer not to specify</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Social Security Number</label>
                <Controller
                  name="patient.ssn"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(formatSSN(e.target.value))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="XXX-XX-XXXX"
                      maxLength={11}
                    />
                  )}
                />
                {errors.patient?.ssn && (
                  <p className="mt-1 text-sm text-red-600">{errors.patient.ssn.message}</p>
                )}
              </div>
            </div>

            {/* Duplicate Check Status */}
            {duplicateCheck.status !== 'none' && (
              <div className={`rounded-md p-4 ${
                duplicateCheck.status === 'checking' ? 'bg-yellow-50 border border-yellow-200' :
                duplicateCheck.status === 'found' ? 'bg-red-50 border border-red-200' :
                'bg-green-50 border border-green-200'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {duplicateCheck.status === 'checking' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
                    ) : duplicateCheck.status === 'found' ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      duplicateCheck.status === 'checking' ? 'text-yellow-800' :
                      duplicateCheck.status === 'found' ? 'text-red-800' :
                      'text-green-800'
                    }`}>
                      {duplicateCheck.status === 'checking' ? 'Checking for duplicate patients...' :
                       duplicateCheck.status === 'found' ? 'Potential duplicate patient found!' :
                       'No duplicate patients found'}
                    </p>
                    {duplicateCheck.status === 'found' && (
                      <p className="text-sm text-red-700 mt-1">
                        Please verify this is a new patient and not a duplicate record.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Street Address *</label>
                  <Controller
                    name="patient.address.street"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter street address"
                      />
                    )}
                  />
                  {errors.patient?.address?.street && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.address.street.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">City *</label>
                  <Controller
                    name="patient.address.city"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter city"
                      />
                    )}
                  />
                  {errors.patient?.address?.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.address.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">State *</label>
                  <Controller
                    name="patient.address.state"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select state</option>
                        <option value="AL">Alabama</option>
                        <option value="CA">California</option>
                        <option value="FL">Florida</option>
                        <option value="NY">New York</option>
                        <option value="TX">Texas</option>
                        {/* Add more states as needed */}
                      </select>
                    )}
                  />
                  {errors.patient?.address?.state && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.address.state.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">ZIP Code *</label>
                  <Controller
                    name="patient.address.zipCode"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="12345 or 12345-6789"
                        maxLength={10}
                      />
                    )}
                  />
                  {errors.patient?.address?.zipCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.address.zipCode.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Primary Phone *</label>
                  <Controller
                    name="patient.phone.0.number"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="(555) 123-4567"
                        maxLength={14}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <Controller
                    name="patient.email"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="email"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="patient@example.com"
                      />
                    )}
                  />
                  {errors.patient?.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.email.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Name *</label>
                  <Controller
                    name="patient.emergencyContact.name"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter contact name"
                      />
                    )}
                  />
                  {errors.patient?.emergencyContact?.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.emergencyContact.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Relationship *</label>
                  <Controller
                    name="patient.emergencyContact.relationship"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select relationship</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Child">Child</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Friend">Friend</option>
                        <option value="Other">Other</option>
                      </select>
                    )}
                  />
                  {errors.patient?.emergencyContact?.relationship && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.emergencyContact.relationship.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                  <Controller
                    name="patient.emergencyContact.phone"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="(555) 123-4567"
                        maxLength={14}
                      />
                    )}
                  />
                  {errors.patient?.emergencyContact?.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.patient.emergencyContact.phone.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Demographics */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Demographics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Marital Status *</label>
                  <Controller
                    name="patient.maritalStatus"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Other">Other</option>
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Employment Status *</label>
                  <Controller
                    name="patient.employmentStatus"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Employed">Employed</option>
                        <option value="Unemployed">Unemployed</option>
                        <option value="Retired">Retired</option>
                        <option value="Student">Student</option>
                        <option value="Disabled">Disabled</option>
                      </select>
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Preferred Language *</label>
                  <Controller
                    name="patient.preferredLanguage"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="Chinese">Chinese</option>
                        <option value="Other">Other</option>
                      </select>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Insurance Information</h3>
              <button
                type="button"
                onClick={verifyInsurance}
                disabled={insuranceVerificationStatus === 'verifying'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {insuranceVerificationStatus === 'verifying' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  'Verify Insurance'
                )}
              </button>
            </div>

            {/* Insurance Verification Status */}
            {insuranceVerificationStatus !== 'none' && (
              <div className={`rounded-md p-4 ${
                insuranceVerificationStatus === 'verifying' ? 'bg-yellow-50 border border-yellow-200' :
                insuranceVerificationStatus === 'verified' ? 'bg-green-50 border border-green-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {insuranceVerificationStatus === 'verifying' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
                    ) : insuranceVerificationStatus === 'verified' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      insuranceVerificationStatus === 'verifying' ? 'text-yellow-800' :
                      insuranceVerificationStatus === 'verified' ? 'text-green-800' :
                      'text-red-800'
                    }`}>
                      {insuranceVerificationStatus === 'verifying' ? 'Verifying insurance eligibility...' :
                       insuranceVerificationStatus === 'verified' ? 'Insurance verified successfully' :
                       'Insurance verification failed'}
                    </p>
                    {insuranceVerificationStatus === 'verified' && (
                      <div className="text-sm text-green-700 mt-1">
                        <p>Copay: $25.00 | Deductible: Met | Authorization: Not required</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600">
                Please collect and scan insurance cards. Verification will be completed after registration.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Consent Forms and Documentation</h3>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="consent-treatment"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    onChange={(e) => {
                      const currentConsents = watchedFields.consentForms || [];
                      if (e.target.checked) {
                        setValue('consentForms', [...currentConsents, 'treatment-consent']);
                      } else {
                        setValue('consentForms', currentConsents.filter(c => c !== 'treatment-consent'));
                      }
                    }}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="consent-treatment" className="font-medium text-gray-700">
                    Consent for Treatment
                  </label>
                  <p className="text-gray-500">Patient consents to medical treatment and procedures</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="consent-hipaa"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    onChange={(e) => {
                      const currentConsents = watchedFields.consentForms || [];
                      if (e.target.checked) {
                        setValue('consentForms', [...currentConsents, 'hipaa-authorization']);
                      } else {
                        setValue('consentForms', currentConsents.filter(c => c !== 'hipaa-authorization'));
                      }
                    }}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="consent-hipaa" className="font-medium text-gray-700">
                    HIPAA Authorization
                  </label>
                  <p className="text-gray-500">Authorization to use and disclose protected health information</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="consent-financial"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    onChange={(e) => {
                      const currentConsents = watchedFields.consentForms || [];
                      if (e.target.checked) {
                        setValue('consentForms', [...currentConsents, 'financial-responsibility']);
                      } else {
                        setValue('consentForms', currentConsents.filter(c => c !== 'financial-responsibility'));
                      }
                    }}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="consent-financial" className="font-medium text-gray-700">
                    Financial Responsibility Agreement
                  </label>
                  <p className="text-gray-500">Acknowledgment of financial responsibility for services</p>
                </div>
              </div>
            </div>

            {/* Photo Capture */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Patient Photograph (Optional)</h4>
              <div className="flex items-center space-x-4">
                {photoCapture ? (
                  <div className="relative">
                    <img src={photoCapture} alt="Patient" className="w-20 h-20 rounded-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoCapture(null)}
                      className="absolute -top-2 -right-2 rounded-full bg-red-600 text-white p-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                    <CameraIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <CameraIcon className="h-4 w-4 mr-2" />
                  {photoCapture ? 'Retake Photo' : 'Take Photo'}
                </button>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Review and Complete Registration</h3>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Patient Information</h4>
                  <dl className="text-sm space-y-1">
                    <div>
                      <dt className="inline font-medium text-gray-500">Name: </dt>
                      <dd className="inline text-gray-900">
                        {watchedFields.patient?.firstName} {watchedFields.patient?.middleName} {watchedFields.patient?.lastName}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-gray-500">DOB: </dt>
                      <dd className="inline text-gray-900">
                        {watchedFields.patient?.dateOfBirth ? new Date(watchedFields.patient.dateOfBirth).toLocaleDateString() : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-gray-500">Gender: </dt>
                      <dd className="inline text-gray-900">{watchedFields.patient?.gender}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                  <dl className="text-sm space-y-1">
                    <div>
                      <dt className="inline font-medium text-gray-500">Phone: </dt>
                      <dd className="inline text-gray-900">{watchedFields.patient?.phone?.[0]?.number}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-gray-500">Email: </dt>
                      <dd className="inline text-gray-900">{watchedFields.patient?.email || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-gray-500">Address: </dt>
                      <dd className="inline text-gray-900">
                        {watchedFields.patient?.address?.street}, {watchedFields.patient?.address?.city}, {watchedFields.patient?.address?.state} {watchedFields.patient?.address?.zipCode}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    Registration Complete
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Patient portal credentials will be provided upon successful registration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {steps.map((step, stepIdx) => (
                <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    {stepIdx !== steps.length - 1 && (
                      <div className={`h-0.5 w-full ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                      currentStep > step.id 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : currentStep === step.id
                          ? 'border-blue-600 bg-white text-blue-600'
                          : 'border-gray-300 bg-white text-gray-500'
                    }`}>
                      {currentStep > step.id ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <step.icon className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  <p className={`mt-2 text-xs font-medium text-center ${
                    currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </p>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Form Content */}
        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="px-6 py-8">
              {renderStepContent()}
            </div>

            {/* Form Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Previous
                  </button>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                
                {currentStep < steps.length ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!isValid}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || !isValid}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Registering...
                      </>
                    ) : (
                      'Complete Registration'
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PatientRegistration;