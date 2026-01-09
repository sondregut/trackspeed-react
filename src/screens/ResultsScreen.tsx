import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Share,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import * as SlitScan from '../native/SlitScan';
import type { CaptureStats } from '../../App';
import type { DebugFrameData } from '../native/SlitScan';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DebugViewerData {
  frames: DebugFrameData[];
  frameWidth: number;
  frameHeight: number;
  gateLineX: number;
  gatePixelX: number;
  triggerFrameIndex?: number;
}

interface Props {
  stats: CaptureStats;
  onReset: () => void;
  onOpenDebugViewer?: (data: DebugViewerData) => void;
}

export default function ResultsScreen({ stats, onReset, onOpenDebugViewer }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExportingDebug, setIsExportingDebug] = useState(false);
  const [debugExportError, setDebugExportError] = useState<string | null>(null);

  // We need a camera reference to call the export function
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  // Handler to receive debug frame export results
  const handleDebugFramesExported = useCallback((result: SlitScan.ExportDebugFramesResult) => {
    setIsExportingDebug(false);
    if (result.success && result.frames && onOpenDebugViewer) {
      onOpenDebugViewer({
        frames: result.frames,
        frameWidth: result.frameWidth || 0,
        frameHeight: result.frameHeight || 0,
        gateLineX: result.gateLineX || stats.gateLinePosition,
        gatePixelX: result.gatePixelX || 0,
        triggerFrameIndex: result.triggerFrameIndex,
      });
    } else {
      setDebugExportError(result.error || 'Failed to export debug frames');
    }
  }, [onOpenDebugViewer, stats.gateLinePosition]);

  const runHandleDebugFramesExported = useRunOnJS(handleDebugFramesExported, [handleDebugFramesExported]);

  // Frame processor to export debug frames
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (isExportingDebug) {
      const result = SlitScan.exportDebugFrames(frame);
      runHandleDebugFramesExported(result);
    }
  }, [isExportingDebug, runHandleDebugFramesExported]);

  const handleExportDebugFrames = useCallback(() => {
    setIsExportingDebug(true);
    setDebugExportError(null);
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sprint Time: ${stats.elapsedSeconds.toFixed(3)}s`,
        url: stats.compositePath,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Format time with milliseconds
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
    }
    return `${secs.toFixed(3)}s`;
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Time Display */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>FINISH TIME</Text>
          <Text style={styles.timeValue}>{formatTime(stats.elapsedSeconds)}</Text>
          <Text style={styles.timeSubtext}>
            {(stats.elapsedSeconds * 1000).toFixed(1)} milliseconds
          </Text>
        </View>

        {/* Trigger Frame - Shows the exact frame when crossing was detected */}
        {stats.triggerFramePath && (
          <View style={styles.compositeContainer}>
            <Text style={styles.compositeLabel}>Trigger Frame (Detection Moment)</Text>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: `file://${stats.triggerFramePath}` }}
                style={styles.triggerFrameImage}
                resizeMode="contain"
              />
              {/* Gate line overlay - shows where measurement was taken */}
              <View
                style={[
                  styles.gateLineOverlay,
                  { left: `${stats.gateLinePosition * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.compositeHelp}>
              Exact frame when crossing was detected. Red line = gate/measurement position.
            </Text>
          </View>
        )}

        {/* Composite Image */}
        <View style={styles.compositeContainer}>
          <Text style={styles.compositeLabel}>Photo-Finish Composite</Text>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: `file://${stats.compositePath}` }}
              style={styles.compositeImage}
              resizeMode="contain"
            />
            {/* Trigger line indicator */}
            <View style={styles.triggerLine} />
            <Text style={styles.triggerLabel}>Trigger Point</Text>
          </View>
          <Text style={styles.compositeHelp}>
            Time flows left to right. Vertical slice = gate position over time.
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsContainer}>
          <View style={styles.quickStatRow}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{stats.actualFps}</Text>
              <Text style={styles.quickStatLabel}>FPS</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{stats.frameDrops}</Text>
              <Text style={styles.quickStatLabel}>Drops</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{stats.totalFramesCaptured}</Text>
              <Text style={styles.quickStatLabel}>Frames</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{(stats.gateLinePosition * 100).toFixed(0)}%</Text>
              <Text style={styles.quickStatLabel}>Gate</Text>
            </View>
          </View>
        </View>

        {/* Advanced Stats Toggle */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? 'Hide' : 'Show'} Advanced Stats
          </Text>
        </TouchableOpacity>

        {/* Advanced Stats */}
        {showAdvanced && (
          <View style={styles.advancedContainer}>
            {/* Timing Section */}
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Timing</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Trigger PTS</Text>
                <Text style={styles.statValue}>{stats.triggerPTS.toFixed(6)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Trigger Frame #</Text>
                <Text style={styles.statValue}>{stats.triggerFrameNumber}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Precision</Text>
                <Text style={styles.statValue}>±{(1000 / stats.actualFps).toFixed(2)}ms</Text>
              </View>
            </View>

            {/* Camera Section */}
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Camera</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Position</Text>
                <Text style={styles.statValue}>{stats.cameraPosition}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Resolution</Text>
                <Text style={styles.statValue}>{stats.resolution.width}x{stats.resolution.height}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Target FPS</Text>
                <Text style={styles.statValue}>{stats.targetFps}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Actual FPS</Text>
                <Text style={styles.statValue}>{stats.actualFps}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Frame Drops</Text>
                <Text style={[styles.statValue, stats.frameDrops > 10 && styles.statWarning]}>
                  {stats.frameDrops}
                </Text>
              </View>
            </View>

            {/* Detection Section */}
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Detection</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Peak r-value</Text>
                <Text style={styles.statValue}>{stats.peakRValue.toFixed(4)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>r-threshold</Text>
                <Text style={styles.statValue}>{stats.rThreshold}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Gate Position</Text>
                <Text style={styles.statValue}>{(stats.gateLinePosition * 100).toFixed(1)}%</Text>
              </View>
            </View>

            {/* Composite Section */}
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Composite</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pre-trigger Frames</Text>
                <Text style={styles.statValue}>{stats.preTriggerFrames}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Post-trigger Frames</Text>
                <Text style={styles.statValue}>{stats.postTriggerFrames}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Composite</Text>
                <Text style={styles.statValue}>{stats.preTriggerFrames + stats.postTriggerFrames}</Text>
              </View>
            </View>

            {/* Session Section */}
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Session</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Calibration Samples</Text>
                <Text style={styles.statValue}>{stats.calibrationSamples}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Session Duration</Text>
                <Text style={styles.statValue}>{formatDuration(stats.sessionDurationMs)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Frames</Text>
                <Text style={styles.statValue}>{stats.totalFramesCaptured}</Text>
              </View>
            </View>

            {/* File Path */}
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>File</Text>
              <Text style={styles.pathText}>{stats.compositePath}</Text>
            </View>
          </View>
        )}

        {/* Debug Frames Button */}
        {onOpenDebugViewer && (
          <View style={styles.debugSection}>
            <Text style={styles.debugSectionTitle}>Debug Tools</Text>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleExportDebugFrames}
              disabled={isExportingDebug}
            >
              <Text style={styles.debugButtonText}>
                {isExportingDebug ? 'Exporting...' : 'View Debug Frames (Scrubber)'}
              </Text>
            </TouchableOpacity>
            {debugExportError && (
              <Text style={styles.debugError}>{debugExportError}</Text>
            )}
            <Text style={styles.debugHelp}>
              Scrub through frames to see exactly when/where motion was detected
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share Result</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={onReset}>
            <Text style={styles.resetButtonText}>New Timing</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Hidden camera for debug export - only visible when exporting */}
      {isExportingDebug && device && (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    padding: 20,
  },
  timeContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#111',
    borderRadius: 16,
    marginBottom: 20,
  },
  timeLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  timeValue: {
    color: '#00ff00',
    fontSize: 64,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  timeSubtext: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
  },
  compositeContainer: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  compositeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  imageWrapper: {
    position: 'relative',
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
  },
  compositeImage: {
    width: SCREEN_WIDTH - 72,
    height: 200,
    backgroundColor: '#333',
  },
  triggerFrameImage: {
    width: SCREEN_WIDTH - 72,
    height: 250,
    backgroundColor: '#333',
  },
  gateLineOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#ff0000',
    marginLeft: -1.5,
  },
  triggerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '33%',
    width: 2,
    backgroundColor: '#ff0000',
  },
  triggerLabel: {
    position: 'absolute',
    bottom: 5,
    right: '33%',
    color: '#ff0000',
    fontSize: 10,
    transform: [{ translateX: 5 }],
  },
  compositeHelp: {
    color: '#666',
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  quickStatsContainer: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  quickStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickStat: {
    alignItems: 'center',
  },
  quickStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  quickStatLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  advancedToggle: {
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  advancedToggleText: {
    color: '#007AFF',
    fontSize: 16,
  },
  advancedContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statsSection: {
    marginBottom: 20,
  },
  statsSectionTitle: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statLabel: {
    color: '#888',
    fontSize: 14,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  statWarning: {
    color: '#ff6600',
  },
  pathText: {
    color: '#444',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  actions: {
    gap: 12,
  },
  shareButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  debugSection: {
    backgroundColor: '#1a1a00',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444400',
  },
  debugSectionTitle: {
    color: '#ffff00',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  debugButton: {
    backgroundColor: '#444400',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#ffff00',
    fontSize: 16,
    fontWeight: '600',
  },
  debugError: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 8,
  },
  debugHelp: {
    color: '#888800',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
