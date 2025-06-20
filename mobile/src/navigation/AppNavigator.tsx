import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createDrawerNavigator} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '@services/AuthProvider';
import {MainTabParamList} from '@types/index';

// Import screens
import {DashboardScreen} from '@screens/DashboardScreen';
import {PatientListScreen} from '@screens/PatientListScreen';
import {PatientDetailScreen} from '@screens/PatientDetailScreen';
import {TaskListScreen} from '@screens/TaskListScreen';
import {ScheduleScreen} from '@screens/ScheduleScreen';
import {ProfileScreen} from '@screens/ProfileScreen';
import {VitalSignsScreen} from '@screens/VitalSignsScreen';
import {MedicationAdminScreen} from '@screens/MedicationAdminScreen';
import {ClinicalNotesScreen} from '@screens/ClinicalNotesScreen';
import {PhotoCaptureScreen} from '@screens/PhotoCaptureScreen';
import {SettingsScreen} from '@screens/SettingsScreen';
import {NotificationsScreen} from '@screens/NotificationsScreen';
import {SyncStatusScreen} from '@screens/SyncStatusScreen';

// Home care specific screens
import {HomeCareVisitScreen} from '@screens/HomeCareVisitScreen';
import {HomeCareTaskScreen} from '@screens/HomeCareTaskScreen';

// Patient portal specific screens
import {PatientPortalScreen} from '@screens/PatientPortalScreen';
import {PatientAppointmentsScreen} from '@screens/PatientAppointmentsScreen';
import {PatientMedicationsScreen} from '@screens/PatientMedicationsScreen';
import {PatientMessagesScreen} from '@screens/PatientMessagesScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const PatientStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="PatientList" component={PatientListScreen} />
    <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
    <Stack.Screen name="VitalSigns" component={VitalSignsScreen} />
    <Stack.Screen name="MedicationAdmin" component={MedicationAdminScreen} />
    <Stack.Screen name="ClinicalNotes" component={ClinicalNotesScreen} />
    <Stack.Screen name="PhotoCapture" component={PhotoCaptureScreen} />
  </Stack.Navigator>
);

const HomeCareStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="HomeCareVisit" component={HomeCareVisitScreen} />
    <Stack.Screen name="HomeCareTask" component={HomeCareTaskScreen} />
    <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
    <Stack.Screen name="VitalSigns" component={VitalSignsScreen} />
    <Stack.Screen name="PhotoCapture" component={PhotoCaptureScreen} />
  </Stack.Navigator>
);

const PatientPortalStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="PatientPortal" component={PatientPortalScreen} />
    <Stack.Screen name="PatientAppointments" component={PatientAppointmentsScreen} />
    <Stack.Screen name="PatientMedications" component={PatientMedicationsScreen} />
    <Stack.Screen name="PatientMessages" component={PatientMessagesScreen} />
  </Stack.Navigator>
);

const ClinicalTabs = () => {
  const {user} = useAuth();
  const isPatient = user?.role === 'patient';

  if (isPatient) {
    return (
      <Tab.Navigator
        screenOptions={({route}) => ({
          tabBarIcon: ({focused, color, size}) => {
            let iconName: string;

            switch (route.name) {
              case 'Dashboard':
                iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
                break;
              case 'Appointments':
                iconName = focused ? 'calendar-clock' : 'calendar-clock-outline';
                break;
              case 'Medications':
                iconName = focused ? 'pill' : 'pill-outline';
                break;
              case 'Messages':
                iconName = focused ? 'message-text' : 'message-text-outline';
                break;
              case 'Profile':
                iconName = focused ? 'account' : 'account-outline';
                break;
              default:
                iconName = 'circle';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#2E8B57',
          tabBarInactiveTintColor: 'gray',
          headerShown: false,
        })}>
        <Tab.Screen 
          name="Dashboard" 
          component={PatientPortalStack}
          options={{title: 'Home'}}
        />
        <Tab.Screen 
          name="Appointments" 
          component={PatientAppointmentsScreen}
          options={{title: 'Appointments'}}
        />
        <Tab.Screen 
          name="Medications" 
          component={PatientMedicationsScreen}
          options={{title: 'Medications'}}
        />
        <Tab.Screen 
          name="Messages" 
          component={PatientMessagesScreen}
          options={{title: 'Messages'}}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{title: 'Profile'}}
        />
      </Tab.Navigator>
    );
  }

  // Clinical staff tabs
  const isHomeCareProvider = user?.role === 'home_care_provider';

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Patients':
              iconName = focused ? 'account-group' : 'account-group-outline';
              break;
            case 'Tasks':
              iconName = focused ? 'clipboard-check' : 'clipboard-check-outline';
              break;
            case 'Schedule':
              iconName = focused ? 'calendar-today' : 'calendar-today-outline';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E8B57',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}>
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{title: 'Dashboard'}}
      />
      <Tab.Screen 
        name="Patients" 
        component={isHomeCareProvider ? HomeCareStack : PatientStack}
        options={{title: 'Patients'}}
      />
      <Tab.Screen 
        name="Tasks" 
        component={TaskListScreen}
        options={{title: 'Tasks'}}
      />
      <Tab.Screen 
        name="Schedule" 
        component={ScheduleScreen}
        options={{title: 'Schedule'}}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{title: 'Profile'}}
      />
    </Tab.Navigator>
  );
};

const DrawerNavigator = () => (
  <Drawer.Navigator
    screenOptions={{
      drawerActiveTintColor: '#2E8B57',
      drawerInactiveTintColor: 'gray',
      headerShown: false,
    }}>
    <Drawer.Screen 
      name="MainTabs" 
      component={ClinicalTabs}
      options={{
        title: 'OmniCare',
        drawerIcon: ({color, size}) => (
          <Icon name="home" color={color} size={size} />
        ),
      }}
    />
    <Drawer.Screen 
      name="Notifications" 
      component={NotificationsScreen}
      options={{
        title: 'Notifications',
        drawerIcon: ({color, size}) => (
          <Icon name="bell" color={color} size={size} />
        ),
      }}
    />
    <Drawer.Screen 
      name="SyncStatus" 
      component={SyncStatusScreen}
      options={{
        title: 'Sync Status',
        drawerIcon: ({color, size}) => (
          <Icon name="sync" color={color} size={size} />
        ),
      }}
    />
    <Drawer.Screen 
      name="Settings" 
      component={SettingsScreen}
      options={{
        title: 'Settings',
        drawerIcon: ({color, size}) => (
          <Icon name="cog" color={color} size={size} />
        ),
      }}
    />
  </Drawer.Navigator>
);

export const AppNavigator: React.FC = () => {
  return <DrawerNavigator />;
};