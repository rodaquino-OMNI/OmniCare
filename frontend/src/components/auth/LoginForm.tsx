'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Stack,
  Group,
  Alert,
  LoadingOverlay,
  Checkbox,
  Anchor,
  Divider,
  Card,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconLogin, IconStethoscope, IconAlertCircle, IconUser, IconLock } from '@tabler/icons-react';
import { useAuth } from '@/stores/auth';
import { APP_NAME } from '@/constants';
import { getDisplayErrorMessage } from '@/utils/error.utils';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email is required';
        if (!/^\S+@\S+\.\S+$/.test(value)) return 'Invalid email format';
        return null;
      },
      password: (value) => {
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return null;
      },
    },
  });

  const handleSubmit = async (values: LoginFormData) => {
    setError(null);
    
    try {
      await login({
        email: values.email,
        password: values.password,
      });

      notifications.show({
        title: 'Login Successful',
        message: 'Welcome back to OmniCare EMR!',
        color: 'green',
        icon: <IconLogin size={16} />,
      });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: unknown) {
      const errorMessage = getDisplayErrorMessage(err);
      setError(errorMessage);
      console.error('Login error:', err);
      
      notifications.show({
        title: 'Login Failed',
        message: errorMessage,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card 
        shadow="lg" 
        padding="xl" 
        radius="lg" 
        className="w-full max-w-md relative"
        withBorder
      >
        <LoadingOverlay visible={isLoading} overlayProps={{ blur: 2 }} />
        
        {/* Header */}
        <Stack align="center" mb="xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-full">
              <IconStethoscope size={32} className="text-primary" />
            </div>
            <div>
              <Title order={2} className="text-gray-800">
                {APP_NAME}
              </Title>
              <Text size="sm" c="dimmed">
                Electronic Medical Records
              </Text>
            </div>
          </div>
        </Stack>

        <Title order={3} ta="center" mb="md" className="text-gray-700">
          Sign in to your account
        </Title>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            mb="md"
          >
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email Address"
              placeholder="Enter your email"
              leftSection={<IconUser size={16} />}
              required
              {...form.getInputProps('email')}
              disabled={isLoading}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              leftSection={<IconLock size={16} />}
              required
              {...form.getInputProps('password')}
              disabled={isLoading}
            />

            <Group justify="space-between">
              <Checkbox
                label="Remember me"
                {...form.getInputProps('rememberMe', { type: 'checkbox' })}
                disabled={isLoading}
              />
              <Anchor size="sm" href="/auth/forgot-password" c="primary">
                Forgot password?
              </Anchor>
            </Group>

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={isLoading}
              leftSection={<IconLogin size={16} />}
              className="mt-4"
            >
              Sign In
            </Button>
          </Stack>
        </form>

        <Divider label="Demo Accounts" labelPosition="center" my="xl" />

        <Stack gap="xs">
          <Text size="sm" c="dimmed" ta="center">
            Quick demo access:
          </Text>
          <Group grow>
            <Button
              variant="light"
              size="xs"
              onClick={() => {
                form.setValues({
                  email: 'doctor@omnicare.com',
                  password: 'demo123',
                });
              }}
              disabled={isLoading}
            >
              Doctor
            </Button>
            <Button
              variant="light"
              size="xs"
              onClick={() => {
                form.setValues({
                  email: 'nurse@omnicare.com',
                  password: 'demo123',
                });
              }}
              disabled={isLoading}
            >
              Nurse
            </Button>
            <Button
              variant="light"
              size="xs"
              onClick={() => {
                form.setValues({
                  email: 'admin@omnicare.com',
                  password: 'demo123',
                });
              }}
              disabled={isLoading}
            >
              Admin
            </Button>
          </Group>
        </Stack>

        <Text ta="center" mt="xl" size="sm" c="dimmed">
          Need help? Contact{' '}
          <Anchor href="mailto:support@omnicare.com" c="primary">
            support@omnicare.com
          </Anchor>
        </Text>
      </Card>
    </div>
  );
}

export default LoginForm;