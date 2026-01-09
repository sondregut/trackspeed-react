import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useSharedValue, useRunOnJS } from 'react-native-worklets-core';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SlitScan from '../../src/native/SlitScan';
import { useRace } from '../../src/race/RaceContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type SessionState = 'calibrating' | 'ready' | 'armed' | 'running' | 'finished';

export default function RaceSession() {
  const {
    role,
    state: raceState,
    syncStatus,
    result,
    handleLocalCrossing,
    armDetection,
    reset,
    disconnect,
  } = useRace();

  // Camera
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 240 },
    { videoResolution: { width: 1920, height: 1080 } },
  ]);

  // Local state
  const [sessionState, setSessionState] = useState<SessionState>('calibrating');
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [rValue, setRValue] = useState(0);

  // Timer for running display
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Shared values for worklet
  const shouldCalibrate = useSharedValue(false);
  const calibrationStarted = useSharedValue(false);
  const shouldArm = useSharedValue(false);
  const isArmed = useSharedValue(false);
  const currentLineX = useSharedValue(0.5);

  // Audio
  const triggerPlayer = useAudioPlayer(require('../../assets/beep.wav'));

  // Trigger feedback
  const playTriggerFeedback = useCallback(async () => {
    try {
      triggerPlayer.seekTo(0);
      triggerPlayer.play();
    } catch (error) {
      console.warn('[Audio] Error:', error);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [triggerPlayer]);

  // Auto-start calibration
  useEffect(() => {
    if (sessionState === 'calibrating') {
      shouldCalibrate.value = true;
    }
  }, [sessionState, shouldCalibrate]);

  // Handle race state changes
  useEffect(() => {
    if (raceState === 'running' && role === 'finish') {
      // Start timer display when start phone triggers
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 10);
      setSessionState('running');
    }

    if (raceState === 'finished') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setSessionState('finished');
    }
  }, [raceState, role]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Calibration progress callback
  const updateCalibrationProgress = useCallback(
    (progress: number) => {
      setCalibrationProgress(progress);
      if (progress >= 45) {
        setSessionState('ready');
      }
    },
    []
  );

  // Handle crossing detection
  const handleCrossing = useCallback(
    async (
      triggerPtsSeconds: number,
      ptsNowSeconds: number,
      uptimeNowNanos: string
    ) => {
      playTriggerFeedback();

      // Send to race session for multi-phone timing
      await handleLocalCrossing(
        triggerPtsSeconds,
        ptsNowSeconds,
        uptimeNowNanos
      );

      if (role === 'start') {
        setSessionState('running');
      }
    },
    [role, handleLocalCrossing, playTriggerFeedback]
  );

  // Stats update callback
  const updateStats = useCallback(
    (stats: {
      r: number;
      crossed: boolean;
      triggerPTS?: number;
      ptsSeconds?: number;
      uptimeNanos?: string;
    }) => {
      setRValue(stats.r);

      if (stats.crossed && stats.triggerPTS && stats.ptsSeconds && stats.uptimeNanos) {
        handleCrossing(stats.triggerPTS, stats.ptsSeconds, stats.uptimeNanos);
      }
    },
    [handleCrossing]
  );

  // Create worklet-safe callbacks
  const runUpdateCalibrationProgress = useRunOnJS(updateCalibrationProgress, [
    updateCalibrationProgress,
  ]);
  const runUpdateStats = useRunOnJS(updateStats, [updateStats]);

  // Frame processor
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      SlitScan.configure(frame, currentLineX.value);

      // Calibration
      if (shouldCalibrate.value) {
        if (!calibrationStarted.value) {
          SlitScan.startCalibration(frame);
          calibrationStarted.value = true;
        }

        const result = SlitScan.calibrate(frame);
        if (result && typeof result.sampleCount === 'number') {
          runUpdateCalibrationProgress(result.sampleCount);
          if (result.complete) {
            shouldCalibrate.value = false;
            calibrationStarted.value = false;
          }
        }
        return;
      }

      // Arm
      if (shouldArm.value && !isArmed.value) {
        SlitScan.arm(frame);
        isArmed.value = true;
        shouldArm.value = false;
      }

      // Process
      if (isArmed.value) {
        const result = SlitScan.process(frame);
        if (result) {
          runUpdateStats({
            r: result.r || 0,
            crossed: result.crossed || false,
            triggerPTS: result.triggerPTS,
            ptsSeconds: result.ptsSeconds,
            uptimeNanos: result.uptimeNanos,
          });
        }
      }
    },
    [runUpdateCalibrationProgress, runUpdateStats]
  );

  // Arm the detector
  const handleArm = useCallback(() => {
    shouldArm.value = true;
    setSessionState('armed');
    armDetection();
  }, [shouldArm, armDetection]);

  // Handle back/disconnect
  const handleBack = useCallback(async () => {
    await disconnect();
    router.replace('/race');
  }, [disconnect]);

  // Handle new race
  const handleNewRace = useCallback(() => {
    reset();
    isArmed.value = false;
    shouldArm.value = false;
    setSessionState('ready');
    setElapsedMs(0);
  }, [reset, isArmed, shouldArm]);

  // Format time display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${seconds}.${hundredths.toString().padStart(2, '0')}`;
  };

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={null}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={sessionState !== 'finished'}
        frameProcessor={frameProcessor}
        fps={format?.maxFps}
        videoStabilizationMode="off"
        exposure={0}
        pixelFormat="yuv"
        enableZoomGesture={false}
      />

      {/* Gate line overlay */}
      <View
        style={[styles.gateLine, { left: currentLineX.value * SCREEN_WIDTH }]}
      />

      {/* Header */}
      <SafeAreaView style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.roleIndicator}>
          <Ionicons
            name={role === 'start' ? 'flag' : 'trophy'}
            size={20}
            color={role === 'start' ? '#00C853' : '#FF9500'}
          />
          <Text style={styles.roleText}>
            {role === 'start' ? 'START' : 'FINISH'}
          </Text>
        </View>

        <View style={styles.syncIndicator}>
          <Text style={styles.syncText}>
            {syncStatus?.uncertaintyMs.toFixed(1)}ms
          </Text>
        </View>
      </SafeAreaView>

      {/* Main content based on state */}
      <View style={styles.content}>
        {sessionState === 'calibrating' && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Calibrating...</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(calibrationProgress / 45) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.statusSubtitle}>
              Keep the scene still ({calibrationProgress}/45)
            </Text>
          </View>
        )}

        {sessionState === 'ready' && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Ready</Text>
            <Text style={styles.statusSubtitle}>
              Position at {role === 'start' ? 'start' : 'finish'} line
            </Text>
            <TouchableOpacity style={styles.armButton} onPress={handleArm}>
              <Text style={styles.armButtonText}>ARM</Text>
            </TouchableOpacity>
          </View>
        )}

        {sessionState === 'armed' && (
          <View style={styles.statusCard}>
            <Ionicons name="radio-button-on" size={32} color="#F44336" />
            <Text style={styles.statusTitle}>Armed</Text>
            <Text style={styles.statusSubtitle}>Waiting for crossing...</Text>
            <View style={styles.rValueContainer}>
              <Text style={styles.rValueLabel}>R-Value</Text>
              <Text style={styles.rValueText}>{(rValue * 100).toFixed(1)}%</Text>
            </View>
          </View>
        )}

        {sessionState === 'running' && role === 'start' && (
          <View style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={48} color="#00C853" />
            <Text style={styles.statusTitle}>Start Sent</Text>
            <Text style={styles.statusSubtitle}>
              Waiting for finish phone...
            </Text>
          </View>
        )}

        {sessionState === 'running' && role === 'finish' && (
          <View style={styles.timerCard}>
            <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>
            <Text style={styles.timerLabel}>Running...</Text>
          </View>
        )}

        {sessionState === 'finished' && result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTime}>
              {(result.splitMs / 1000).toFixed(3)}s
            </Text>
            <Text style={styles.resultMs}>
              {result.splitMs.toFixed(1)} ms
            </Text>
            <View style={styles.resultUncertainty}>
              <Ionicons name="analytics" size={16} color="#888" />
              <Text style={styles.uncertaintyText}>
                {result.uncertaintyMs.toFixed(1)} ms uncertainty
              </Text>
            </View>
            <TouchableOpacity
              style={styles.newRaceButton}
              onPress={handleNewRace}
            >
              <Text style={styles.newRaceButtonText}>New Race</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  gateLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
  },
  roleIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  roleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  syncIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncText: {
    color: '#00C853',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Menlo',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  statusSubtitle: {
    color: '#888',
    fontSize: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginVertical: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  armButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  armButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  rValueContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  rValueLabel: {
    color: '#888',
    fontSize: 14,
  },
  rValueText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'Menlo',
  },
  timerCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  timerText: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '700',
    fontFamily: 'Menlo',
  },
  timerLabel: {
    color: '#888',
    fontSize: 18,
    marginTop: 8,
  },
  resultCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  resultTime: {
    color: '#00C853',
    fontSize: 56,
    fontWeight: '700',
    fontFamily: 'Menlo',
  },
  resultMs: {
    color: '#888',
    fontSize: 24,
    fontFamily: 'Menlo',
    marginTop: 8,
  },
  resultUncertainty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  uncertaintyText: {
    color: '#888',
    fontSize: 14,
  },
  newRaceButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
  },
  newRaceButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
