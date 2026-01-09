import { useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import SetupScreen from '../src/screens/SetupScreen';
import ResultsModal from '../src/components/ResultsModal';
import DebugFrameViewer from '../src/screens/DebugFrameViewer';
import { useHistoryStore } from '../src/store/historyStore';
import * as SlitScan from '../src/native/SlitScan';
import type { CaptureStats } from '../src/types';
import type { DebugFrameData } from '../src/native/SlitScan';

interface DebugViewerData {
  frames: DebugFrameData[];
  frameWidth: number;
  frameHeight: number;
  gateLineX: number;
  gatePixelX: number;
  triggerFrameIndex?: number;
}

export default function PhotoFinishScreen() {
  const router = useRouter();
  const [showResults, setShowResults] = useState(false);
  const [currentStats, setCurrentStats] = useState<CaptureStats | null>(null);
  const [showDebugViewer, setShowDebugViewer] = useState(false);
  const [debugViewerData, setDebugViewerData] = useState<DebugViewerData | null>(null);
  const [isExportingFrames, setIsExportingFrames] = useState(false);
  const addSession = useHistoryStore((state) => state.addSession);

  // Camera for exporting debug frames
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  const handleResult = useCallback((stats: CaptureStats) => {
    setCurrentStats(stats);
    setShowResults(true);
  }, []);

  // Handler for debug frames export
  const handleDebugFramesExported = useCallback((result: SlitScan.ExportDebugFramesResult) => {
    setIsExportingFrames(false);
    if (result.success && result.frames && currentStats) {
      setDebugViewerData({
        frames: result.frames,
        frameWidth: result.frameWidth || 0,
        frameHeight: result.frameHeight || 0,
        gateLineX: result.gateLineX || currentStats.gateLinePosition,
        gatePixelX: result.gatePixelX || 0,
        triggerFrameIndex: result.triggerFrameIndex,
      });
      setShowDebugViewer(true);
    } else {
      console.error('[DebugFrames] Export failed:', result.error);
    }
  }, [currentStats]);

  const runHandleDebugFramesExported = useRunOnJS(handleDebugFramesExported, [handleDebugFramesExported]);

  // Frame processor for exporting debug frames
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (isExportingFrames) {
      const result = SlitScan.exportDebugFrames(frame);
      runHandleDebugFramesExported(result);
    }
  }, [isExportingFrames, runHandleDebugFramesExported]);

  const handleViewFrames = useCallback(() => {
    setIsExportingFrames(true);
  }, []);

  const handleCloseDebugViewer = useCallback(() => {
    setShowDebugViewer(false);
  }, []);

  const handleSave = useCallback(() => {
    if (currentStats) {
      addSession({
        mode: 'photo-finish',
        stats: currentStats,
        timestamp: Date.now(),
      });
      setShowResults(false);
      setCurrentStats(null);
      // Go back to tabs and switch to history
      router.replace('/(tabs)/history');
    }
  }, [currentStats, addSession, router]);

  const handleNewRun = useCallback(() => {
    setShowResults(false);
    setCurrentStats(null);
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Show debug viewer if active
  if (showDebugViewer && debugViewerData) {
    return (
      <View style={styles.container}>
        <DebugFrameViewer
          frames={debugViewerData.frames}
          frameWidth={debugViewerData.frameWidth}
          frameHeight={debugViewerData.frameHeight}
          gateLineX={debugViewerData.gateLineX}
          gatePixelX={debugViewerData.gatePixelX}
          triggerFrameIndex={debugViewerData.triggerFrameIndex}
          onClose={handleCloseDebugViewer}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SetupScreen onResult={handleResult} onBack={handleBack} />

      {showResults && currentStats && (
        <ResultsModal
          stats={currentStats}
          onSave={handleSave}
          onNewRun={handleNewRun}
          onBack={handleBack}
          onViewFrames={handleViewFrames}
        />
      )}

      {/* Hidden camera for exporting debug frames */}
      {isExportingFrames && device && (
        <Camera
          ref={cameraRef}
          style={styles.hiddenCamera}
          device={device}
          isActive={true}
          frameProcessor={frameProcessor}
          video={true}
          audio={false}
          pixelFormat="yuv"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
