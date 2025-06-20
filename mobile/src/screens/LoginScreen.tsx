import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Alert, TouchableOpacity} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  Card,
  Checkbox,
  IconButton,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '@services/AuthProvider';
import {theme} from '@config/theme';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const {login, loginWithBiometrics, getBiometricData} = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const biometricData = await getBiometricData();
      setBiometricAvailable(biometricData.isAvailable && biometricData.isEnrolled);
      setBiometricType(biometricData.biometryType);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password, rememberMe);
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setLoading(true);
      await loginWithBiometrics();
    } catch (error) {
      Alert.alert(
        'Biometric Login Failed',
        'Please use your email and password to sign in.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'FaceID':
        return 'face-recognition';
      case 'TouchID':
      case 'Fingerprint':
        return 'fingerprint';
      default:
        return 'shield-check';
    }
  };

  const getBiometricLabel = () => {
    switch (biometricType) {
      case 'FaceID':
        return 'Face ID';
      case 'TouchID':
        return 'Touch ID';
      case 'Fingerprint':
        return 'Fingerprint';
      default:
        return 'Biometric';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.surface}>
        <View style={styles.header}>
          <Icon name="hospital-box" size={64} color={theme.colors.primary} />
          <Text variant="headlineLarge" style={styles.title}>
            OmniCare EMR
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Secure healthcare management
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              left={<TextInput.Icon icon="email" />}
              style={styles.input}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              autoComplete="password"
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
            />

            <View style={styles.checkboxContainer}>
              <Checkbox
                status={rememberMe ? 'checked' : 'unchecked'}
                onPress={() => setRememberMe(!rememberMe)}
              />
              <Text variant="bodyMedium" style={styles.checkboxLabel}>
                Remember me
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
            >
              Sign In
            </Button>

            {biometricAvailable && (
              <>
                <View style={styles.divider}>
                  <Text variant="bodySmall" style={styles.dividerText}>
                    OR
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  disabled={loading}
                >
                  <Icon
                    name={getBiometricIcon()}
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text variant="bodyMedium" style={styles.biometricText}>
                    Sign in with {getBiometricLabel()}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.linkContainer}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword' as never)}
              >
                <Text variant="bodyMedium" style={styles.link}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.footerText}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Register' as never)}
          >
            <Text variant="bodySmall" style={styles.registerLink}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </Surface>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  surface: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  card: {
    elevation: 4,
    borderRadius: 16,
  },
  cardContent: {
    padding: 24,
  },
  input: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkboxLabel: {
    marginLeft: 8,
    color: theme.colors.onSurface,
  },
  loginButton: {
    marginBottom: 16,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerText: {
    color: theme.colors.onSurfaceVariant,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginBottom: 16,
  },
  biometricText: {
    marginLeft: 8,
    color: theme.colors.primary,
  },
  linkContainer: {
    alignItems: 'center',
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: theme.colors.onSurfaceVariant,
  },
  registerLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});