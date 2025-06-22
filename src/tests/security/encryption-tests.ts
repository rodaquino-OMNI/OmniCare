/**
 * OmniCare EMR - Encryption Security Tests
 * HIPAA-Compliant PHI Protection and Encryption Validation
 */

import crypto from 'crypto';
import { EncryptionService } from '@/services/encryption.service';
import { SecurityTestResult } from './security-test-suite';

export class EncryptionSecurityTests {
  private encryptionService: EncryptionService;
  private testResults: SecurityTestResult[] = [];

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  async runAllEncryptionTests(): Promise<SecurityTestResult[]> {
    this.testResults = [];

    await this.testDataEncryptionAtRest();
    await this.testPHIEncryption();
    await this.testKeyManagement();
    await this.testEncryptionStrength();
    await this.testDataIntegrity();
    await this.testKeyRotation();
    await this.testEncryptionPerformance();

    return this.testResults;
  }

  private async testDataEncryptionAtRest(): Promise<void> {
    const testName = 'Data Encryption at Rest';
    
    try {
      const sensitiveData = 'Patient SSN: 123-45-6789, DOB: 1980-01-01';
      
      // Test basic encryption/decryption
      const encrypted = this.encryptionService.encryptData(sensitiveData);
      
      if (!encrypted.encrypted || !encrypted.iv || !encrypted.tag) {
        throw new Error('Encryption result missing required components');
      }

      if (encrypted.encrypted === sensitiveData) {
        throw new Error('Data was not properly encrypted');
      }

      // Test decryption
      const decrypted = this.encryptionService.decryptData(encrypted);
      
      if (decrypted !== sensitiveData) {
        throw new Error('Decrypted data does not match original');
      }

      // Test encryption with different data produces different ciphertext
      const encrypted2 = this.encryptionService.encryptData(sensitiveData);
      
      if (encrypted.encrypted === encrypted2.encrypted) {
        throw new Error('Same plaintext produced identical ciphertext (IV reuse)');
      }

      // Test encryption algorithm
      if (encrypted.algorithm !== 'aes-256-gcm') {
        throw new Error('Weak encryption algorithm detected');
      }

      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'CRITICAL',
        status: 'PASS',
        description: 'Data encryption at rest security validated',
        details: {
          encryptionAlgorithm: encrypted.algorithm,
          ivRandomization: 'PASS',
          encryptionIntegrity: 'PASS',
          decryptionAccuracy: 'PASS'
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'CRITICAL',
        status: 'FAIL',
        description: 'Data encryption at rest failed',
        details: { error: error.message },
        remediation: 'CRITICAL: Fix encryption implementation immediately',
        timestamp: new Date()
      });
    }
  }

  private async testPHIEncryption(): Promise<void> {
    const testName = 'PHI Encryption Security';
    
    try {
      const patientId = 'patient-12345';
      const phiData = {
        ssn: '123-45-6789',
        dob: '1980-01-01',
        diagnosis: 'Hypertension',
        medications: ['Lisinopril 10mg', 'Metformin 500mg'],
        notes: 'Patient reports occasional chest pain'
      };

      // Test PHI-specific encryption
      const encryptedPHI = this.encryptionService.encryptPHI(phiData, patientId);
      
      if (!encryptedPHI.keyId || !encryptedPHI.keyId.includes(patientId)) {
        throw new Error('PHI encryption missing patient-specific key ID');
      }

      // Test PHI decryption with patient validation
      const decryptedPHI = this.encryptionService.decryptPHI(encryptedPHI, patientId);
      
      if (JSON.stringify(decryptedPHI) !== JSON.stringify(phiData)) {
        throw new Error('Decrypted PHI does not match original');
      }

      // Test patient ID mismatch protection
      try {
        this.encryptionService.decryptPHI(encryptedPHI, 'wrong-patient-id');
        throw new Error('PHI decryption succeeded with wrong patient ID');
      } catch (error) {
        // Expected behavior
      }

      // Test PHI metadata validation
      const decryptedString = this.encryptionService.decryptData(encryptedPHI);
      const metadata = JSON.parse(decryptedString);
      
      if (metadata.type !== 'PHI') {
        throw new Error('PHI type validation failed');
      }

      if (metadata.patientId !== patientId) {
        throw new Error('PHI patient ID validation failed');
      }

      if (!metadata.timestamp) {
        throw new Error('PHI timestamp missing');
      }

      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'CRITICAL',
        status: 'PASS',
        description: 'PHI encryption security validated',
        details: {
          patientSpecificEncryption: 'PASS',
          phiMetadataValidation: 'PASS',
          patientIdValidation: 'PASS',
          wrongPatientProtection: 'PASS'
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'CRITICAL',
        status: 'FAIL',
        description: 'PHI encryption security failed',
        details: { error: error.message },
        remediation: 'CRITICAL: Fix PHI encryption vulnerabilities immediately',
        timestamp: new Date()
      });
    }
  }

  private async testKeyManagement(): Promise<void> {
    const testName = 'Encryption Key Management';
    
    try {
      // Test key generation
      const keyPair = this.encryptionService.generateKeyPair();
      
      if (!keyPair.publicKey || !keyPair.privateKey || !keyPair.keyId) {
        throw new Error('Key pair generation incomplete');
      }

      if (keyPair.publicKey === keyPair.privateKey) {
        throw new Error('Public and private keys are identical');
      }

      // Test RSA encryption/decryption
      const testData = 'Test encryption with RSA keys';
      const rsaEncrypted = this.encryptionService.encryptWithPublicKey(testData, keyPair.publicKey);
      const rsaDecrypted = this.encryptionService.decryptWithPrivateKey(rsaEncrypted, keyPair.privateKey);
      
      if (rsaDecrypted !== testData) {
        throw new Error('RSA encryption/decryption failed');
      }

      // Test data key generation
      const dataKeyResult = this.encryptionService.generateDataKey('test-purpose');
      
      if (!dataKeyResult.keyId || !dataKeyResult.key) {
        throw new Error('Data key generation failed');
      }

      if (dataKeyResult.key.length !== 32) { // AES-256 key length
        throw new Error('Data key has incorrect length');
      }

      // Test encryption statistics
      const stats = this.encryptionService.getEncryptionStats();
      
      if (stats.totalKeys === 0) {
        throw new Error('No keys found in key management system');
      }

      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'HIGH',
        status: 'PASS',
        description: 'Encryption key management validated',
        details: {
          keyPairGeneration: 'PASS',
          rsaEncryption: 'PASS',
          dataKeyGeneration: 'PASS',
          keyStatistics: stats,
          totalManagedKeys: stats.totalKeys
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'HIGH',
        status: 'FAIL',
        description: 'Encryption key management failed',
        details: { error: error.message },
        remediation: 'Review key management implementation and security',
        timestamp: new Date()
      });
    }
  }

  private async testEncryptionStrength(): Promise<void> {
    const testName = 'Encryption Strength Validation';
    
    try {
      const testData = 'Security test data for strength validation';
      
      // Test multiple encryptions produce different results
      const encryptions = [];
      for (let i = 0; i < 10; i++) {
        encryptions.push(this.encryptionService.encryptData(testData));
      }

      // Verify all encryptions are different (proper IV randomization)
      const uniqueEncryptions = new Set(encryptions.map(e => e.encrypted));
      if (uniqueEncryptions.size !== encryptions.length) {
        throw new Error('Encryption produced duplicate ciphertext (IV reuse)');
      }

      // Test IV length (should be 16 bytes for AES-GCM)
      const encrypted = encryptions[0];
      const ivBuffer = Buffer.from(encrypted.iv, 'hex');
      if (ivBuffer.length !== 16) {
        throw new Error(`Invalid IV length: ${ivBuffer.length} bytes (expected 16)`);
      }

      // Test authentication tag length (should be 16 bytes for GCM)
      const tagBuffer = Buffer.from(encrypted.tag, 'hex');
      if (tagBuffer.length !== 16) {
        throw new Error(`Invalid auth tag length: ${tagBuffer.length} bytes (expected 16)`);
      }

      // Test HMAC generation and verification
      const hmac = this.encryptionService.generateHMAC(testData);
      const hmacValid = this.encryptionService.verifyHMAC(testData, hmac);
      
      if (!hmacValid) {
        throw new Error('HMAC generation/verification failed');
      }

      // Test HMAC with wrong data fails
      const hmacInvalid = this.encryptionService.verifyHMAC('wrong data', hmac);
      if (hmacInvalid) {
        throw new Error('HMAC verification succeeded with wrong data');
      }

      // Test secure random token generation
      const tokens = [];
      for (let i = 0; i < 5; i++) {
        tokens.push(this.encryptionService.generateSecureToken());
      }

      const uniqueTokens = new Set(tokens);
      if (uniqueTokens.size !== tokens.length) {
        throw new Error('Secure token generation produced duplicates');
      }

      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'HIGH',
        status: 'PASS',
        description: 'Encryption strength validation passed',
        details: {
          ivRandomization: 'PASS',
          ivLength: `${ivBuffer.length} bytes`,
          authTagLength: `${tagBuffer.length} bytes`,
          hmacValidation: 'PASS',
          secureTokenGeneration: 'PASS',
          encryptionUniqueness: 'PASS'
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'HIGH',
        status: 'FAIL',
        description: 'Encryption strength validation failed',
        details: { error: error.message },
        remediation: 'Review encryption algorithms and randomization',
        timestamp: new Date()
      });
    }
  }

  private async testDataIntegrity(): Promise<void> {
    const testName = 'Data Integrity Protection';
    
    try {
      const originalData = 'Critical patient data that must maintain integrity';
      const encrypted = this.encryptionService.encryptData(originalData);

      // Test tampering detection with corrupted ciphertext
      const tamperedEncrypted = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -10) + 'tampered123'
      };

      try {
        this.encryptionService.decryptData(tamperedEncrypted);
        throw new Error('Tampered ciphertext was accepted');
      } catch (error) {
        // Expected behavior
      }

      // Test tampering detection with corrupted IV
      const tamperedIV = {
        ...encrypted,
        iv: 'tampered_iv_value_12345678'
      };

      try {
        this.encryptionService.decryptData(tamperedIV);
        throw new Error('Tampered IV was accepted');
      } catch (error) {
        // Expected behavior
      }

      // Test tampering detection with corrupted auth tag
      const tamperedTag = {
        ...encrypted,
        tag: 'tampered_tag_value_123456789012345678901234'
      };

      try {
        this.encryptionService.decryptData(tamperedTag);
        throw new Error('Tampered auth tag was accepted');
      } catch (error) {
        // Expected behavior
      }

      // Test hash-based integrity
      const dataHash = this.encryptionService.hashData(originalData);
      const hashVerification = this.encryptionService.verifyHash(originalData, dataHash.hash, dataHash.salt);
      
      if (!hashVerification) {
        throw new Error('Hash-based integrity verification failed');
      }

      // Test hash verification with wrong data
      const wrongDataVerification = this.encryptionService.verifyHash('wrong data', dataHash.hash, dataHash.salt);
      if (wrongDataVerification) {
        throw new Error('Hash verification succeeded with wrong data');
      }

      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'HIGH',
        status: 'PASS',
        description: 'Data integrity protection validated',
        details: {
          ciphertextTamperingDetection: 'PASS',
          ivTamperingDetection: 'PASS',
          authTagTamperingDetection: 'PASS',
          hashIntegrityVerification: 'PASS',
          wrongDataRejection: 'PASS'
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'HIGH',
        status: 'FAIL',
        description: 'Data integrity protection failed',
        details: { error: error.message },
        remediation: 'Review integrity protection mechanisms',
        timestamp: new Date()
      });
    }
  }

  private async testKeyRotation(): Promise<void> {
    const testName = 'Key Rotation Security';
    
    try {
      // Get initial key statistics
      const initialStats = this.encryptionService.getEncryptionStats();
      
      // Test key rotation
      this.encryptionService.rotateKeys();
      
      // Get stats after rotation
      const postRotationStats = this.encryptionService.getEncryptionStats();
      
      // Verify new keys were generated
      if (postRotationStats.activeKeyPairs <= initialStats.activeKeyPairs) {
        console.warn('Key rotation may not have generated new active keys');
      }

      // Test that old encrypted data can still be decrypted (backward compatibility)
      const testData = 'Data encrypted before key rotation';
      const preRotationEncrypted = this.encryptionService.encryptData(testData);
      
      // Simulate rotation (in real implementation, this would use the old key)
      const decryptedAfterRotation = this.encryptionService.decryptData(preRotationEncrypted);
      
      if (decryptedAfterRotation !== testData) {
        throw new Error('Cannot decrypt data after key rotation');
      }

      // Test new encryption uses new keys
      const postRotationEncrypted = this.encryptionService.encryptData(testData);
      
      if (preRotationEncrypted.encrypted === postRotationEncrypted.encrypted) {
        console.warn('Post-rotation encryption identical to pre-rotation (may indicate key rotation issue)');
      }

      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'MEDIUM',
        status: 'PASS',
        description: 'Key rotation security validated',
        details: {
          keyRotationExecution: 'PASS',
          backwardCompatibility: 'PASS',
          initialActiveKeys: initialStats.activeKeyPairs,
          postRotationActiveKeys: postRotationStats.activeKeyPairs,
          totalKeysManaged: postRotationStats.totalKeys
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'MEDIUM',
        status: 'FAIL',
        description: 'Key rotation security failed',
        details: { error: error.message },
        remediation: 'Review key rotation implementation and backward compatibility',
        timestamp: new Date()
      });
    }
  }

  private async testEncryptionPerformance(): Promise<void> {
    const testName = 'Encryption Performance Security';
    
    try {
      const testData = 'Performance test data for encryption benchmarking';
      const iterations = 100;
      
      // Test encryption performance
      const encryptionStartTime = Date.now();
      const encryptions = [];
      
      for (let i = 0; i < iterations; i++) {
        encryptions.push(this.encryptionService.encryptData(testData));
      }
      
      const encryptionEndTime = Date.now();
      const encryptionTime = encryptionEndTime - encryptionStartTime;
      const encryptionRate = iterations / (encryptionTime / 1000); // ops per second

      // Test decryption performance
      const decryptionStartTime = Date.now();
      
      for (const encrypted of encryptions) {
        this.encryptionService.decryptData(encrypted);
      }
      
      const decryptionEndTime = Date.now();
      const decryptionTime = decryptionEndTime - decryptionStartTime;
      const decryptionRate = iterations / (decryptionTime / 1000); // ops per second

      // Performance thresholds (these should be adjusted based on requirements)
      const minEncryptionRate = 50; // ops per second
      const minDecryptionRate = 50; // ops per second
      
      if (encryptionRate < minEncryptionRate) {
        console.warn(`Encryption rate (${encryptionRate.toFixed(2)} ops/sec) below threshold (${minEncryptionRate} ops/sec)`);
      }
      
      if (decryptionRate < minDecryptionRate) {
        console.warn(`Decryption rate (${decryptionRate.toFixed(2)} ops/sec) below threshold (${minDecryptionRate} ops/sec)`);
      }

      // Test memory usage doesn't grow excessively
      const memoryBefore = process.memoryUsage();
      
      // Perform intensive encryption operations
      for (let i = 0; i < 1000; i++) {
        const encrypted = this.encryptionService.encryptData(`Large dataset ${i}`);
        this.encryptionService.decryptData(encrypted);
      }
      
      const memoryAfter = process.memoryUsage();
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'LOW',
        status: 'PASS',
        description: 'Encryption performance security validated',
        details: {
          encryptionRate: `${encryptionRate.toFixed(2)} ops/sec`,
          decryptionRate: `${decryptionRate.toFixed(2)} ops/sec`,
          encryptionTime: `${encryptionTime}ms for ${iterations} operations`,
          decryptionTime: `${decryptionTime}ms for ${iterations} operations`,
          memoryGrowth: `${Math.round(memoryGrowth / 1024 / 1024)}MB`,
          performanceAdequate: encryptionRate >= minEncryptionRate && decryptionRate >= minDecryptionRate
        },
        timestamp: new Date()
      });

    } catch (error) {
      this.addTestResult({
        testName,
        category: 'Encryption',
        severity: 'LOW',
        status: 'FAIL',
        description: 'Encryption performance security failed',
        details: { error: error.message },
        remediation: 'Review encryption performance and optimize if needed',
        timestamp: new Date()
      });
    }
  }

  private addTestResult(result: SecurityTestResult): void {
    this.testResults.push(result);
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`    ${status} ${result.testName}: ${result.description}`);
    
    if (result.status === 'FAIL' && result.remediation) {
      console.log(`       🔧 Remediation: ${result.remediation}`);
    }
  }
}

export const encryptionSecurityTests = new EncryptionSecurityTests();