import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Camera } from 'react-native-vision-camera';
import SetupScreen from './src/screens/SetupScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import DebugFrameViewer from './src/screens/DebugFrameViewer';
import type { DebugFrameData } from './src/native/SlitScan';

type Screen = 'permissions' | 'setup' | 'results' | 'debugViewer';

export interface CaptureStats {
  // Timing
  elapsedSeconds: number;
  triggerPTS: number;
  triggerFrameNumber: number;

  // Camera/Capture
  actualFps: number;
  targetFps: number;
  totalFramesCaptured: number;
  frameDrops: number;
  cameraPosition: 'front' | 'back';
  resolution: { width: number; height: number };

  // Detection
  peakRValue: number;
  rThreshold: number;
  gateLinePosition: number; // 0-1

  // Composite
  preTriggerFrames: number;
  postTriggerFrames: number;
  compositePath: string;
  triggerFramePath: string | null;

  // Session
  calibrationSamples: number;
  sessionDurationMs: number;
}

interface ResultData {
  elapsedSeconds: number;
  compositePath: string;
  stats: CaptureStats;
}

interface DebugViewerData {
  frames: DebugFrameData[];
  frameWidth: number;
  frameHeight: number;
  gateLineX: number;
  gatePixelX: number;
  triggerFrameIndex?: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('permissions');
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [debugViewerData, setDebugViewerData] = useState<DebugViewerData | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('checking');

  // Check camera permissions
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const cameraPermission = await Camera.getCameraPermissionStatus();

    if (cameraPermission === 'granted') {
      setPermissionStatus('granted');
      setScreen('setup');
    } else if (cameraPermission === 'not-determined') {
      setPermissionStatus('not-determined');
    } else {
      setPermissionStatus('denied');
    }
  };

  const requestPermissions = async () => {
    const newPermission = await Camera.requestCameraPermission();
    if (newPermission === 'granted') {
      setPermissionStatus('granted');
      setScreen('setup');
    } else {
      setPermissionStatus('denied');
    }
  };

  const handleResult = useCallback((stats: CaptureStats) => {
    setResultData({
      elapsedSeconds: stats.elapsedSeconds,
      compositePath: stats.compositePath,
      stats
    });
    setScreen('results');
  }, []);

  const handleReset = useCallback(() => {
    setResultData(null);
    setDebugViewerData(null);
    setScreen('setup');
  }, []);

  const handleOpenDebugViewer = useCallback((data: DebugViewerData) => {
    setDebugViewerData(data);
    setScreen('debugViewer');
  }, []);

  const handleCloseDebugViewer = useCallback(() => {
    setScreen('results');
  }, []);

  const handleSelectCrossing = useCallback((frameIndex: number, manualX?: number) => {
    console.log(`[Debug] User marked crossing at frame ${frameIndex}, manual X: ${manualX}`);
    // This info can be used to diagnose the gate position issue
  }, []);

  // Permissions screen
  if (screen === 'permissions') {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionsContainer}>
          <Text style={styles.title}>SprintTimer MVP</Text>
          <Text style={styles.subtitle}>Photo-Finish Timing Validation</Text>

          {permissionStatus === 'checking' && (
            <Text style={styles.statusText}>Checking permissions...</Text>
          )}

          {permissionStatus === 'not-determined' && (
            <>
              <Text style={styles.infoText}>
                This app needs camera access to capture high-speed video for timing.
              </Text>
              <TouchableOpacity style={styles.button} onPress={requestPermissions}>
                <Text style={styles.buttonText}>Grant Camera Access</Text>
              </TouchableOpacity>
            </>
          )}

          {permissionStatus === 'denied' && (
            <>
              <Text style={styles.errorText}>
                Camera access was denied. Please enable it in Settings to use this app.
              </Text>
              <TouchableOpacity style={styles.button} onPress={checkPermissions}>
                <Text style={styles.buttonText}>Check Again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </GestureHandlerRootView>
    );
  }

  // Setup/timing screen
  if (screen === 'setup') {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <SetupScreen onResult={handleResult} />
      </GestureHandlerRootView>
    );
  }

  // Results screen
  if (screen === 'results' && resultData) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ResultsScreen
          stats={resultData.stats}
          onReset={handleReset}
          onOpenDebugViewer={handleOpenDebugViewer}
        />
      </GestureHandlerRootView>
    );
  }

  // Debug frame viewer
  if (screen === 'debugViewer' && debugViewerData) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <DebugFrameViewer
          frames={debugViewerData.frames}
          frameWidth={debugViewerData.frameWidth}
          frameHeight={debugViewerData.frameHeight}
          gateLineX={debugViewerData.gateLineX}
          gatePixelX={debugViewerData.gatePixelX}
          triggerFrameIndex={debugViewerData.triggerFrameIndex}
          onClose={handleCloseDebugViewer}
          onSelectCrossing={handleSelectCrossing}
        />
      </GestureHandlerRootView>
    );
  }

  return null;
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
    fontSize: 32,
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
  statusText: {
    color: '#888',
    fontSize: 16,
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
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
