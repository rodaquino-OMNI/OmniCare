/**
 * JWT Security Utilities
 * Tools for generating and validating JWT secrets
 */

import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure JWT secret
 */
export function generateJWTSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Validate JWT secret strength
 */
export function validateJWTSecret(secret: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check minimum length
  if (secret.length < 32) {
    errors.push('Secret must be at least 32 characters long');
  }
  
  // Check for common weak patterns
  const weakPatterns = [
    'secret', 'password', '12345', 'default', 'changeme', 
    'test', 'admin', 'demo', 'example', 'sample'
  ];
  
  const lowerSecret = secret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      errors.push(`Secret contains weak pattern: "${pattern}"`);
    }
  }
  
  // Check entropy (simplified check)
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 10) {
    errors.push('Secret has low entropy - use more unique characters');
  }
  
  // Check for sequential characters
  const sequential = /012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i;
  if (sequential.test(secret)) {
    errors.push('Secret contains sequential characters');
  }
  
  // Check for repeated characters
  const repeated = /(.)\1{3,}/;
  if (repeated.test(secret)) {
    errors.push('Secret contains too many repeated characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate JWT configuration for .env file
 */
export function generateJWTConfig(): string {
  const accessSecret = generateJWTSecret();
  const refreshSecret = generateJWTSecret();
  
  return `# JWT Configuration - Generated on ${new Date().toISOString()}
# IMPORTANT: These are strong, randomly generated secrets. 
# Store them securely and never commit them to version control.

JWT_ACCESS_SECRET="${accessSecret}"
JWT_REFRESH_SECRET="${refreshSecret}"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Backup the old secrets before replacing (if any)
# OLD_JWT_ACCESS_SECRET=""
# OLD_JWT_REFRESH_SECRET=""
`;
}

/**
 * Rotate JWT secrets safely
 */
export interface JWTRotationConfig {
  currentAccessSecret: string;
  currentRefreshSecret: string;
  newAccessSecret?: string;
  newRefreshSecret?: string;
  gracePeriodHours?: number;
}

export function rotateJWTSecrets(config: JWTRotationConfig): {
  newAccessSecret: string;
  newRefreshSecret: string;
  rotationInstructions: string;
} {
  const newAccessSecret = config.newAccessSecret || generateJWTSecret();
  const newRefreshSecret = config.newRefreshSecret || generateJWTSecret();
  const gracePeriod = config.gracePeriodHours || 24;
  
  const rotationInstructions = `
JWT Secret Rotation Instructions:
1. Update environment variables:
   - Set JWT_ACCESS_SECRET_NEW="${newAccessSecret}"
   - Set JWT_REFRESH_SECRET_NEW="${newRefreshSecret}"
   - Keep old secrets as JWT_ACCESS_SECRET_OLD and JWT_REFRESH_SECRET_OLD

2. Deploy with dual-secret support for ${gracePeriod} hours

3. After grace period, remove old secrets and rename new ones:
   - JWT_ACCESS_SECRET="${newAccessSecret}"
   - JWT_REFRESH_SECRET="${newRefreshSecret}"

4. Monitor authentication failures during rotation

5. Keep audit log of rotation with timestamps
`;
  
  return {
    newAccessSecret,
    newRefreshSecret,
    rotationInstructions
  };
}

/**
 * CLI command to generate new JWT secrets
 */
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      console.log('Generating new JWT secrets...\n');
      console.log(generateJWTConfig());
      break;
      
    case 'validate':
      const secret = process.argv[3];
      if (!secret) {
        console.error('Usage: node jwt-security.utils.js validate <secret>');
        process.exit(1);
      }
      const validation = validateJWTSecret(secret);
      if (validation.isValid) {
        console.log('✅ JWT secret is strong');
      } else {
        console.error('❌ JWT secret validation failed:');
        validation.errors.forEach(error => console.error(`   - ${error}`));
        process.exit(1);
      }
      break;
      
    case 'rotate':
      console.log('Generating JWT rotation plan...\n');
      const rotation = rotateJWTSecrets({
        currentAccessSecret: 'current-secret',
        currentRefreshSecret: 'current-refresh-secret'
      });
      console.log(rotation.rotationInstructions);
      break;
      
    default:
      console.log(`
JWT Security Utility

Commands:
  generate    Generate new JWT secrets for .env file
  validate    Validate a JWT secret strength
  rotate      Generate JWT rotation plan

Examples:
  node jwt-security.utils.js generate
  node jwt-security.utils.js validate "your-secret-here"
  node jwt-security.utils.js rotate
`);
  }
}

export default {
  generateJWTSecret,
  validateJWTSecret,
  generateJWTConfig,
  rotateJWTSecrets
};