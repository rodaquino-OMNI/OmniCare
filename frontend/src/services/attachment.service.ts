/**
 * Attachment Service
 * Manages file attachments for clinical notes
 */

export interface Attachment {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
  thumbnailUrl: string | null;
  isEncrypted: boolean;
  isOffline?: boolean;
  localUrl?: string;
  versions?: Array<{ version: number; uploadedAt: string }>;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export class AttachmentService {
  async uploadAttachment(file: File): Promise<{ id: string; url: string }> {
    // Stub implementation - return fake ID and URL
    return {
      id: 'attachment-' + Date.now(),
      url: 'https://example.com/files/' + Date.now()
    };
  }

  async deleteAttachment(id: string): Promise<boolean> {
    // Stub implementation - always succeed
    return true;
  }

  async generateThumbnail(file: File): Promise<string> {
    // Stub implementation - return fake thumbnail data URL
    return 'data:image/jpeg;base64,thumbnail';
  }

  validateFile(file: File, maxSize?: number, allowedTypes?: string[]): FileValidationResult {
    // Basic validation stub
    if (maxSize && file.size > maxSize) {
      return { isValid: false, error: 'File size exceeds limit' };
    }
    
    if (allowedTypes && allowedTypes.length > 0) {
      const isAllowed = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          const baseType = type.slice(0, -2);
          return file.type.startsWith(baseType);
        }
        return file.type === type;
      });
      
      if (!isAllowed) {
        return { isValid: false, error: 'File type not allowed' };
      }
    }
    
    return { isValid: true };
  }

  async encryptFile(file: File): Promise<string> {
    // Stub implementation - return fake encrypted data
    return 'encrypted-file-data';
  }
}

// Default export for convenience
export default new AttachmentService();