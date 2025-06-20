import React, {useEffect, useState} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {PaperProvider} from 'react-native-paper';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {MedplumClient} from '@medplum/core';
import {MedplumProvider} from '@medplum/react-native';
import NetInfo from '@react-native-community/netinfo';

import {AppNavigator} from './navigation/AppNavigator';
import {AuthNavigator} from './navigation/AuthNavigator';
import {LoadingScreen} from './screens/LoadingScreen';
import {OfflineProvider} from './services/OfflineProvider';
import {AuthProvider, useAuth} from './services/AuthProvider';
import {NotificationProvider} from './services/NotificationProvider';
import {SyncProvider} from './services/SyncProvider';
import {theme} from './config/theme';
import {medplumClient} from './config/medplum';

const AppContent: React.FC = () => {
  const {isAuthenticated, isLoading} = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <SyncProvider>
          <AppNavigator />
        </SyncProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <MedplumProvider medplum={medplumClient}>
            <OfflineProvider>
              <AuthProvider>
                <NotificationProvider>
                  <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
                  <AppContent />
                </NotificationProvider>
              </AuthProvider>
            </OfflineProvider>
          </MedplumProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;