import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useSharedValue, useRunOnJS } from 'react-native-worklets-core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as SlitScan from '../native/SlitScan';
import type { CaptureStats } from '../../App';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type AppState = 'idle' | 'calibrating' | 'ready' | 'armed' | 'triggered' | 'result';

// Extended debug stats interface
interface DebugStats {
  // Frame info
  fps: number;
  targetFps: number;
  frameDrops: number;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  pixelFormat: string;

  // Timing
  lastFrameTime: number;
  processingTimeMs: number;

  // Detection
  rValue: number;
  rThreshold: number;
  detectorState: string;
  crossed: boolean;

  // Calibration
  calibrated: boolean;
  calibrationCount: number;
  bandTop: number;
  bandBottom: number;

  // Gate
  lineX: number;
  linePixelX: number;

  // Trigger info
  triggerPTS: number | null;
  elapsedSeconds: number | null;
  postTriggerCount: number;
  postTriggerTotal: number;
}

// Show detailed debug overlay
const SHOW_DEBUG_OVERLAY = true;

interface Props {
  onResult: (stats: CaptureStats) => void;
}

export default function SetupScreen({ onResult }: Props) {
  // Camera position state (front/back)
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');

  // Flash/torch state
  const [torchOn, setTorchOn] = useState(false);

  // Camera
  const device = useCameraDevice(cameraPosition);
  const format = useCameraFormat(device, [
    { fps: 240 },
    { videoResolution: { width: 1920, height: 1080 } },
  ]);

  // State
  const [appState, setAppState] = useState<AppState>('idle');
  const [lineX, setLineX] = useState(0.5);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Debug stats
  const [debugStats, setDebugStats] = useState<DebugStats>({
    fps: 0,
    targetFps: 0,
    frameDrops: 0,
    frameCount: 0,
    frameWidth: 0,
    frameHeight: 0,
    pixelFormat: 'unknown',
    lastFrameTime: 0,
    processingTimeMs: 0,
    rValue: 0,
    rThreshold: 0.1,
    detectorState: 'idle',
    crossed: false,
    calibrated: false,
    calibrationCount: 0,
    bandTop: 0,
    bandBottom: 0,
    lineX: 0.5,
    linePixelX: 0,
    triggerPTS: null,
    elapsedSeconds: null,
    postTriggerCount: 0,
    postTriggerTotal: 0,
  });

  // Frame timing for debug
  const frameCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const peakRValueRef = useRef(0);

  // Shared values for worklet communication
  const shouldCalibrate = useSharedValue(false);
  const calibrationStarted = useSharedValue(false);
  const shouldArm = useSharedValue(false);
  const isArmed = useSharedValue(false);
  const currentLineX = useSharedValue(0.5);

  // Refs
  const cameraRef = useRef<Camera>(null);

  // Trigger feedback - flash and sound
  const playTriggerFeedback = useCallback(async () => {
    // Flash the torch briefly - only if device has torch (back camera)
    if (device?.hasTorch) {
      setTorchOn(true);
      setTimeout(() => setTorchOn(false), 150);
    }

    // Heavy haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Play beep sound using system sound (no audio file needed)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [device?.hasTorch]);

  // Update line position in worklet
  useEffect(() => {
    currentLineX.value = lineX;
  }, [lineX, currentLineX]);

  // Gate line drag gesture
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newX = Math.max(0, Math.min(1, event.x / SCREEN_WIDTH));
      setLineX(newX);
    });

  // Callbacks from worklet
  const updateCalibrationProgress = useCallback((
    progress: number,
    frameWidth: number,
    frameHeight: number,
    bandTop: number,
    bandBottom: number
  ) => {
    console.log(`[Calibration] Progress: ${progress}/45 | Frame: ${frameWidth}x${frameHeight} | Band: ${bandTop}-${bandBottom}`);
    setCalibrationProgress(progress);
    setDebugStats(prev => ({
      ...prev,
      calibrationCount: progress,
      frameWidth,
      frameHeight,
      bandTop,
      bandBottom,
      calibrated: progress >= 45,
    }));
    if (progress >= 45) {
      console.log('[Calibration] COMPLETE - Ready to ARM');
      setAppState('ready');
    }
  }, []);

  // Detection points for visualization
  const [detectionPoints, setDetectionPoints] = useState<number[]>([]);

  const updateStats = useCallback((stats: {
    fps: number;
    r: number;
    frameDrops: number;
    state: string;
    crossed: boolean;
    frameWidth: number;
    frameHeight: number;
    triggerPTS: number | null;
    elapsedSeconds: number | null;
    postTriggerCount: number;
    postTriggerTotal: number;
    processingTimeMs: number;
    detectionPoints?: number[];
  }) => {
    frameCountRef.current++;
    const now = Date.now();

    // Track peak r-value
    if (stats.r > peakRValueRef.current) {
      peakRValueRef.current = stats.r;
    }

    // Log detection stats (throttled - only every 30 frames to avoid spam)
    if (frameCountRef.current % 30 === 0) {
      console.log(`[Detection] FPS: ${Math.round(stats.fps)} | r: ${stats.r.toFixed(3)} | State: ${stats.state} | Drops: ${stats.frameDrops}`);
    }

    // Log when r-value is getting close to threshold
    if (stats.r > 0.05 && stats.r < 0.10) {
      console.log(`[Detection] r approaching threshold: ${stats.r.toFixed(3)} (threshold: 0.10)`);
    }

    // Log when crossed and trigger feedback
    if (stats.crossed) {
      console.log(`[TRIGGERED] Crossed at r=${stats.r.toFixed(3)} | Elapsed: ${stats.elapsedSeconds?.toFixed(3)}s`);
      playTriggerFeedback();
    }

    // Update detection points for visualization
    if (stats.detectionPoints) {
      setDetectionPoints(stats.detectionPoints);
    }

    setDebugStats(prev => ({
      ...prev,
      fps: Math.round(stats.fps),
      frameDrops: stats.frameDrops,
      frameCount: frameCountRef.current,
      frameWidth: stats.frameWidth,
      frameHeight: stats.frameHeight,
      rValue: stats.r,
      detectorState: stats.state,
      crossed: stats.crossed,
      triggerPTS: stats.triggerPTS,
      elapsedSeconds: stats.elapsedSeconds,
      postTriggerCount: stats.postTriggerCount,
      postTriggerTotal: stats.postTriggerTotal,
      processingTimeMs: stats.processingTimeMs,
      lastFrameTime: now,
      lineX,
      linePixelX: Math.round(lineX * stats.frameWidth),
    }));

    lastUpdateRef.current = now;
  }, [lineX, playTriggerFeedback]);

  const handleTrigger = useCallback((
    elapsed: number,
    path: string,
    triggerFramePath: string,
    triggerPTS: number,
    fps: number,
    frameDrops: number,
    frameWidth: number,
    frameHeight: number,
    postTriggerCount: number
  ) => {
    console.log('========================================');
    console.log('[RESULT] CROSSING COMPLETE!');
    console.log(`[RESULT] Elapsed time: ${elapsed?.toFixed(3) || 'N/A'}s (${((elapsed || 0) * 1000).toFixed(1)}ms)`);
    console.log(`[RESULT] Trigger PTS: ${triggerPTS?.toFixed(6) || 'N/A'}`);
    console.log(`[RESULT] FPS: ${fps} | Frame drops: ${frameDrops}`);
    console.log(`[RESULT] Composite path: ${path}`);
    console.log(`[RESULT] Trigger frame path: ${triggerFramePath}`);
    console.log('========================================');

    setAppState('result');

    const stats: CaptureStats = {
      elapsedSeconds: elapsed,
      triggerPTS: triggerPTS,
      triggerFrameNumber: frameCountRef.current,
      actualFps: fps,
      targetFps: format?.maxFps || 240,
      totalFramesCaptured: frameCountRef.current,
      frameDrops: frameDrops,
      cameraPosition: cameraPosition,
      resolution: { width: frameWidth, height: frameHeight },
      peakRValue: peakRValueRef.current,
      rThreshold: 0.1,
      gateLinePosition: lineX,
      preTriggerFrames: Math.round(0.8 * (format?.maxFps || 240)),
      postTriggerFrames: postTriggerCount,
      compositePath: path,
      triggerFramePath: triggerFramePath || null,
      calibrationSamples: calibrationProgress,
      sessionDurationMs: Date.now() - sessionStartRef.current,
    };

    onResult(stats);
  }, [onResult, cameraPosition, lineX, format, calibrationProgress]);

  // Create worklet-safe versions of callbacks using useRunOnJS hook
  const runUpdateCalibrationProgress = useRunOnJS(updateCalibrationProgress, [updateCalibrationProgress]);
  const runUpdateStats = useRunOnJS(updateStats, [updateStats]);
  const runHandleTrigger = useRunOnJS(handleTrigger, [handleTrigger]);

  // Frame processor
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    const startTime = Date.now();

    // Configure line position
    SlitScan.configure(frame, currentLineX.value);

    // Handle calibration
    if (shouldCalibrate.value) {
      if (!calibrationStarted.value) {
        SlitScan.startCalibration(frame);
        calibrationStarted.value = true;
      }

      const result = SlitScan.calibrate(frame);
      if (result.success) {
        runUpdateCalibrationProgress(
          result.sampleCount,
          result.frameWidth || frame.width,
          result.frameHeight || frame.height,
          result.bandTop || 0,
          result.bandBottom || 0
        );
        if (result.complete) {
          shouldCalibrate.value = false;
          calibrationStarted.value = false;
        }
      }
      return;
    }

    // Handle arming
    if (shouldArm.value && !isArmed.value) {
      const result = SlitScan.arm(frame);
      if (result.success) {
        isArmed.value = true;
        shouldArm.value = false;
      }
      return;
    }

    // Process frames when armed or collecting post-trigger frames
    if (isArmed.value) {
      const result = SlitScan.process(frame);
      const processingTimeMs = Date.now() - startTime;

      // During collecting phase, minimize JS callbacks to maintain FPS
      // Only update on trigger, every 10th frame during collecting, or cooldown
      const isCollecting = result.state === 'collecting';
      const shouldUpdateUI = result.crossed ||
                            result.state === 'cooldown' ||
                            result.state === 'armed' ||
                            (isCollecting && (result.postTriggerCount || 0) % 10 === 0);

      // Log state transitions (only key events)
      if (result.crossed) {
        console.log(`[State] triggered | postTrigger: ${result.postTriggerCount}/${result.postTriggerTotal}`);
      } else if (result.state === 'cooldown') {
        console.log(`[State] cooldown | postTrigger: ${result.postTriggerCount}/${result.postTriggerTotal}`);
      }

      // Only call JS callback when necessary to avoid FPS drops
      if (shouldUpdateUI) {
        runUpdateStats({
          fps: result.fps,
          r: result.r,
          frameDrops: result.frameDrops,
          state: result.state,
          crossed: result.crossed,
          frameWidth: frame.width,
          frameHeight: frame.height,
          triggerPTS: result.triggerPTS || null,
          elapsedSeconds: result.elapsedSeconds || null,
          postTriggerCount: result.postTriggerCount || 0,
          postTriggerTotal: result.postTriggerTotal || 0,
          processingTimeMs,
          detectionPoints: result.detectionPoints || [],
        });
      }

      // Check if composite is ready
      if (result.state === 'cooldown') {
        const status = SlitScan.getStatus(frame);
        console.log(`[Cooldown] Composite: ${status.lastCompositePath} | TriggerFrame: ${status.triggerFramePath}`);
        if (status.lastCompositePath) {
          isArmed.value = false; // Stop processing only after we have the result
          runHandleTrigger(
            result.elapsedSeconds || 0,
            status.lastCompositePath,
            status.triggerFramePath || '',
            result.triggerPTS || 0,
            result.fps,
            result.frameDrops,
            frame.width,
            frame.height,
            result.postTriggerCount || 0
          );
        }
      }
    }
  }, [currentLineX, shouldCalibrate, calibrationStarted, shouldArm, isArmed, runUpdateCalibrationProgress, runUpdateStats, runHandleTrigger]);

  // Button handlers
  const handleCalibrate = useCallback(() => {
    console.log('[Button] CALIBRATE pressed - Starting calibration...');
    setAppState('calibrating');
    setCalibrationProgress(0);
    shouldCalibrate.value = true;
    calibrationStarted.value = false;
  }, [shouldCalibrate, calibrationStarted]);

  const handleArm = useCallback(() => {
    console.log('[Button] ARM pressed - System armed, waiting for crossing...');
    setAppState('armed');
    shouldArm.value = true;
    sessionStartRef.current = Date.now();
    peakRValueRef.current = 0;
  }, [shouldArm]);

  const handleReset = useCallback(() => {
    console.log('[Button] RESET pressed - Returning to idle state');
    setAppState('idle');
    shouldCalibrate.value = false;
    calibrationStarted.value = false;
    shouldArm.value = false;
    isArmed.value = false;
    setCalibrationProgress(0);
    frameCountRef.current = 0;
    setDebugStats(prev => ({
      ...prev,
      rValue: 0,
      frameCount: 0,
      crossed: false,
      triggerPTS: null,
      elapsedSeconds: null,
      calibrated: false,
      calibrationCount: 0,
    }));
  }, [shouldCalibrate, calibrationStarted, shouldArm, isArmed]);

  // Flip camera handler
  const handleFlipCamera = useCallback(() => {
    setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));
    // Reset state when flipping camera since calibration is camera-specific
    handleReset();
  }, [handleReset]);

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  const actualFps = format?.maxFps || 60;

  return (
    <SafeAreaView style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={true}
            frameProcessor={frameProcessor}
            fps={actualFps}
            video={true}
            audio={false}
            pixelFormat="yuv"
            torch={torchOn ? 'on' : 'off'}
          />

          {/* Gate line overlay */}
          <View
            style={[
              styles.gateLine,
              { left: `${lineX * 100}%` },
            ]}
          />

          {/* Detection band indicators */}
          <View style={[styles.bandLine, { top: '20%' }]} />
          <View style={[styles.bandLine, { top: '90%' }]} />

          {/* Live detection dots - shows where motion is detected */}
          {appState === 'armed' && detectionPoints.map((point, index) => {
            // Convert normalized band position to screen position
            // Band is 20%-90% of screen, so map point (0-1) to that range
            const screenY = 20 + (point * 70); // 20% + (point * 70%)
            return (
              <View
                key={index}
                style={[
                  styles.detectionDot,
                  {
                    top: `${screenY}%`,
                    left: `${lineX * 100}%`,
                    backgroundColor: debugStats.rValue > 0.1 ? '#ff0000' : '#00ff00',
                  },
                ]}
              />
            );
          })}

          {/* Status overlay - Enhanced Debug Mode */}
          <View style={styles.statusOverlay}>
            <Text style={styles.debugTitle}>DEBUG INFO</Text>
            <Text style={styles.statusText}>
              FPS: {debugStats.fps} (target: {actualFps}) | Drops: {debugStats.frameDrops}
            </Text>
            <Text style={styles.statusText}>
              r: {debugStats.rValue.toFixed(3)} | Threshold: 0.10 | State: {debugStats.detectorState}
            </Text>
            <Text style={styles.statusText}>
              Gate UI: {(lineX * 100).toFixed(1)}% | Cam: {cameraPosition}
            </Text>
            {SHOW_DEBUG_OVERLAY && (
              <>
                <Text style={styles.debugSeparator}>--- FRAME INFO ---</Text>
                <Text style={styles.statusText}>
                  Frame: {debugStats.frameWidth}x{debugStats.frameHeight}
                </Text>
                <Text style={styles.statusText}>
                  Screen: {SCREEN_WIDTH.toFixed(0)}x{SCREEN_HEIGHT.toFixed(0)}
                </Text>
                <Text style={styles.statusText}>
                  Gate pixel X: {debugStats.linePixelX} / {debugStats.frameWidth}
                </Text>
                <Text style={styles.debugSeparator}>--- DETECTION BAND ---</Text>
                <Text style={styles.statusText}>
                  Band: {debugStats.bandTop} - {debugStats.bandBottom}
                </Text>
                <Text style={styles.statusText}>
                  Band height: {debugStats.bandBottom - debugStats.bandTop}px
                </Text>
                <Text style={styles.statusText}>
                  Detection points: {detectionPoints.length}
                </Text>
                <Text style={styles.debugSeparator}>--- ORIENTATION ---</Text>
                <Text style={styles.statusText}>
                  Frame aspect: {(debugStats.frameWidth / Math.max(1, debugStats.frameHeight)).toFixed(2)}
                </Text>
                <Text style={styles.statusText}>
                  {debugStats.frameWidth > debugStats.frameHeight ? 'LANDSCAPE SENSOR' : 'PORTRAIT SENSOR'}
                </Text>
                <Text style={[styles.statusText, { color: '#ffff00' }]}>
                  NOTE: Gate line samples VERTICAL strip in sensor
                </Text>
              </>
            )}
          </View>

          {/* Camera flip button */}
          <TouchableOpacity
            style={styles.flipButton}
            onPress={handleFlipCamera}
          >
            <Text style={styles.flipButtonText}>Flip</Text>
          </TouchableOpacity>
        </View>
      </GestureDetector>

      {/* Controls */}
      <View style={styles.controls}>
        {appState === 'idle' && (
          <TouchableOpacity style={styles.button} onPress={handleCalibrate}>
            <Text style={styles.buttonText}>Calibrate (Empty Lane)</Text>
          </TouchableOpacity>
        )}

        {appState === 'calibrating' && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Calibrating... {calibrationProgress}/45
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(calibrationProgress / 45) * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

        {appState === 'ready' && (
          <>
            <Text style={styles.readyText}>Calibrated</Text>
            <TouchableOpacity style={[styles.button, styles.armButton]} onPress={handleArm}>
              <Text style={styles.buttonText}>ARM</Text>
            </TouchableOpacity>
          </>
        )}

        {appState === 'armed' && (
          <View style={styles.armedContainer}>
            <Text style={styles.armedText}>ARMED - Waiting for crossing...</Text>
            <View style={styles.rValueContainer}>
              <Text style={styles.rValueLabel}>Occupancy (r):</Text>
              <View style={styles.rValueBar}>
                <View
                  style={[
                    styles.rValueFill,
                    {
                      width: `${Math.min(100, debugStats.rValue * 100)}%`,
                      backgroundColor: debugStats.rValue > 0.1 ? '#ff4444' : '#44ff44',
                    },
                  ]}
                />
                <View style={[styles.threshold, { left: '10%' }]} />
              </View>
            </View>
          </View>
        )}

        {appState !== 'idle' && appState !== 'calibrating' && (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  gateLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#ff0000',
    marginLeft: -1.5,
  },
  bandLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 0, 0.5)',
  },
  detectionDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    marginTop: -6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusOverlay: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 10,
    borderRadius: 8,
    maxWidth: '70%',
  },
  debugTitle: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  debugSeparator: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 6,
    marginBottom: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  controls: {
    padding: 20,
    backgroundColor: '#111',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  armButton: {
    backgroundColor: '#ff6600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  progressBar: {
    width: '100%',
    height: 20,
    backgroundColor: '#333',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  readyText: {
    color: '#44ff44',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  armedContainer: {
    alignItems: 'center',
  },
  armedText: {
    color: '#ff6600',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  rValueContainer: {
    width: '100%',
  },
  rValueLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  rValueBar: {
    width: '100%',
    height: 30,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  rValueFill: {
    height: '100%',
  },
  threshold: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#fff',
  },
  resetButton: {
    marginTop: 15,
    padding: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#888',
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  flipButton: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
