import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import {AuthState, User, BiometricData} from '@types/index';
import {medplumClient} from '@config/medplum';

interface AuthContextType {
  authState: AuthState;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithBiometrics: () => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setupBiometrics: () => Promise<void>;
  getBiometricData: () => Promise<BiometricData>;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
  });

  const biometrics = new ReactNativeBiometrics({
    allowDeviceCredentials: true,
  });

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState(prev => ({...prev, isLoading: true}));
      
      // Check for stored authentication
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');
      
      if (storedToken && storedUser) {
        const user: User = JSON.parse(storedUser);
        
        // Verify token is still valid
        try {
          await medplumClient.get('Patient'); // Test API call
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            token: storedToken,
          });
          return;
        } catch (error) {
          // Token is invalid, clear stored data
          await clearStoredAuth();
        }
      }
      
      setAuthState(prev => ({...prev, isLoading: false}));
    } catch (error) {
      console.error('Error initializing auth:', error);
      setAuthState(prev => ({...prev, isLoading: false}));
    }
  };

  const clearStoredAuth = async () => {
    await AsyncStorage.multiRemove(['authToken', 'userData', 'refreshToken']);
  };

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    try {
      setAuthState(prev => ({...prev, isLoading: true}));
      
      // Authenticate with Medplum
      const loginResponse = await medplumClient.startLogin({
        email,
        password,
        scope: 'openid profile email',
      });
      
      if (loginResponse.login) {
        const profileResponse = await medplumClient.processCode(loginResponse.code || '');
        
        const user: User = {
          id: profileResponse.profile?.id || '',
          email: profileResponse.profile?.email || email,
          name: `${profileResponse.profile?.name?.given?.[0] || ''} ${profileResponse.profile?.name?.family || ''}`.trim(),
          role: determineUserRole(profileResponse.profile),
          department: profileResponse.profile?.extension?.find(ext => ext.url === 'department')?.valueString,
          practitionerId: profileResponse.profile?.id,
        };
        
        const token = profileResponse.accessToken;
        
        // Store authentication data
        if (rememberMe) {
          await AsyncStorage.setItem('authToken', token);
          await AsyncStorage.setItem('userData', JSON.stringify(user));
          if (profileResponse.refreshToken) {
            await AsyncStorage.setItem('refreshToken', profileResponse.refreshToken);
          }
        }
        
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user,
          token,
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthState(prev => ({...prev, isLoading: false}));
      throw new Error('Invalid credentials');
    }
  }, []);

  const loginWithBiometrics = useCallback(async () => {
    try {
      const biometricData = await getBiometricData();
      
      if (!biometricData.isAvailable || !biometricData.isEnrolled) {
        throw new Error('Biometric authentication not available');
      }
      
      const {success} = await biometrics.simplePrompt({
        promptMessage: 'Authenticate to access OmniCare',
        fallbackPromptMessage: 'Use your device passcode',
      });
      
      if (success) {
        // Retrieve stored credentials
        const storedToken = await AsyncStorage.getItem('authToken');
        const storedUser = await AsyncStorage.getItem('userData');
        
        if (storedToken && storedUser) {
          const user: User = JSON.parse(storedUser);
          
          // Verify token is still valid
          await medplumClient.get('Patient');
          
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            token: storedToken,
          });
        } else {
          throw new Error('No stored credentials found');
        }
      } else {
        throw new Error('Biometric authentication failed');
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await medplumClient.signOut();
      await clearStoredAuth();
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    try {
      setAuthState(prev => ({...prev, isLoading: true}));
      
      // Create user account via Medplum
      const response = await medplumClient.post('auth/register', {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        projectId: 'your-project-id', // Replace with actual project ID
      });
      
      // Auto-login after successful registration
      await login(userData.email, userData.password, true);
    } catch (error) {
      console.error('Registration error:', error);
      setAuthState(prev => ({...prev, isLoading: false}));
      throw new Error('Registration failed');
    }
  }, [login]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await medplumClient.post('auth/resetpassword', {email});
    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error('Password reset failed');
    }
  }, []);

  const setupBiometrics = useCallback(async () => {
    try {
      const biometricData = await getBiometricData();
      
      if (!biometricData.isAvailable) {
        throw new Error('Biometric authentication not available on this device');
      }
      
      if (!biometricData.isEnrolled) {
        throw new Error('No biometric credentials enrolled on this device');
      }
      
      // Test biometric authentication
      const {success} = await biometrics.simplePrompt({
        promptMessage: 'Set up biometric authentication for OmniCare',
        fallbackPromptMessage: 'Use your device passcode',
      });
      
      if (success) {
        await AsyncStorage.setItem('biometricEnabled', 'true');
        return true;
      } else {
        throw new Error('Biometric setup failed');
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      throw error;
    }
  }, []);

  const getBiometricData = useCallback(async (): Promise<BiometricData> => {
    try {
      const {available, biometryType} = await biometrics.isSensorAvailable();
      
      let isEnrolled = false;
      if (available) {
        try {
          const {keysExist} = await biometrics.biometricKeysExist();
          isEnrolled = keysExist;
        } catch (error) {
          // Some devices may not support key checking
          isEnrolled = true; // Assume enrolled if biometry is available
        }
      }
      
      return {
        isAvailable: available,
        biometryType: biometryType as 'FaceID' | 'TouchID' | 'Fingerprint' | null,
        isEnrolled,
      };
    } catch (error) {
      console.error('Error getting biometric data:', error);
      return {
        isAvailable: false,
        biometryType: null,
        isEnrolled: false,
      };
    }
  }, []);

  const determineUserRole = (profile: any): User['role'] => {
    // Determine user role based on profile data
    const resourceType = profile?.resourceType;
    
    if (resourceType === 'Patient') {
      return 'patient';
    } else if (resourceType === 'Practitioner') {
      const qualification = profile?.qualification?.[0]?.code?.coding?.[0]?.code;
      
      switch (qualification) {
        case 'MD':
        case 'DO':
          return 'physician';
        case 'RN':
        case 'LPN':
          return 'nurse';
        case 'PT':
        case 'OT':
        case 'SLP':
          return 'technician';
        default:
          return 'nurse'; // Default for healthcare providers
      }
    }
    
    return 'admin'; // Default fallback
  };

  const contextValue: AuthContextType = {
    authState,
    login,
    loginWithBiometrics,
    logout,
    register,
    resetPassword,
    setupBiometrics,
    getBiometricData,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};