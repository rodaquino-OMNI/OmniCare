// Re-export useAuth from stores for compatibility with test mocks
export { useAuth } from '@/stores/auth';
export { useAuthStore } from '@/stores/auth';

// Type exports for better TypeScript support
export type { User, UserRole, Permission } from '@/types';