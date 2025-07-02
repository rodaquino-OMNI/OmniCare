// Mock MedplumClient class and utilities
export class MedplumClient {
  constructor(options?: any) {
    this.options = options || {};
  }

  options: any;

  // Search methods
  search = jest.fn().mockResolvedValue({ entry: [] });
  searchResources = jest.fn().mockResolvedValue([]);
  searchOne = jest.fn().mockResolvedValue(null);
  searchValueSet = jest.fn().mockResolvedValue({ expansion: { contains: [] } });

  // CRUD methods
  createResource = jest.fn().mockImplementation((resource) => Promise.resolve({ ...resource, id: 'test-id' }));
  updateResource = jest.fn().mockImplementation((resource) => Promise.resolve(resource));
  readResource = jest.fn().mockResolvedValue({});
  deleteResource = jest.fn().mockResolvedValue({});
  patchResource = jest.fn().mockResolvedValue({});
  
  // History and versions
  readHistory = jest.fn().mockResolvedValue({ entry: [] });
  readVersion = jest.fn().mockResolvedValue({});
  
  // References
  readReference = jest.fn().mockResolvedValue({});
  
  // Binary data
  createBinary = jest.fn().mockResolvedValue({ id: 'binary-id', resourceType: 'Binary' });
  readBinary = jest.fn().mockResolvedValue(new Blob(['test']));
  
  // Authentication
  startLogin = jest.fn().mockResolvedValue({});
  startNewUser = jest.fn().mockResolvedValue({});
  startNewProject = jest.fn().mockResolvedValue({});
  startNewPatient = jest.fn().mockResolvedValue({});
  processCode = jest.fn().mockResolvedValue({});
  signOut = jest.fn().mockResolvedValue(undefined);
  getActiveLogin = jest.fn().mockReturnValue(null);
  setActiveLogin = jest.fn();
  
  // Profile and access
  getProfile = jest.fn().mockReturnValue(null);
  getProfileAsync = jest.fn().mockResolvedValue(null);
  getAccessToken = jest.fn().mockReturnValue('test-token');
  refreshToken = jest.fn().mockResolvedValue('new-test-token');
  
  // User management
  invite = jest.fn().mockResolvedValue({});
  
  // Request methods
  request = jest.fn().mockResolvedValue({});
  get = jest.fn().mockResolvedValue({});
  post = jest.fn().mockResolvedValue({});
  put = jest.fn().mockResolvedValue({});
  patch = jest.fn().mockResolvedValue({});
  delete = jest.fn().mockResolvedValue({});
  
  // Batch operations
  executeBatch = jest.fn().mockResolvedValue({ entry: [] });
  
  // GraphQL
  graphql = jest.fn().mockResolvedValue({ data: {} });
  
  // Operations
  executeBot = jest.fn().mockResolvedValue({});
  
  // Storage
  uploadMedia = jest.fn().mockResolvedValue({ url: 'https://example.com/media' });
  downloadMedia = jest.fn().mockResolvedValue(new Blob(['test']));
  
  // Smart App Launch
  getAuthorizeUrl = jest.fn().mockReturnValue('https://example.com/authorize');
  exchangeCode = jest.fn().mockResolvedValue({});
  
  // Subscriptions
  subscribeToCriteria = jest.fn().mockReturnValue({ close: jest.fn() });
  
  // Utilities
  invalidateAll = jest.fn();
  getCached = jest.fn().mockReturnValue(null);
  invalidateSearches = jest.fn();
  
  // EventTarget interface
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn().mockReturnValue(true);
}

// Mock storage class
export class ClientStorage {
  getObject = jest.fn().mockReturnValue(null);
  setObject = jest.fn();
  removeObject = jest.fn();
  clear = jest.fn();
}

// Mock MemoryStorage
export class MemoryStorage extends ClientStorage {
  constructor() {
    super();
    this.data = new Map();
  }
  
  data: Map<string, any>;
  
  getObject = jest.fn((key: string) => this.data.get(key) || null);
  setObject = jest.fn((key: string, value: any) => { this.data.set(key, value); });
  removeObject = jest.fn((key: string) => { this.data.delete(key); });
  clear = jest.fn(() => { this.data.clear(); });
}

// Mock OperationOutcome utilities
export const isOperationOutcome = jest.fn((resource: any) => {
  return resource?.resourceType === 'OperationOutcome';
});

export const getErrorsFromOperationOutcome = jest.fn((outcome: any) => {
  if (!outcome?.issue) return [];
  return outcome.issue.map((issue: any) => issue.diagnostics || issue.details?.text || 'Unknown error');
});

// Mock reference utilities
export const createReference = jest.fn((resource: any) => {
  if (!resource) return null;
  const resourceType = resource.resourceType || 'Patient';
  const id = resource.id || 'unknown-id';
  return { reference: `${resourceType}/${id}` };
});

export const getReferenceString = jest.fn((reference: any) => {
  if (typeof reference === 'string') return reference;
  return reference?.reference || '';
});

export const parseReference = jest.fn((reference: any) => {
  const refString = getReferenceString(reference);
  const [resourceType, id] = refString.split('/');
  return { resourceType, id };
});

// Mock search utilities
export const parseSearchRequest = jest.fn((url: string) => {
  const urlObj = new URL(url, 'https://example.com');
  const resourceType = urlObj.pathname.split('/').pop() || '';
  const params: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return { resourceType, params };
});

export const formatSearchQuery = jest.fn((params: any) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
});

// Mock date/time utilities
export const formatDateTime = jest.fn((date: any) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString();
});

export const formatDate = jest.fn((date: any) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
});

export const formatTime = jest.fn((date: any) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toTimeString().split(' ')[0];
});

// Mock human name utilities
export const formatHumanName = jest.fn((name: any) => {
  if (!name) return '';
  const parts = [];
  if (name.prefix?.length) parts.push(...name.prefix);
  if (name.given?.length) parts.push(...name.given);
  if (name.family) parts.push(name.family);
  if (name.suffix?.length) parts.push(...name.suffix);
  return parts.join(' ');
});

export const getDisplayString = jest.fn((resource: any) => {
  if (!resource) return '';
  
  // Handle different resource types
  switch (resource.resourceType) {
    case 'Patient':
      return resource.name?.[0] ? formatHumanName(resource.name[0]) : 'Unknown Patient';
    case 'Practitioner':
      return resource.name?.[0] ? formatHumanName(resource.name[0]) : 'Unknown Practitioner';
    case 'Organization':
      return resource.name || 'Unknown Organization';
    case 'Encounter':
      return `Encounter ${resource.id || 'Unknown'}`;
    case 'Observation':
      return resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown Observation';
    default:
      return resource.name || resource.title || resource.description || `${resource.resourceType} ${resource.id || 'Unknown'}`;
  }
});

// Mock coding utilities
export const getCodeBySystem = jest.fn((codings: any[], system: string) => {
  if (!Array.isArray(codings)) return undefined;
  return codings.find(c => c.system === system);
});

export const getExtension = jest.fn((resource: any, url: string) => {
  if (!resource?.extension) return undefined;
  return resource.extension.find((ext: any) => ext.url === url);
});

export const getExtensionValue = jest.fn((resource: any, url: string) => {
  const ext = getExtension(resource, url);
  if (!ext) return undefined;
  
  // Return the first value property found
  const valueKeys = Object.keys(ext).filter(k => k.startsWith('value'));
  if (valueKeys.length > 0) {
    return ext[valueKeys[0]];
  }
  return undefined;
});

// Mock identifier utilities
export const getIdentifier = jest.fn((resource: any, system: string) => {
  if (!resource?.identifier) return undefined;
  return resource.identifier.find((id: any) => id.system === system);
});

// Mock address utilities
export const formatAddress = jest.fn((address: any) => {
  if (!address) return '';
  const parts = [];
  if (address.line?.length) parts.push(...address.line);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);
  return parts.join(', ');
});

// Mock contact point utilities
export const formatContactPoint = jest.fn((contactPoint: any) => {
  if (!contactPoint) return '';
  const system = contactPoint.system || '';
  const value = contactPoint.value || '';
  const use = contactPoint.use || '';
  
  switch (system) {
    case 'phone':
      return `Phone${use ? ` (${use})` : ''}: ${value}`;
    case 'email':
      return `Email${use ? ` (${use})` : ''}: ${value}`;
    case 'fax':
      return `Fax${use ? ` (${use})` : ''}: ${value}`;
    default:
      return value;
  }
});

// Mock period utilities
export const isPeriodActive = jest.fn((period: any) => {
  if (!period) return true;
  const now = new Date();
  const start = period.start ? new Date(period.start) : null;
  const end = period.end ? new Date(period.end) : null;
  
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
});

// Export MockClient for compatibility
export class MockClient extends MedplumClient {
  constructor(options?: any) {
    super(options);
  }
}

// Export default
export default {
  MedplumClient,
  MockClient,
  ClientStorage,
  MemoryStorage,
  isOperationOutcome,
  getErrorsFromOperationOutcome,
  createReference,
  getReferenceString,
  parseReference,
  parseSearchRequest,
  formatSearchQuery,
  formatDateTime,
  formatDate,
  formatTime,
  formatHumanName,
  getDisplayString,
  getCodeBySystem,
  getExtension,
  getExtensionValue,
  getIdentifier,
  formatAddress,
  formatContactPoint,
  isPeriodActive,
};