/**
 * File Upload Performance Tests
 * Tests for medical document and image upload performance
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

import supertest from 'supertest';

import { PerformanceTestBase, TestConfiguration } from '../framework/performance-test-base';

export interface FileUploadMetrics {
  totalFiles: number;
  totalSize: number;
  successfulUploads: number;
  failedUploads: number;
  avgUploadTime: number;
  avgThroughput: number; // MB/s
  maxFileSize: number;
  minFileSize: number;
  filesPerSecond: number;
}

export class FileUploadPerformanceTests extends PerformanceTestBase {
  private app: any;
  private authToken: string = '';
  private testFiles: Map<string, Buffer> = new Map();
  private uploadMetrics: FileUploadMetrics;

  constructor(app: any, config: TestConfiguration) {
    super(config);
    this.app = app;
    this.uploadMetrics = this.initializeUploadMetrics();
  }

  private initializeUploadMetrics(): FileUploadMetrics {
    return {
      totalFiles: 0,
      totalSize: 0,
      successfulUploads: 0,
      failedUploads: 0,
      avgUploadTime: 0,
      avgThroughput: 0,
      maxFileSize: 0,
      minFileSize: Number.MAX_SAFE_INTEGER,
      filesPerSecond: 0
    };
  }

  /**
   * Setup test files and authentication
   */
  async setup(): Promise<void> {
    console.log('Setting up file upload performance test environment...');
    
    await this.authenticate();
    await this.generateTestFiles();
    
    console.log('File upload performance test setup completed');
  }

  /**
   * Authenticate and get token
   */
  private async authenticate(): Promise<void> {
    const response = await supertest(this.app)
      .post('/auth/login')
      .send({
        username: 'filetest@omnicare.com',
        password: 'testpassword123'
      });

    if (response.status === 200 && response.body.accessToken) {
      this.authToken = response.body.accessToken;
    } else {
      throw new Error('Failed to authenticate for file upload tests');
    }
  }

  /**
   * Generate test files of various sizes and types
   */
  private async generateTestFiles(): Promise<void> {
    console.log('Generating test files...');

    // Medical document types and sizes
    const fileConfigs = [
      // Small files (typical lab reports)
      { type: 'pdf', size: 100 * 1024, count: 20 }, // 100KB PDFs
      { type: 'txt', size: 50 * 1024, count: 30 },   // 50KB text files
      
      // Medium files (X-rays, small images)
      { type: 'jpg', size: 2 * 1024 * 1024, count: 15 }, // 2MB images
      { type: 'png', size: 1.5 * 1024 * 1024, count: 15 }, // 1.5MB images
      { type: 'pdf', size: 5 * 1024 * 1024, count: 10 }, // 5MB PDFs
      
      // Large files (MRI scans, large documents)
      { type: 'dicom', size: 25 * 1024 * 1024, count: 5 }, // 25MB DICOM files
      { type: 'zip', size: 50 * 1024 * 1024, count: 3 },   // 50MB archives
      
      // Very large files (CT scans)
      { type: 'dicom', size: 100 * 1024 * 1024, count: 2 }, // 100MB DICOM files
    ];

    for (const config of fileConfigs) {
      for (let i = 0; i < config.count; i++) {
        const fileName = `test-${config.type}-${config.size}-${i}.${config.type}`;
        const fileBuffer = this.generateFileBuffer(config.size, config.type);
        this.testFiles.set(fileName, fileBuffer);
        
        this.uploadMetrics.totalFiles++;
        this.uploadMetrics.totalSize += config.size;
        this.uploadMetrics.maxFileSize = Math.max(this.uploadMetrics.maxFileSize, config.size);
        this.uploadMetrics.minFileSize = Math.min(this.uploadMetrics.minFileSize, config.size);
      }
    }

    console.log(`Generated ${this.testFiles.size} test files totaling ${(this.uploadMetrics.totalSize / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Generate file buffer with realistic content
   */
  private generateFileBuffer(size: number, fileType: string): Buffer {
    switch (fileType) {
      case 'pdf':
        return this.generatePDFLikeBuffer(size);
      case 'jpg':
      case 'png':
        return this.generateImageLikeBuffer(size);
      case 'dicom':
        return this.generateDICOMLikeBuffer(size);
      case 'txt':
        return this.generateTextBuffer(size);
      case 'zip':
        return this.generateBinaryBuffer(size);
      default:
        return this.generateBinaryBuffer(size);
    }
  }

  private generatePDFLikeBuffer(size: number): Buffer {
    // Generate PDF-like structure with header
    const header = Buffer.from('%PDF-1.4\n');
    const remainingSize = size - header.length;
    const content = crypto.randomBytes(remainingSize);
    return Buffer.concat([header, content]);
  }

  private generateImageLikeBuffer(size: number): Buffer {
    // Generate realistic image-like data with JPEG header
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const remainingSize = size - jpegHeader.length;
    const imageData = crypto.randomBytes(remainingSize);
    return Buffer.concat([jpegHeader, imageData]);
  }

  private generateDICOMLikeBuffer(size: number): Buffer {
    // Generate DICOM-like structure
    const dicomHeader = Buffer.from('DICM', 'ascii');
    const remainingSize = size - dicomHeader.length;
    const dicomData = crypto.randomBytes(remainingSize);
    return Buffer.concat([dicomHeader, dicomData]);
  }

  private generateTextBuffer(size: number): Buffer {
    const text = 'Patient medical record data. '.repeat(Math.ceil(size / 30));
    return Buffer.from(text.substring(0, size), 'utf8');
  }

  private generateBinaryBuffer(size: number): Buffer {
    return crypto.randomBytes(size);
  }

  /**
   * Test single file upload performance
   */
  async testSingleFileUploads(): Promise<void> {
    console.log('Testing single file upload performance...');
    this.startMonitoring();

    const files = Array.from(this.testFiles.entries());
    const promises: Promise<void>[] = [];
    const uploadsPerWorker = Math.ceil(files.length / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      const workerFiles = files.slice(
        worker * uploadsPerWorker,
        (worker + 1) * uploadsPerWorker
      );
      promises.push(this.singleUploadWorker(workerFiles));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async singleUploadWorker(files: [string, Buffer][]): Promise<void> {
    for (const [fileName, fileBuffer] of files) {
      const startTime = performance.now();
      let isError = false;

      try {
        await this.uploadFile(fileName, fileBuffer);
        this.uploadMetrics.successfulUploads++;
      } catch (error) {
        isError = true;
        this.uploadMetrics.failedUploads++;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Test concurrent file uploads
   */
  async testConcurrentUploads(): Promise<void> {
    console.log('Testing concurrent file upload performance...');
    this.startMonitoring();

    const files = Array.from(this.testFiles.entries());
    const promises: Promise<void>[] = [];

    // Create multiple concurrent upload streams
    for (let i = 0; i < this.config.concurrency; i++) {
      const file = files[i % files.length];
      promises.push(this.concurrentUploadWorker(file));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async concurrentUploadWorker(file: [string, Buffer]): Promise<void> {
    const [fileName, fileBuffer] = file;
    const uploads = Math.ceil((this.config.maxRequests || 100) / this.config.concurrency);

    for (let i = 0; i < uploads; i++) {
      const startTime = performance.now();
      let isError = false;

      try {
        // Use unique filename for each upload
        const uniqueFileName = `${i}-${fileName}`;
        await this.uploadFile(uniqueFileName, fileBuffer);
        this.uploadMetrics.successfulUploads++;
      } catch (error) {
        isError = true;
        this.uploadMetrics.failedUploads++;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Test large file upload performance
   */
  async testLargeFileUploads(): Promise<void> {
    console.log('Testing large file upload performance...');
    this.startMonitoring();

    // Filter for large files (>10MB)
    const largeFiles = Array.from(this.testFiles.entries())
      .filter(([_, buffer]) => buffer.length > 10 * 1024 * 1024);

    if (largeFiles.length === 0) {
      console.log('No large files available for testing');
      return;
    }

    const promises: Promise<void>[] = [];
    const concurrency = Math.min(this.config.concurrency, 5); // Limit concurrency for large files

    for (let i = 0; i < concurrency; i++) {
      const file = largeFiles[i % largeFiles.length];
      promises.push(this.largeFileUploadWorker(file));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async largeFileUploadWorker(file: [string, Buffer]): Promise<void> {
    const [fileName, fileBuffer] = file;
    const uploads = Math.ceil((this.config.maxRequests || 20) / 5); // Fewer uploads for large files

    for (let i = 0; i < uploads; i++) {
      const startTime = performance.now();
      let isError = false;

      try {
        const uniqueFileName = `large-${i}-${fileName}`;
        await this.uploadFile(uniqueFileName, fileBuffer, true); // Use chunked upload
        this.uploadMetrics.successfulUploads++;
      } catch (error) {
        isError = true;
        this.uploadMetrics.failedUploads++;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Test batch file upload performance
   */
  async testBatchUploads(): Promise<void> {
    console.log('Testing batch file upload performance...');
    this.startMonitoring();

    const files = Array.from(this.testFiles.entries());
    const batchSize = 10;
    const batches: [string, Buffer][][] = [];

    // Create batches of files
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    const promises: Promise<void>[] = [];
    const batchesPerWorker = Math.ceil(batches.length / this.config.concurrency);

    for (let worker = 0; worker < this.config.concurrency; worker++) {
      const workerBatches = batches.slice(
        worker * batchesPerWorker,
        (worker + 1) * batchesPerWorker
      );
      promises.push(this.batchUploadWorker(workerBatches));
    }

    await Promise.all(promises);
    await this.calculateMetrics();
  }

  private async batchUploadWorker(batches: [string, Buffer][][]): Promise<void> {
    for (const batch of batches) {
      const startTime = performance.now();
      let isError = false;

      try {
        await this.uploadBatch(batch);
        this.uploadMetrics.successfulUploads += batch.length;
      } catch (error) {
        isError = true;
        this.uploadMetrics.failedUploads += batch.length;
      }

      const responseTime = performance.now() - startTime;
      this.recordResponseTime(responseTime, isError);
    }
  }

  /**
   * Upload a single file
   */
  private async uploadFile(fileName: string, fileBuffer: Buffer, chunked: boolean = false): Promise<void> {
    if (chunked && fileBuffer.length > 10 * 1024 * 1024) {
      return this.uploadFileChunked(fileName, fileBuffer);
    }

    const response = await supertest(this.app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${this.authToken}`)
      .attach('file', fileBuffer, fileName)
      .field('patientId', 'test-patient-123')
      .field('documentType', this.getDocumentType(fileName))
      .field('description', `Performance test upload: ${fileName}`);

    if (response.status !== 201) {
      throw new Error(`Upload failed: ${response.status} - ${response.text}`);
    }
  }

  /**
   * Upload file using chunked upload for large files
   */
  private async uploadFileChunked(fileName: string, fileBuffer: Buffer): Promise<void> {
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(fileBuffer.length / chunkSize);
    
    // Initialize chunked upload
    const initResponse = await supertest(this.app)
      .post('/api/documents/upload/init')
      .set('Authorization', `Bearer ${this.authToken}`)
      .send({
        fileName,
        fileSize: fileBuffer.length,
        patientId: 'test-patient-123',
        documentType: this.getDocumentType(fileName)
      });

    if (initResponse.status !== 200) {
      throw new Error(`Chunked upload init failed: ${initResponse.status}`);
    }

    const uploadId = initResponse.body.uploadId;

    // Upload chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.length);
      const chunk = fileBuffer.slice(start, end);

      const chunkResponse = await supertest(this.app)
        .post(`/api/documents/upload/chunk/${uploadId}`)
        .set('Authorization', `Bearer ${this.authToken}`)
        .attach('chunk', chunk, `${fileName}.chunk.${chunkIndex}`)
        .field('chunkIndex', chunkIndex.toString())
        .field('totalChunks', totalChunks.toString());

      if (chunkResponse.status !== 200) {
        throw new Error(`Chunk upload failed: ${chunkResponse.status}`);
      }
    }

    // Complete chunked upload
    const completeResponse = await supertest(this.app)
      .post(`/api/documents/upload/complete/${uploadId}`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send({});

    if (completeResponse.status !== 201) {
      throw new Error(`Chunked upload completion failed: ${completeResponse.status}`);
    }
  }

  /**
   * Upload batch of files
   */
  private async uploadBatch(files: [string, Buffer][]): Promise<void> {
    const request = supertest(this.app)
      .post('/api/documents/upload/batch')
      .set('Authorization', `Bearer ${this.authToken}`)
      .field('patientId', 'test-patient-123');

    for (const [fileName, fileBuffer] of files) {
      request.attach('files', fileBuffer, fileName);
    }

    const response = await request;

    if (response.status !== 201) {
      throw new Error(`Batch upload failed: ${response.status} - ${response.text}`);
    }
  }

  /**
   * Determine document type from filename
   */
  private getDocumentType(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    
    const typeMap: { [key: string]: string } = {
      '.pdf': 'clinical-document',
      '.txt': 'clinical-note',
      '.jpg': 'medical-image',
      '.png': 'medical-image',
      '.dicom': 'dicom-image',
      '.zip': 'archive'
    };

    return typeMap[extension] || 'unknown';
  }

  /**
   * Calculate upload-specific metrics
   */
  protected async calculateUploadMetrics(): Promise<void> {
    await this.calculateMetrics();
    
    const totalTime = this.metrics.duration;
    this.uploadMetrics.avgUploadTime = this.metrics.responseTime.avg;
    this.uploadMetrics.avgThroughput = (this.uploadMetrics.totalSize / 1024 / 1024) / totalTime; // MB/s
    this.uploadMetrics.filesPerSecond = this.uploadMetrics.totalFiles / totalTime;
  }

  /**
   * Generate file upload performance report
   */
  generateUploadReport(): string {
    return `
File Upload Performance Test Report
===================================

Upload Statistics:
- Total Files: ${this.uploadMetrics.totalFiles}
- Total Size: ${(this.uploadMetrics.totalSize / 1024 / 1024).toFixed(2)}MB
- Successful Uploads: ${this.uploadMetrics.successfulUploads}
- Failed Uploads: ${this.uploadMetrics.failedUploads}
- Success Rate: ${((this.uploadMetrics.successfulUploads / this.uploadMetrics.totalFiles) * 100).toFixed(2)}%

Performance Metrics:
- Average Upload Time: ${this.uploadMetrics.avgUploadTime.toFixed(2)}ms
- Average Throughput: ${this.uploadMetrics.avgThroughput.toFixed(2)}MB/s
- Files Per Second: ${this.uploadMetrics.filesPerSecond.toFixed(2)}
- Largest File: ${(this.uploadMetrics.maxFileSize / 1024 / 1024).toFixed(2)}MB
- Smallest File: ${(this.uploadMetrics.minFileSize / 1024).toFixed(2)}KB

Base Performance Metrics:
${this.generateReport()}

Upload Recommendations:
${this.generateUploadRecommendations()}
    `.trim();
  }

  private generateUploadRecommendations(): string {
    const recommendations: string[] = [];
    
    if (this.uploadMetrics.avgThroughput < 1) {
      recommendations.push('- Low throughput detected (<1MB/s) - consider server optimization');
    }
    
    if (this.uploadMetrics.failedUploads > this.uploadMetrics.totalFiles * 0.05) {
      recommendations.push('- High failure rate - check file size limits and server stability');
    }
    
    if (this.uploadMetrics.avgUploadTime > 30000) {
      recommendations.push('- High upload times - consider implementing chunked uploads for large files');
    }
    
    if (this.metrics.memoryUsage.heapUsed > 1000) {
      recommendations.push('- High memory usage during uploads - review file processing pipeline');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('- File upload performance appears optimal');
    }
    
    return recommendations.join('\n');
  }

  /**
   * Cleanup test files and data
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up file upload test data...');
    
    // In a real implementation, you might want to delete uploaded test files
    // from the server to prevent storage buildup
    
    this.testFiles.clear();
    console.log('File upload test cleanup completed');
  }
}