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

  // Saved debug frames (for history viewing)
  savedDebugFrames?: SavedDebugFrame[];
}

export interface SavedDebugFrame {
  path: string;
  pts: number;
  r: number;
  index: number;
}

export type TimingMode = 'photo-finish' | 'sound-start' | 'flying-start' | 'multi-gate';

export interface TimingSession {
  id: string;
  mode: TimingMode;
  stats: CaptureStats;
  timestamp: number;
  notes?: string;
}

export interface DebugFrameData {
  path: string;
  pts: number;
  r: number;
  index: number;
}
