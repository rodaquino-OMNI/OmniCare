import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '@test-utils/test-providers';
import AttachmentManager from '../AttachmentManager';
import '@testing-library/jest-dom';

// Mock file objects
const mockImageFile = new File(['image content'], 'test-image.jpg', { type: 'image/jpeg' });
const mockPdfFile = new File(['pdf content'], 'test-document.pdf', { type: 'application/pdf' });
const mockLargeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large-file.jpg', { type: 'image/jpeg' });

// Mock attachments data
const mockAttachments = [
  {
    id: '1',
    filename: 'patient-xray.jpg',
    fileType: 'image/jpeg',
    fileSize: 2048576,
    uploadedAt: '2024-01-01T10:00:00Z',
    uploadedBy: 'Dr. Smith',
    url: 'https://example.com/files/1',
    thumbnailUrl: 'https://example.com/thumbnails/1',
    isEncrypted: true,
  },
  {
    id: '2',
    filename: 'lab-results.pdf',
    fileType: 'application/pdf',
    fileSize: 524288,
    uploadedAt: '2024-01-02T14:30:00Z',
    uploadedBy: 'Lab Tech',
    url: 'https://example.com/files/2',
    thumbnailUrl: null,
    isEncrypted: true,
  },
];

// Mock services
jest.mock('@/services/attachment.service', () => ({
  uploadAttachment: jest.fn().mockResolvedValue({ id: 'new-attachment-id', url: 'https://example.com/files/new' }),
  deleteAttachment: jest.fn().mockResolvedValue(true),
  generateThumbnail: jest.fn().mockResolvedValue('data:image/jpeg;base64,thumbnail'),
  validateFile: jest.fn().mockReturnValue({ isValid: true }),
  encryptFile: jest.fn().mockResolvedValue('encrypted-file-data'),
}));

jest.mock('@/services/encryption.service', () => ({
  encryptAttachment: jest.fn().mockResolvedValue('encrypted-data'),
  decryptAttachment: jest.fn().mockResolvedValue('decrypted-data'),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');

describe('AttachmentManager', () => {
  const defaultProps = {
    attachments: mockAttachments,
    onAttachmentAdd: jest.fn(),
    onAttachmentRemove: jest.fn(),
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/*', 'application/pdf', 'text/*'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders attachment manager with existing attachments', () => {
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('patient-xray.jpg')).toBeInTheDocument();
    expect(screen.getByText('lab-results.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 files attached')).toBeInTheDocument();
  });

  it('displays file information correctly', () => {
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    // Check file sizes are displayed properly
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    expect(screen.getByText('512 KB')).toBeInTheDocument();
    
    // Check upload information
    expect(screen.getByText('Uploaded by Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Uploaded by Lab Tech')).toBeInTheDocument();
  });

  it('handles drag and drop file upload', async () => {
    const user = userEvent.setup();
    const onAttachmentAdd = jest.fn();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} onAttachmentAdd={onAttachmentAdd} />
      </TestProviders>
    );

    const dropzone = screen.getByRole('button', { name: /drop files here/i });
    
    // Simulate drag enter
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        files: [mockImageFile],
        types: ['Files'],
      },
    });

    expect(dropzone).toHaveClass('drag-over');

    // Simulate drop
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockImageFile],
      },
    });

    await waitFor(() => {
      expect(onAttachmentAdd).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'test-image.jpg',
        fileType: 'image/jpeg',
      }));
    });
  });

  it('handles file selection via input', async () => {
    const user = userEvent.setup();
    const onAttachmentAdd = jest.fn();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} onAttachmentAdd={onAttachmentAdd} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, mockPdfFile);

    await waitFor(() => {
      expect(onAttachmentAdd).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'test-document.pdf',
        fileType: 'application/pdf',
      }));
    });
  });

  it('validates file size limits', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, mockLargeFile);

    await waitFor(() => {
      expect(screen.getByText(/file size exceeds limit/i)).toBeInTheDocument();
    });
  });

  it('validates file types', async () => {
    const user = userEvent.setup();
    const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' });
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText(/file type not allowed/i)).toBeInTheDocument();
    });
  });

  it('shows upload progress', async () => {
    const user = userEvent.setup();
    
    // Mock slow upload
    jest.mocked(require('@/services/attachment.service').uploadAttachment)
      .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ id: 'test' }), 1000)));
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, mockImageFile);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it('handles upload errors', async () => {
    const user = userEvent.setup();
    
    // Mock upload failure
    jest.mocked(require('@/services/attachment.service').uploadAttachment)
      .mockRejectedValue(new Error('Upload failed'));
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, mockImageFile);

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });
  });

  it('previews images in modal', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const imageAttachment = screen.getByText('patient-xray.jpg');
    await user.click(imageAttachment);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByAltText('patient-xray.jpg')).toBeInTheDocument();
  });

  it('downloads attachments', async () => {
    const user = userEvent.setup();
    const mockDownload = jest.fn();
    global.document.createElement = jest.fn().mockReturnValue({
      href: '',
      download: '',
      click: mockDownload,
    });
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const downloadButton = screen.getAllByRole('button', { name: /download/i })[0];
    await user.click(downloadButton);

    expect(mockDownload).toHaveBeenCalled();
  });

  it('deletes attachments with confirmation', async () => {
    const user = userEvent.setup();
    const onAttachmentRemove = jest.fn();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} onAttachmentRemove={onAttachmentRemove} />
      </TestProviders>
    );

    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    await user.click(deleteButton);

    expect(screen.getByText(/delete attachment/i)).toBeInTheDocument();
    
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    await user.click(confirmButton);

    expect(onAttachmentRemove).toHaveBeenCalledWith('1');
  });

  it('supports multiple file selection', async () => {
    const user = userEvent.setup();
    const onAttachmentAdd = jest.fn();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} onAttachmentAdd={onAttachmentAdd} multiple={true} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, [mockImageFile, mockPdfFile]);

    await waitFor(() => {
      expect(onAttachmentAdd).toHaveBeenCalledTimes(2);
    });
  });

  it('shows file encryption status', () => {
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    expect(screen.getAllByLabelText(/encrypted/i)).toHaveLength(2);
  });

  it('handles OCR for image files', async () => {
    const user = userEvent.setup();
    
    // Mock OCR service
    jest.mock('@/services/ocr.service', () => ({
      extractText: jest.fn().mockResolvedValue('Extracted text from image'),
    }));
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} enableOCR={true} />
      </TestProviders>
    );

    const ocrButton = screen.getByRole('button', { name: /extract text/i });
    await user.click(ocrButton);

    await waitFor(() => {
      expect(screen.getByText('Extracted text from image')).toBeInTheDocument();
    });
  });

  it('supports annotation on PDF files', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} enableAnnotation={true} />
      </TestProviders>
    );

    const annotateButton = screen.getByRole('button', { name: /annotate/i });
    await user.click(annotateButton);

    expect(screen.getByText('PDF Annotation Tool')).toBeInTheDocument();
  });

  it('handles offline mode for attachments', () => {
    const offlineAttachments = [
      {
        ...mockAttachments[0],
        isOffline: true,
        localUrl: 'blob:local-url',
      },
    ];
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} attachments={offlineAttachments} />
      </TestProviders>
    );

    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('supports version control for attachments', async () => {
    const user = userEvent.setup();
    const versionedAttachment = {
      ...mockAttachments[0],
      versions: [
        { version: 1, uploadedAt: '2024-01-01T10:00:00Z' },
        { version: 2, uploadedAt: '2024-01-02T10:00:00Z' },
      ],
    };
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} attachments={[versionedAttachment]} enableVersioning={true} />
      </TestProviders>
    );

    const versionButton = screen.getByRole('button', { name: /version history/i });
    await user.click(versionButton);

    expect(screen.getByText('Version History')).toBeInTheDocument();
    expect(screen.getByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
  });

  it('handles accessibility features', () => {
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    expect(fileInput).toHaveAttribute('aria-describedby');
    
    const attachmentList = screen.getByRole('list');
    expect(attachmentList).toHaveAttribute('aria-label', 'File attachments');
    
    const attachmentItems = screen.getAllByRole('listitem');
    attachmentItems.forEach(item => {
      expect(item).toHaveAttribute('tabIndex');
    });
  });

  it('supports bulk operations', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} enableBulkOperations={true} />
      </TestProviders>
    );

    // Select multiple attachments
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk download/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk delete/i })).toBeInTheDocument();
  });

  it('shows thumbnail for supported file types', () => {
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} />
      </TestProviders>
    );

    const imageThumbnail = screen.getByAltText('Thumbnail for patient-xray.jpg');
    expect(imageThumbnail).toBeInTheDocument();
    expect(imageThumbnail).toHaveAttribute('src', 'https://example.com/thumbnails/1');
  });

  it('handles file compression for large uploads', async () => {
    const user = userEvent.setup();
    
    // Mock compression service
    jest.mock('@/services/compression.service', () => ({
      compressImage: jest.fn().mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' })),
    }));
    
    render(
      <TestProviders>
        <AttachmentManager {...defaultProps} enableCompression={true} />
      </TestProviders>
    );

    const fileInput = screen.getByLabelText(/upload files/i);
    await user.upload(fileInput, mockImageFile);

    await waitFor(() => {
      expect(screen.getByText(/compressing/i)).toBeInTheDocument();
    });
  });
});
