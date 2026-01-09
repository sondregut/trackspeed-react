import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { useHistoryStore } from '../../src/store/historyStore';
import DebugFrameViewer from '../../src/screens/DebugFrameViewer';
import * as SlitScan from '../../src/native/SlitScan';
import type { DebugFrameData } from '../../src/native/SlitScan';

interface DebugViewerData {
  frames: DebugFrameData[];
  frameWidth: number;
  frameHeight: number;
  gateLineX: number;
  gatePixelX: number;
  triggerFrameIndex?: number;
}

function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return `${seconds.toFixed(3)}s`;
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useHistoryStore((state) => state.getSession(id || ''));

  const [showDebugViewer, setShowDebugViewer] = useState(false);
  const [debugViewerData, setDebugViewerData] = useState<DebugViewerData | null>(null);
  const [isExportingFrames, setIsExportingFrames] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  // Handler for debug frames export
  const handleDebugFramesExported = useCallback((result: SlitScan.ExportDebugFramesResult) => {
    setIsExportingFrames(false);
    if (result.success && result.frames && session) {
      setDebugViewerData({
        frames: result.frames,
        frameWidth: result.frameWidth || 0,
        frameHeight: result.frameHeight || 0,
        gateLineX: result.gateLineX || session.stats.gateLinePosition,
        gatePixelX: result.gatePixelX || 0,
        triggerFrameIndex: result.triggerFrameIndex,
      });
      setShowDebugViewer(true);
      setExportError(null);
    } else {
      setExportError('Frames no longer available. They are cleared when a new session starts.');
    }
  }, [session]);

  const runHandleDebugFramesExported = useRunOnJS(handleDebugFramesExported, [handleDebugFramesExported]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (isExportingFrames) {
      const result = SlitScan.exportDebugFrames(frame);
      runHandleDebugFramesExported(result);
    }
  }, [isExportingFrames, runHandleDebugFramesExported]);

  const handleViewFrames = useCallback(() => {
    setExportError(null);
    setIsExportingFrames(true);
  }, []);

  const handleCloseDebugViewer = useCallback(() => {
    setShowDebugViewer(false);
  }, []);

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Session not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const { stats } = session;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerBackText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Time Display */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>FINISH TIME</Text>
          <Text style={styles.timeValue}>{formatTime(stats.elapsedSeconds)}</Text>
          <Text style={styles.timeMs}>{(stats.elapsedSeconds * 1000).toFixed(1)} ms</Text>
        </View>

        {/* View Frames Button */}
        <TouchableOpacity
          style={styles.viewFramesButton}
          onPress={handleViewFrames}
          disabled={isExportingFrames}
        >
          <Text style={styles.viewFramesText}>
            {isExportingFrames ? 'Loading...' : 'View All Frames'}
          </Text>
        </TouchableOpacity>
        {exportError && (
          <Text style={styles.exportError}>{exportError}</Text>
        )}

        {/* Trigger Frame */}
        {stats.triggerFramePath && (
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Crossing Frame</Text>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: `file://${stats.triggerFramePath}` }}
                style={styles.mainImage}
                resizeMode="contain"
              />
              <View style={[styles.gateLine, { left: `${stats.gateLinePosition * 100}%` }]} />
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.actualFps.toFixed(0)}</Text>
              <Text style={styles.statLabel}>FPS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.frameDrops}</Text>
              <Text style={styles.statLabel}>Drops</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(stats.gateLinePosition * 100).toFixed(0)}%</Text>
              <Text style={styles.statLabel}>Gate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.cameraPosition}</Text>
              <Text style={styles.statLabel}>Camera</Text>
            </View>
          </View>
        </View>
      </ScrollView>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerBackText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  timeContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#111',
    borderRadius: 16,
    marginBottom: 16,
  },
  timeLabel: {
    color: '#888',
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 8,
  },
  timeValue: {
    color: '#00ff00',
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeMs: {
    color: '#666',
    fontSize: 16,
    marginTop: 4,
  },
  viewFramesButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  viewFramesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportError: {
    color: '#ff6600',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  imageSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  imageWrapper: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: 220,
  },
  gateLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ff0000',
  },
  statsSection: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    width: '45%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  backButton: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 12,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
