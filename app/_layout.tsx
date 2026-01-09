import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Camera } from 'react-native-vision-camera';

export default function RootLayout() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const status = await Camera.getCameraPermissionStatus();
    if (status === 'granted') {
      setHasPermission(true);
    } else if (status === 'not-determined') {
      setHasPermission(null);
    } else {
      setHasPermission(false);
    }
  };

  const requestPermissions = async () => {
    const result = await Camera.requestCameraPermission();
    setHasPermission(result === 'granted');
  };

  // Show permission request screen if needed
  if (hasPermission === null) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.permissionsContainer}>
          <Text style={styles.title}>SprintTimer</Text>
          <Text style={styles.subtitle}>Photo-Finish Timing System</Text>
          <Text style={styles.infoText}>
            This app needs camera access to capture high-speed video for precise timing.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (hasPermission === false) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.permissionsContainer}>
          <Text style={styles.title}>SprintTimer</Text>
          <Text style={styles.errorText}>
            Camera access was denied. Please enable it in Settings.
          </Text>
          <TouchableOpacity style={styles.button} onPress={checkPermissions}>
            <Text style={styles.buttonText}>Check Again</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
          animation: 'ios_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="photo-finish" options={{ gestureEnabled: false }} />
        <Stack.Screen name="race" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    marginBottom: 40,
  },
  infoText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  errorText: {
    color: '#ff6666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
