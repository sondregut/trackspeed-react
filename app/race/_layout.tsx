import { Stack } from 'expo-router';
import { RaceProvider } from '../../src/race/RaceContext';

export default function RaceLayout() {
  return (
    <RaceProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
          animation: 'ios_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="pair" />
        <Stack.Screen name="sync" />
        <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      </Stack>
    </RaceProvider>
  );
}
