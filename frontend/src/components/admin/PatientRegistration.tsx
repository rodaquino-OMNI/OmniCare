'use client';

import React, { useState } from 'react';
import {
  Card,
  Grid,
  Text,
  Group,
  Button,
  TextInput,
  Select,
  Stack,
  Stepper,
  Checkbox,
  LoadingOverlay,
  Alert,
  Badge,
  Avatar,
  ActionIcon
} from '@mantine/core';
import { 
  IconUser, 
  IconId, 
  IconShield, 
  IconFileText,
  IconCamera,
  IconCheck,
  IconAlertTriangle
} from '@tabler/icons-react';
import { Patient } from '@/types/administrative';
import { getErrorMessage, getDisplayErrorMessage } from '@/utils/error.utils';

interface PatientRegistrationProps {
  onComplete: (patient: Patient) => void;
  onCancel: () => void;
}

const PatientRegistration: React.FC<PatientRegistrationProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(ResourceHistoryTable);
  const [loading, setLoading] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ status: 'none' | 'checking' | 'found' | 'clear' }>({ status: 'none' });
  const [insuranceVerificationStatus, setInsuranceVerificationStatus] = useState<'none' | 'verifying' | 'verified' | 'failed'>('none');
  const [photoCapture, setPhotoCapture] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    dateOfBirth: '',
    gender: 'U',
    ssn: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA'
    },
    phone: '',
    email: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    maritalStatus: 'Single',
    employmentStatus: 'Employed',
    preferredLanguage: 'English',
    consentForms: [] as string[]
  });

  const steps = [
    { 
      id: ResourceHistoryTable, 
      name: 'Patient Information', 
      icon: IconUser,
      description: 'Basic demographics and identification'
    },
    { 
      id: 1, 
      name: 'Contact & Demographics', 
      icon: IconId,
      description: 'Contact information and address'
    },
    { 
      id: 2, 
      name: 'Insurance Information', 
      icon: IconShield,
      description: 'Insurance verification and details'
    },
    { 
      id: 3, 
      name: 'Consent & Documentation', 
      icon: IconFileText,
      description: 'Consent forms and photo capture'
    },
    { 
      id: 4, 
      name: 'Review & Complete', 
      icon: IconCheck,
      description: 'Review and finalize registration'
    }
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
      const isVerified = Math.random() < ResourceHistoryTable.8; // 8ResourceHistoryTable% success rate for demo
      setInsuranceVerificationStatus(isVerified ? 'verified' : 'failed');
    }, 2ResourceHistoryTableResourceHistoryTableResourceHistoryTable);
  };

  const capturePhoto = () => {
    // Simulate photo capture
    setPhotoCapture('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...');
  };

  const onSubmit = async () => {
    setLoading(true);
    
    try {
      // Simulate patient registration API call
      await new Promise(resolve => setTimeout(resolve, 2ResourceHistoryTableResourceHistoryTableResourceHistoryTable));
      
      const newPatient: Patient = {
        id: `PAT-${Date.now()}`,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        dateOfBirth: new Date(formData.dateOfBirth),
        gender: formData.gender as any,
        ssn: formData.ssn,
        address: {
          ...formData.address,
          addressType: 'Home'
        },
        phone: [{ number: formData.phone, type: 'Home', isPrimary: true }],
        email: formData.email,
        emergencyContact: formData.emergencyContact,
        insurance: [],
        maritalStatus: formData.maritalStatus,
        employmentStatus: formData.employmentStatus,
        preferredLanguage: formData.preferredLanguage,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'Active',
        photographPath: photoCapture || undefined
      };
      
      onComplete(newPatient);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Registration failed:', errorMessage, error);
      // Could show user notification here if needed
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case ResourceHistoryTable:
        return (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="First Name"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.currentTarget.value }))}
                  required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Last Name"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.currentTarget.value }))}
                  required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Middle Name"
                  placeholder="Enter middle name"
                  value={formData.middleName}
                  onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.currentTarget.value }))}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Date of Birth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.currentTarget.value }))}
                  required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Gender"
                  placeholder="Select gender"
                  value={formData.gender}
                  onChange={(value) => setFormData(prev => ({ ...prev, gender: value || 'U' }))}
                  data={[
                    { value: 'U', label: 'Prefer not to specify' },
                    { value: 'M', label: 'Male' },
                    { value: 'F', label: 'Female' },
                    { value: 'O', label: 'Other' }
                  ]}
                  required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Social Security Number"
                  placeholder="XXX-XX-XXXX"
                  value={formData.ssn}
                  onChange={(e) => setFormData(prev => ({ ...prev, ssn: formatSSN(e.currentTarget.value) }))}
                  maxLength={11}
                />
              </Grid.Col>
            </Grid>

            {/* Duplicate Check Status */}
            {duplicateCheck.status !== 'none' && (
              <Alert
                icon={duplicateCheck.status === 'checking' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : 
                      duplicateCheck.status === 'found' ? <IconAlertTriangle size={16} /> : 
                      <IconCheck size={16} />}
                color={duplicateCheck.status === 'checking' ? 'yellow' : 
                       duplicateCheck.status === 'found' ? 'red' : 'green'}
                title={duplicateCheck.status === 'checking' ? 'Checking for duplicate patients...' :
                       duplicateCheck.status === 'found' ? 'Potential duplicate patient found!' :
                       'No duplicate patients found'}
              >
                {duplicateCheck.status === 'found' && (
                  <Text size="sm">
                    Please verify this is a new patient and not a duplicate record.
                  </Text>
                )}
              </Alert>
            )}
          </Stack>
        );

      case 1:
        return (
          <Stack gap="md">
            <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable}>Address Information</Text>
            <Grid>
              <Grid.Col span={12}>
                <TextInput
                  label="Street Address"
                  placeholder="Enter street address"
                  value={formData.address.street}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, street: e.currentTarget.value }
                  }))}
                  required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="City"
                  placeholder="Enter city"
                  value={formData.address.city}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, city: e.currentTarget.value }
                  }))}
                  required
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Select
                  label="State"
                  placeholder="Select state"
                  value={formData.address.state}
                  onChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, state: value || '' }
                  }))}
                  data={[
                    { value: 'AL', label: 'Alabama' },
                    { value: 'CA', label: 'California' },
                    { value: 'FL', label: 'Florida' },
                    { value: 'NY', label: 'New York' },
                    { value: 'TX', label: 'Texas' }
                  ]}
                  required
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="ZIP Code"
                  placeholder="12345"
                  value={formData.address.zipCode}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, zipCode: e.currentTarget.value }
                  }))}
                  required
                />
              </Grid.Col>
            </Grid>

            <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable} mt="xl">Contact Information</Text>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Primary Phone"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhoneNumber(e.currentTarget.value) }))}
                  maxLength={14}
                  required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.currentTarget.value }))}
                />
              </Grid.Col>
            </Grid>

            <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable} mt="xl">Emergency Contact</Text>
            <Grid>
              <Grid.Col span={4}>
                <TextInput
                  label="Contact Name"
                  placeholder="Enter contact name"
                  value={formData.emergencyContact.name}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    emergencyContact: { ...prev.emergencyContact, name: e.currentTarget.value }
                  }))}
                  required
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Select
                  label="Relationship"
                  placeholder="Select relationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    emergencyContact: { ...prev.emergencyContact, relationship: value || '' }
                  }))}
                  data={[
                    { value: 'Spouse', label: 'Spouse' },
                    { value: 'Parent', label: 'Parent' },
                    { value: 'Child', label: 'Child' },
                    { value: 'Sibling', label: 'Sibling' },
                    { value: 'Friend', label: 'Friend' },
                    { value: 'Other', label: 'Other' }
                  ]}
                  required
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Phone Number"
                  placeholder="(555) 123-4567"
                  value={formData.emergencyContact.phone}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    emergencyContact: { 
                      ...prev.emergencyContact, 
                      phone: formatPhoneNumber(e.currentTarget.value) 
                    }
                  }))}
                  maxLength={14}
                  required
                />
              </Grid.Col>
            </Grid>
          </Stack>
        );

      case 2:
        return (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable}>Insurance Information</Text>
              <Button
                onClick={verifyInsurance}
                loading={insuranceVerificationStatus === 'verifying'}
              >
                Verify Insurance
              </Button>
            </Group>

            {/* Insurance Verification Status */}
            {insuranceVerificationStatus !== 'none' && (
              <Alert
                icon={insuranceVerificationStatus === 'verifying' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : 
                      insuranceVerificationStatus === 'verified' ? <IconCheck size={16} /> : 
                      <IconAlertTriangle size={16} />}
                color={insuranceVerificationStatus === 'verifying' ? 'yellow' : 
                       insuranceVerificationStatus === 'verified' ? 'green' : 'red'}
                title={insuranceVerificationStatus === 'verifying' ? 'Verifying insurance eligibility...' :
                       insuranceVerificationStatus === 'verified' ? 'Insurance verified successfully' :
                       'Insurance verification failed'}
              >
                {insuranceVerificationStatus === 'verified' && (
                  <Text size="sm">
                    Copay: $25.ResourceHistoryTableResourceHistoryTable | Deductible: Met | Authorization: Not required
                  </Text>
                )}
              </Alert>
            )}

            <Alert color="blue" title="Insurance Collection">
              Please collect and scan insurance cards. Verification will be completed after registration.
            </Alert>
          </Stack>
        );

      case 3:
        return (
          <Stack gap="md">
            <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable}>Consent Forms and Documentation</Text>
            
            <Stack gap="sm">
              <Checkbox
                label="Consent for Treatment"
                description="Patient consents to medical treatment and procedures"
                checked={formData.consentForms.includes('treatment-consent')}
                onChange={(e) => {
                  const currentConsents = formData.consentForms;
                  if (e.currentTarget.checked) {
                    setFormData(prev => ({ ...prev, consentForms: [...currentConsents, 'treatment-consent'] }));
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      consentForms: currentConsents.filter(c => c !== 'treatment-consent') 
                    }));
                  }
                }}
              />
              
              <Checkbox
                label="HIPAA Authorization"
                description="Authorization to use and disclose protected health information"
                checked={formData.consentForms.includes('hipaa-authorization')}
                onChange={(e) => {
                  const currentConsents = formData.consentForms;
                  if (e.currentTarget.checked) {
                    setFormData(prev => ({ ...prev, consentForms: [...currentConsents, 'hipaa-authorization'] }));
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      consentForms: currentConsents.filter(c => c !== 'hipaa-authorization') 
                    }));
                  }
                }}
              />
              
              <Checkbox
                label="Financial Responsibility Agreement"
                description="Acknowledgment of financial responsibility for services"
                checked={formData.consentForms.includes('financial-responsibility')}
                onChange={(e) => {
                  const currentConsents = formData.consentForms;
                  if (e.currentTarget.checked) {
                    setFormData(prev => ({ ...prev, consentForms: [...currentConsents, 'financial-responsibility'] }));
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      consentForms: currentConsents.filter(c => c !== 'financial-responsibility') 
                    }));
                  }
                }}
              />
            </Stack>

            {/* Photo Capture */}
            <div>
              <Text size="md" fw={6ResourceHistoryTableResourceHistoryTable} mb="sm">Patient Photograph (Optional)</Text>
              <Group gap="md">
                {photoCapture ? (
                  <div style={{ position: 'relative' }}>
                    <Avatar src={photoCapture} size="xl" />
                    <ActionIcon
                      color="red"
                      size="sm"
                      style={{ position: 'absolute', top: -8, right: -8 }}
                      onClick={() => setPhotoCapture(null)}
                    >
                      ×
                    </ActionIcon>
                  </div>
                ) : (
                  <Avatar size="xl">
                    <IconCamera size={24} />
                  </Avatar>
                )}
                <Button
                  variant="light"
                  leftSection={<IconCamera size={16} />}
                  onClick={capturePhoto}
                >
                  {photoCapture ? 'Retake Photo' : 'Take Photo'}
                </Button>
              </Group>
            </div>
          </Stack>
        );

      case 4:
        return (
          <Stack gap="md">
            <Text size="lg" fw={6ResourceHistoryTableResourceHistoryTable}>Review and Complete Registration</Text>
            
            <Card padding="lg" withBorder>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="md" fw={6ResourceHistoryTableResourceHistoryTable} mb="sm">Patient Information</Text>
                  <Stack gap="xs">
                    <div>
                      <Text size="sm" c="dimmed">Name:</Text>
                      <Text size="sm">{formData.firstName} {formData.middleName} {formData.lastName}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">DOB:</Text>
                      <Text size="sm">{formData.dateOfBirth ? new Date(formData.dateOfBirth).toLocaleDateString() : ''}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">Gender:</Text>
                      <Text size="sm">{formData.gender}</Text>
                    </div>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Text size="md" fw={6ResourceHistoryTableResourceHistoryTable} mb="sm">Contact Information</Text>
                  <Stack gap="xs">
                    <div>
                      <Text size="sm" c="dimmed">Phone:</Text>
                      <Text size="sm">{formData.phone}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">Email:</Text>
                      <Text size="sm">{formData.email || 'Not provided'}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">Address:</Text>
                      <Text size="sm">
                        {formData.address.street}, {formData.address.city}, {formData.address.state} {formData.address.zipCode}
                      </Text>
                    </div>
                  </Stack>
                </Grid.Col>
              </Grid>
            </Card>

            <Alert color="green" icon={<IconCheck size={16} />} title="Registration Complete">
              Patient portal credentials will be provided upon successful registration.
            </Alert>
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <LoadingOverlay visible={loading} />
      
      <Stack gap="xl">
        {/* Progress Steps */}
        <Card padding="lg" withBorder>
          <Stepper active={currentStep}>
            {steps.map((step) => (
              <Stepper.Step 
                key={step.id} 
                label={step.name}
                description={step.description}
                icon={<step.icon size={18} />}
              />
            ))}
          </Stepper>
        </Card>

        {/* Form Content */}
        <Card padding="lg" withBorder>
          {renderStepContent()}
        </Card>

        {/* Form Actions */}
        <Card padding="lg" withBorder>
          <Group justify="space-between">
            <div>
              {currentStep > ResourceHistoryTable && (
                <Button
                  variant="light"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Previous
                </Button>
              )}
            </div>

            <Group gap="sm">
              <Button
                variant="light"
                onClick={onCancel}
              >
                Cancel
              </Button>
              
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={onSubmit}
                  loading={loading}
                  color="green"
                >
                  Complete Registration
                </Button>
              )}
            </Group>
          </Group>
        </Card>
      </Stack>
    </div>
  );
};

export default PatientRegistration;