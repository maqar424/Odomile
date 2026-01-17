import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

// WICHTIG: Die "unstable_settings" wurden entfernt!

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Zuerst der Startscreen */}
        <Stack.Screen name="index" />
        {/* Dann die Tabs */}
        <Stack.Screen name="(tabs)" />
        {/* Das Modal (optional) */}
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}