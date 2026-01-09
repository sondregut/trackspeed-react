import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import type { DebugFrameData } from '../native/SlitScan';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  frames: DebugFrameData[];
  frameWidth: number;
  frameHeight: number;
  gateLineX: number;
  gatePixelX: number;
  triggerFrameIndex?: number;
  onClose: () => void;
  onSelectCrossing?: (frameIndex: number, manualX?: number) => void;
}

export default function DebugFrameViewer({
  frames,
  frameWidth,
  frameHeight,
  gateLineX,
  gatePixelX,
  triggerFrameIndex: providedTriggerIndex,
  onClose,
  onSelectCrossing,
}: Props) {
  // Find the trigger frame - use provided index or find first frame where r >= 0.20
  const triggerFrameIndex = providedTriggerIndex !== undefined && providedTriggerIndex >= 0
    ? providedTriggerIndex
    : frames.findIndex(f => f.r >= 0.20);

  // Start at trigger frame if available, otherwise start at 0
  const initialIndex = triggerFrameIndex >= 0 ? triggerFrameIndex : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [manualLineX, setManualLineX] = useState(gateLineX);
  const [showAllRValues, setShowAllRValues] = useState(false);

  const currentFrame = frames[currentIndex];
  const displayWidth = SCREEN_WIDTH - 40;
  const displayHeight = (displayWidth / frameWidth) * frameHeight;

  const handlePrev = () => {
    setCurrentIndex(i => Math.max(0, i - 1));
  };

  const handleNext = () => {
    setCurrentIndex(i => Math.min(frames.length - 1, i + 1));
  };

  const handleMarkCrossing = () => {
    if (onSelectCrossing) {
      onSelectCrossing(currentIndex, manualLineX);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Frame Viewer</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Frame display */}
        <View style={styles.frameContainer}>
          <View style={[
            styles.imageWrapper,
            { width: displayWidth, height: displayHeight },
            { borderColor: currentIndex === triggerFrameIndex ? '#ff0' : 'transparent' }
          ]}>
            {currentFrame && (
              <>
                <Image
                  source={{ uri: `file://${currentFrame.path}` }}
                  style={{ width: displayWidth, height: displayHeight }}
                  resizeMode="contain"
                />
                {/* Original gate line */}
                <View
                  style={[
                    styles.gateLine,
                    { left: gateLineX * displayWidth },
                  ]}
                />
                {/* Manual gate line (draggable) */}
                <View
                  style={[
                    styles.manualGateLine,
                    { left: manualLineX * displayWidth },
                  ]}
                />
                {/* Trigger indicator - positioned absolutely to avoid layout shift */}
                {currentIndex === triggerFrameIndex && (
                  <View style={styles.triggerOverlay}>
                    <Text style={styles.triggerOverlayText}>TRIGGER</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Frame info */}
          <View style={styles.frameInfo}>
            <Text style={styles.frameText}>
              Frame {currentIndex + 1} / {frames.length}
              {currentIndex === triggerFrameIndex && ' [TRIGGER]'}
            </Text>
            <Text style={styles.frameText}>
              r-value: {currentFrame?.r.toFixed(3)}
              <Text style={currentFrame?.r >= 0.20 ? styles.triggerYes : styles.triggerNo}>
                {currentFrame?.r >= 0.20 ? ' (triggered)' : ''}
              </Text>
            </Text>
            <Text style={styles.frameText}>
              PTS: {currentFrame?.pts.toFixed(3)}s
            </Text>
          </View>
        </View>

        {/* Frame scrubber */}
        <View style={styles.scrubberContainer}>
          <TouchableOpacity onPress={handlePrev} style={styles.navButton}>
            <Text style={styles.navButtonText}>{'<<'} Prev</Text>
          </TouchableOpacity>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={frames.length - 1}
            step={1}
            value={currentIndex}
            onValueChange={setCurrentIndex}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#333"
            thumbTintColor="#fff"
          />

          <TouchableOpacity onPress={handleNext} style={styles.navButton}>
            <Text style={styles.navButtonText}>Next {'>>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Manual gate line adjuster */}
        <View style={styles.adjustSection}>
          <Text style={styles.sectionTitle}>Adjust Gate Line Position</Text>
          <Text style={styles.helpText}>
            Red line = original gate position. Green line = manual adjustment.
          </Text>
          <Slider
            style={styles.gateSlider}
            minimumValue={0}
            maximumValue={1}
            value={manualLineX}
            onValueChange={setManualLineX}
            minimumTrackTintColor="#00ff00"
            maximumTrackTintColor="#333"
            thumbTintColor="#00ff00"
          />
          <Text style={styles.gatePositionText}>
            Original: {(gateLineX * 100).toFixed(1)}% | Manual: {(manualLineX * 100).toFixed(1)}%
          </Text>
        </View>

        {/* Mark crossing button */}
        <TouchableOpacity style={styles.markButton} onPress={handleMarkCrossing}>
          <Text style={styles.markButtonText}>
            Mark This Frame as Chest Crossing
          </Text>
        </TouchableOpacity>

        {/* R-value graph */}
        <View style={styles.graphContainer}>
          <Text style={styles.sectionTitle}>R-Value Over Time</Text>
          <TouchableOpacity onPress={() => setShowAllRValues(!showAllRValues)}>
            <Text style={styles.toggleText}>
              {showAllRValues ? 'Hide Details' : 'Show All Values'}
            </Text>
          </TouchableOpacity>

          {/* Simple visual r-value representation */}
          <View style={styles.rValueGraph}>
            {frames.map((frame, idx) => {
              const height = Math.min(100, frame.r * 100) * 0.8;
              const isCurrentFrame = idx === currentIndex;
              const isTriggerFrame = idx === triggerFrameIndex;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.rValueBar,
                    {
                      height: Math.max(2, height),
                      backgroundColor: frame.r >= 0.20 ? '#ff4444' : '#44ff44',
                      opacity: isCurrentFrame ? 1 : 0.5,
                      borderColor: isTriggerFrame ? '#ffff00' : 'transparent',
                      borderWidth: isTriggerFrame ? 2 : 0,
                    },
                  ]}
                  onPress={() => setCurrentIndex(idx)}
                />
              );
            })}
          </View>
          <View style={styles.thresholdLine}>
            <Text style={styles.thresholdText}>20% threshold</Text>
          </View>

          {showAllRValues && (
            <ScrollView style={styles.rValueList} horizontal>
              {frames.map((frame, idx) => (
                <Text
                  key={idx}
                  style={[
                    styles.rValueItem,
                    idx === currentIndex && styles.rValueItemCurrent,
                    frame.r >= 0.20 && styles.rValueItemTrigger,
                  ]}
                >
                  {idx}: {frame.r.toFixed(3)}
                </Text>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Debug info */}
        <View style={styles.debugSection}>
          <Text style={styles.sectionTitle}>Debug Info</Text>
          <Text style={styles.debugText}>Frame dimensions: {frameWidth}x{frameHeight}</Text>
          <Text style={styles.debugText}>Gate pixel X: {gatePixelX}</Text>
          <Text style={styles.debugText}>Trigger frame index: {triggerFrameIndex >= 0 ? triggerFrameIndex : 'None'}</Text>
          <Text style={styles.debugText}>Total frames: {frames.length}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  frameContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 3, // Always have border for consistent sizing
  },
  triggerOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  triggerOverlayText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  gateLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ff0000',
  },
  manualGateLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#00ff00',
  },
  frameInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  frameText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  triggerIndicator: {
    color: '#ff4444',
    fontWeight: '700',
  },
  triggerYes: {
    color: '#ff4444',
  },
  triggerNo: {
    color: '#44ff44',
  },
  scrubberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  slider: {
    flex: 1,
    marginHorizontal: 10,
  },
  adjustSection: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  gateSlider: {
    width: '100%',
  },
  gatePositionText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  markButton: {
    backgroundColor: '#ff6600',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  markButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  graphContainer: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  toggleText: {
    color: '#007AFF',
    fontSize: 14,
    marginBottom: 12,
  },
  rValueGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 1,
  },
  rValueBar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1,
  },
  thresholdLine: {
    borderTopWidth: 1,
    borderTopColor: '#fff',
    marginTop: -8,
    paddingTop: 4,
  },
  thresholdText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'right',
  },
  rValueList: {
    marginTop: 12,
    maxHeight: 40,
  },
  rValueItem: {
    color: '#888',
    fontSize: 10,
    fontFamily: 'monospace',
    marginRight: 8,
  },
  rValueItemCurrent: {
    color: '#fff',
    fontWeight: '700',
  },
  rValueItemTrigger: {
    color: '#ff4444',
  },
  debugSection: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  debugText: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
