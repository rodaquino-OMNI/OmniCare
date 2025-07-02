import { 
  getErrorMessage, 
  getDisplayErrorMessage, 
  isNetworkError,
  isFHIRError,
  formatErrorForUser 
} from '../error.utils';

describe('Error Utils', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return string as-is', () => {
      const error = 'String error message';
      expect(getErrorMessage(error)).toBe('String error message');
    });

    it('should handle null/undefined', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
    });

    it('should handle objects with message property', () => {
      const error = { message: 'Object error message' };
      expect(getErrorMessage(error)).toBe('Object error message');
    });

    it('should stringify objects without message property', () => {
      const error = { code: 404, status: 'Not Found' };
      expect(getErrorMessage(error)).toContain('404');
    });
  });

  describe('getDisplayErrorMessage', () => {
    it('should return user-friendly message for common errors', () => {
      const networkError = new Error('Network request failed');
      expect(getDisplayErrorMessage(networkError)).toContain('connection');
    });

    it('should return original message for unknown errors', () => {
      const customError = new Error('Custom error message');
      expect(getDisplayErrorMessage(customError)).toBe('Custom error message');
    });
  });

  describe('isNetworkError', () => {
    it('should identify network errors', () => {
      const networkError = new Error('Network request failed');
      expect(isNetworkError(networkError)).toBe(true);
      
      const fetchError = new Error('Failed to fetch');
      expect(isNetworkError(fetchError)).toBe(true);
      
      const timeoutError = new Error('The operation timed out');
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it('should not identify non-network errors as network errors', () => {
      const validationError = new Error('Invalid input');
      expect(isNetworkError(validationError)).toBe(false);
    });
  });

  describe('isFHIRError', () => {
    it('should identify FHIR errors', () => {
      const fhirError = {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'invalid' }]
      };
      expect(isFHIRError(fhirError)).toBe(true);
    });

    it('should not identify non-FHIR errors as FHIR errors', () => {
      const regularError = new Error('Regular error');
      expect(isFHIRError(regularError)).toBe(false);
    });
  });

  describe('formatErrorForUser', () => {
    it('should format errors for user display', () => {
      const error = new Error('Test error');
      const formatted = formatErrorForUser(error);
      expect(formatted).toHaveProperty('title');
      expect(formatted).toHaveProperty('message');
      expect(formatted).toHaveProperty('type');
    });

    it('should categorize network errors', () => {
      const networkError = new Error('Network request failed');
      const formatted = formatErrorForUser(networkError);
      expect(formatted.type).toBe('network');
    });

    it('should categorize FHIR errors', () => {
      const fhirError = {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Invalid resource' }]
      };
      const formatted = formatErrorForUser(fhirError);
      expect(formatted.type).toBe('fhir');
    });
  });
});