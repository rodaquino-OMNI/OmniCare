import { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your OmniCare EMR account',
};

export default function LoginPage() {
  return <LoginForm />;
}