import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { CaptureStats } from '../types';

interface Props {
  stats: CaptureStats;
  onSave: () => void;
  onNewRun: () => void;
  onBack: () => void;
  onViewFrames?: () => void;
}

function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return `${seconds.toFixed(3)}s`;
}

function GlassButton({
  onPress,
  title,
  variant = 'primary',
}: {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
}) {
  const isGlassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const buttonStyles = [
    styles.button,
    variant === 'primary' && styles.buttonPrimary,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'tertiary' && styles.buttonTertiary,
  ];

  const textStyles = [
    styles.buttonText,
    variant === 'tertiary' && styles.buttonTextTertiary,
  ];

  if (isGlassAvailable && variant !== 'tertiary') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <GlassView style={buttonStyles}>
          <Text style={textStyles}>{title}</Text>
        </GlassView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[buttonStyles, styles.buttonFallback]} onPress={onPress} activeOpacity={0.8}>
      <Text style={textStyles}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function ResultsModal({ stats, onSave, onNewRun, onBack, onViewFrames }: Props) {
  const insets = useSafeAreaInsets();
  const isGlassAvailable = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const milliseconds = stats.elapsedSeconds * 1000;

  const content = (
    <>
      {/* Close button */}
      <TouchableOpacity style={styles.closeButton} onPress={onBack}>
        <Text style={styles.closeButtonText}>Back</Text>
      </TouchableOpacity>

      {/* Main time display */}
      <View style={styles.timeContainer}>
        <Text style={styles.timeLabel}>Sprint Time</Text>
        <Text style={styles.timeValue}>{formatTime(stats.elapsedSeconds)}</Text>
        <Text style={styles.timeMs}>{milliseconds.toFixed(1)} ms</Text>
      </View>

      {/* Trigger frame - the crossing moment */}
      {stats.triggerFramePath && (
        <View style={styles.compositeContainer}>
          <View style={styles.frameWrapper}>
            <Image
              source={{ uri: `file://${stats.triggerFramePath}` }}
              style={styles.triggerFrame}
              resizeMode="contain"
            />
            {/* Gate line overlay */}
            <View style={[styles.gateLine, { left: `${stats.gateLinePosition * 100}%` }]} />
          </View>
          <Text style={styles.compositeLabel}>Crossing Frame</Text>
        </View>
      )}

      {/* View All Frames button */}
      {onViewFrames && (
        <TouchableOpacity style={styles.viewFramesButton} onPress={onViewFrames}>
          <Text style={styles.viewFramesText}>View All Frames</Text>
        </TouchableOpacity>
      )}

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.actualFps.toFixed(0)}</Text>
          <Text style={styles.statLabel}>FPS</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.frameDrops}</Text>
          <Text style={styles.statLabel}>Drops</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(stats.gateLinePosition * 100).toFixed(0)}%</Text>
          <Text style={styles.statLabel}>Gate</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        <GlassButton onPress={onSave} title="Save & View Details" variant="primary" />
        <GlassButton onPress={onNewRun} title="New Run" variant="secondary" />
      </View>
    </>
  );

  // Use GlassView as the modal background on iOS 26+
  if (isGlassAvailable) {
    return (
      <View style={styles.overlay}>
        <GlassView style={[styles.modal, { paddingTop: insets.top + 20 }]}>
          {content}
        </GlassView>
      </View>
    );
  }

  // Fallback for older iOS / Android
  return (
    <View style={styles.overlay}>
      <View style={[styles.modal, styles.modalFallback, { paddingTop: insets.top + 20 }]}>
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    minHeight: '70%',
  },
  modalFallback: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 0,
  },
  closeButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timeLabel: {
    color: '#888',
    fontSize: 15,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeValue: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeMs: {
    color: '#888',
    fontSize: 17,
    marginTop: 4,
  },
  compositeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  frameWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#222',
    overflow: 'hidden',
    position: 'relative',
  },
  triggerFrame: {
    width: '100%',
    height: '100%',
  },
  gateLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ff0000',
  },
  compositeLabel: {
    color: '#666',
    fontSize: 13,
    marginTop: 8,
  },
  viewFramesButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  viewFramesText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  stat: {
    alignItems: 'center',
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
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  button: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  buttonPrimary: {
    // Glass will provide the background
  },
  buttonSecondary: {
    // Glass will provide the background
  },
  buttonTertiary: {
    backgroundColor: 'transparent',
  },
  buttonFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonTextTertiary: {
    color: '#888',
  },
});
