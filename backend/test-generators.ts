// Quick test to validate generators compile and work
import { PatientGenerator } from './tests/fixtures/generators/patient-generator';
import { PractitionerGenerator } from './tests/fixtures/generators/practitioner-generator';

console.log('Testing patient generator...');
try {
  const patient = PatientGenerator.generatePatient();
  console.log('✓ Patient generated successfully');
  console.log('✓ Has createdAt:', !!patient.createdAt);
  console.log('✓ Has updatedAt:', !!patient.updatedAt);
  console.log('✓ Has id:', !!patient.id);
  console.log('✓ Has resourceType:', patient.resourceType);
} catch (error) {
  console.error('✗ Patient generator failed:', error);
}

console.log('\nTesting practitioner generator...');
try {
  const practitioner = PractitionerGenerator.generatePractitioner();
  console.log('✓ Practitioner generated successfully');
  console.log('✓ Has createdAt:', !!practitioner.createdAt);
  console.log('✓ Has updatedAt:', !!practitioner.updatedAt);
  console.log('✓ Has id:', !!practitioner.id);
  console.log('✓ Has resourceType:', practitioner.resourceType);
} catch (error) {
  console.error('✗ Practitioner generator failed:', error);
}