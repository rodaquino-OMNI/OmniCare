import { Patient, HumanName } from '@medplum/fhirtypes';

/**
 * Extract the primary name from a FHIR Patient resource
 */
export function getPatientName(patient: Patient): { firstName: string; lastName: string; fullName: string } {
  if (!patient.name || patient.name.length === 0) {
    return { firstName: '', lastName: '', fullName: 'Unknown Patient' };
  }

  // Find the primary name (usually 'official' or the first one)
  const primaryName = patient.name.find(name => name.use === 'official') || patient.name[0];
  
  const firstName = primaryName.given?.join(' ') || '';
  const lastName = primaryName.family || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Patient';

  return { firstName, lastName, fullName };
}

/**
 * Get patient display name for UI
 */
export function getPatientDisplayName(patient: Patient): string {
  const { fullName } = getPatientName(patient);
  return fullName;
}

/**
 * Get patient MRN (Medical Record Number)
 */
export function getPatientMRN(patient: Patient): string {
  if (!patient.identifier) return '';
  
  // Look for MRN identifier
  const mrnIdentifier = patient.identifier.find(
    id => id.type?.coding?.some(c => c.code === 'MR' || c.code === 'MRN')
  );
  
  if (mrnIdentifier) {
    return mrnIdentifier.value || '';
  }
  
  // Fallback to first identifier
  return patient.identifier[0]?.value || '';
}

/**
 * Get patient date of birth
 */
export function getPatientBirthDate(patient: Patient): string {
  return patient.birthDate || '';
}

/**
 * Get patient status - FHIR doesn't have a direct status field
 * This is typically derived from other fields or extensions
 */
export function getPatientStatus(patient: Patient): string {
  // Check if patient is active (default to active if not specified)
  if (patient.active === false) {
    return 'inactive';
  }
  
  // Check if patient is deceased
  if (patient.deceasedBoolean || patient.deceasedDateTime) {
    return 'deceased';
  }
  
  return 'active';
}

/**
 * Get patient phone number
 */
export function getPatientPhone(patient: Patient): string {
  if (!patient.telecom) return '';
  
  const phone = patient.telecom.find(t => t.system === 'phone');
  return phone?.value || '';
}

/**
 * Get patient email
 */
export function getPatientEmail(patient: Patient): string {
  if (!patient.telecom) return '';
  
  const email = patient.telecom.find(t => t.system === 'email');
  return email?.value || '';
}

/**
 * Get patient address as a formatted string
 */
export function getPatientAddress(patient: Patient): string {
  if (!patient.address || patient.address.length === 0) return '';
  
  const primaryAddress = patient.address.find(addr => addr.use === 'home') || patient.address[0];
  
  const parts = [
    primaryAddress.line?.join(', '),
    primaryAddress.city,
    primaryAddress.state,
    primaryAddress.postalCode
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Create a patient object with common extended properties for UI
 */
export function extendPatientForUI(patient: Patient) {
  const { firstName, lastName, fullName } = getPatientName(patient);
  
  return {
    ...patient,
    // Extended properties for UI convenience
    firstName,
    lastName,
    fullName,
    mrn: getPatientMRN(patient),
    dateOfBirth: getPatientBirthDate(patient),
    status: getPatientStatus(patient),
    phone: getPatientPhone(patient),
    email: getPatientEmail(patient),
    address: getPatientAddress(patient)
  };
}

// Type for extended patient with UI properties
export type UIPatient = Patient & {
  firstName: string;
  lastName: string;
  fullName: string;
  mrn: string;
  dateOfBirth: string;
  status: string;
  phone: string;
  email: string;
  address: string;
};