import React from 'react';

// Mock DocumentEditor component
export const DocumentEditor = React.forwardRef(({ reference, onSave, ...props }: any, ref: any) => (
  <div 
    ref={ref}
    data-testid="medplum-document-editor"
    data-reference={JSON.stringify(reference)}
    {...props}
  >
    <textarea 
      placeholder="Document content..."
      onChange={(e) => {
        if (onSave) {
          onSave({
            content: [{
              attachment: {
                data: btoa(e.target.value)
              }
            }]
          });
        }
      }}
    />
  </div>
));

// Mock Document component
export const Document = ({ value, reference, onEdit, ...props }: any) => (
  <div 
    data-testid="medplum-document"
    data-value={JSON.stringify(value)}
    data-reference={JSON.stringify(reference)}
    onClick={onEdit}
    {...props}
  >
    {JSON.stringify(value || reference)}
  </div>
);

// Mock NoteDisplay component
export const NoteDisplay = ({ note, ...props }: any) => (
  <div 
    data-testid="medplum-note-display"
    data-note={JSON.stringify(note)}
    {...props}
  >
    {note?.content || 'Note content'}
  </div>
);

// Create persistent mock functions that can be accessed across test calls
const mockMedplumClient = {
  search: jest.fn().mockResolvedValue({ entry: [] }),
  searchResources: jest.fn().mockResolvedValue([]),
  createResource: jest.fn().mockResolvedValue({}),
  updateResource: jest.fn().mockResolvedValue({}),
  readResource: jest.fn().mockResolvedValue({}),
  deleteResource: jest.fn().mockResolvedValue({}),
};

// Mock useMedplum hook - return the client directly as expected by tests
export const useMedplum = () => mockMedplumClient;

// Mock createReference function
export const createReference = (resource: any) => {
  if (!resource) return null;
  const resourceType = resource.resourceType || 'Patient';
  const id = resource.id || 'unknown-id';
  return { reference: `${resourceType}/${id}` };
};

// Mock useResource hook
export const useResource = (reference: any) => {
  return { resource: null, loading: false, error: null };
};

// Mock ResourceTable component
export const ResourceTable = ({ value, ...props }: any) => (
  <div 
    data-testid="medplum-resource-table"
    data-value={JSON.stringify(value)}
    {...props}
  >
    <table>
      <tbody>
        <tr><td>Resource table mock</td></tr>
      </tbody>
    </table>
  </div>
);

// Mock MedicationRequestInput component
export const MedicationRequestInput = ({ value, onChange, ...props }: any) => (
  <div 
    data-testid="medplum-medication-request-input"
    data-value={JSON.stringify(value)}
    {...props}
  >
    <input 
      placeholder="Medication request..."
      onChange={(e) => onChange && onChange({ medication: e.target.value })}
    />
  </div>
);

// Mock MedicationRequestDisplay component
export const MedicationRequestDisplay = ({ value, ...props }: any) => (
  <div 
    data-testid="medplum-medication-request-display"
    data-value={JSON.stringify(value)}
    {...props}
  >
    {value?.medication || 'Medication display'}
  </div>
);

// MedplumProvider component
export const MedplumProvider = ({ children, medplum }: any) => (
  <div data-testid="medplum-provider">{children}</div>
);

// Mock useMedplumContext hook
export const useMedplumContext = () => ({
  medplum: mockMedplumClient,
  loading: false,
  profile: null
});

// Mock ResourceInput component
export const ResourceInput = ({ name, value, onChange, ...props }: any) => (
  <div data-testid="medplum-resource-input" {...props}>
    <input
      name={name}
      value={JSON.stringify(value || {})}
      onChange={(e) => {
        try {
          const parsed = JSON.parse(e.target.value);
          onChange?.(parsed);
        } catch {
          onChange?.(e.target.value);
        }
      }}
      placeholder="Resource input"
    />
  </div>
);

// Mock ResourceDisplay component
export const ResourceDisplay = ({ value, ...props }: any) => (
  <div 
    data-testid="medplum-resource-display"
    data-value={JSON.stringify(value)}
    {...props}
  >
    {value ? JSON.stringify(value, null, 2) : 'No resource'}
  </div>
);

// Mock ResourceForm component
export const ResourceForm = ({ defaultValue, onSubmit, ...props }: any) => (
  <form
    data-testid="medplum-resource-form"
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit?.(defaultValue);
    }}
    {...props}
  >
    <textarea
      defaultValue={JSON.stringify(defaultValue || {}, null, 2)}
      placeholder="Resource form"
    />
    <button type="submit">Submit</button>
  </form>
);

// Mock PatientSummary component
export const PatientSummary = ({ patient, ...props }: any) => (
  <div 
    data-testid="medplum-patient-summary"
    data-patient={JSON.stringify(patient)}
    {...props}
  >
    {patient?.name?.[0]?.given?.[0]} {patient?.name?.[0]?.family}
  </div>
);

// Export getMedplumClient for tests that might need it
export const getMedplumClient = () => mockMedplumClient;

// Set display names for debugging
DocumentEditor.displayName = 'DocumentEditor';
Document.displayName = 'Document';
NoteDisplay.displayName = 'NoteDisplay';
MedicationRequestInput.displayName = 'MedicationRequestInput';
MedicationRequestDisplay.displayName = 'MedicationRequestDisplay';
MedplumProvider.displayName = 'MedplumProvider';
ResourceInput.displayName = 'ResourceInput';
ResourceDisplay.displayName = 'ResourceDisplay';
ResourceForm.displayName = 'ResourceForm';
PatientSummary.displayName = 'PatientSummary';