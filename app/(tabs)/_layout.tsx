import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Try to import NativeTabs for iOS liquid glass effect
let NativeTabs: any = null;
let Icon: any = null;
let Label: any = null;
let hasNativeTabs = false;

if (Platform.OS === 'ios') {
  try {
    const nativeTabsModule = require('expo-router/unstable-native-tabs');
    NativeTabs = nativeTabsModule.NativeTabs;
    Icon = nativeTabsModule.Icon;
    Label = nativeTabsModule.Label;
    hasNativeTabs = true;
  } catch (error) {
    console.log('NativeTabs not available, using JS fallback');
  }
}

// Fallback JS Tabs component
function JSTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#222',
          borderTopWidth: 1,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Timer',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="clock-o" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="history" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome name="user-circle-o" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

// Native iOS Tabs with liquid glass effect
function IOSNativeTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'stopwatch', selected: 'stopwatch.fill' }} />
        <Label>Timer</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }} />
        <Label>History</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabLayout() {
  // Use native tabs on iOS if available, otherwise fall back to JS tabs
  if (hasNativeTabs && NativeTabs && Icon && Label) {
    return <IOSNativeTabs />;
  }
  return <JSTabs />;
}
