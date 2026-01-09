import { VisionCameraProxy, Frame } from 'react-native-vision-camera';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('slitScanMVP', {});

export interface ConfigureResult {
  success: boolean;
  lineX?: number;
  error?: string;
}

export interface CalibrationResult {
  success: boolean;
  complete: boolean;
  sampleCount: number;
  total?: number;
  frameWidth?: number;
  frameHeight?: number;
  bandTop?: number;
  bandBottom?: number;
  error?: string;
}

export interface ProcessResult {
  crossed: boolean;
  r: number;
  fps: number;
  frameDrops: number;
  state: 'idle' | 'calibrating' | 'armed' | 'triggered' | 'cooldown' | 'collecting';
  elapsedSeconds?: number;
  triggerPTS?: number;
  postTriggerCount?: number;
  postTriggerTotal?: number;
  bandTop?: number;
  bandBottom?: number;
  frameWidth?: number;
  frameHeight?: number;
  gatePixelX?: number;
  lineX?: number;
  longestRun?: number;
  bandHeight?: number;
  detectionPoints?: number[]; // Normalized Y positions (0-1) where motion detected
  error?: string;
}

export interface StatusResult {
  state: string;
  calibrated: boolean;
  calibrationCount: number;
  lineX: number;
  lastR: number;
  fps: number;
  frameDrops: number;
  lastCompositePath: string | null;
  triggerFramePath: string | null;
}

/**
 * Configure the gate line position
 */
export function configure(frame: Frame, lineX: number): ConfigureResult {
  'worklet';
  if (!plugin) {
    return { success: false, error: 'Plugin not loaded' };
  }
  return plugin.call(frame, { command: 'configure', lineX }) as ConfigureResult;
}

/**
 * Start calibration (initializes buffers, call once)
 */
export function startCalibration(frame: Frame): CalibrationResult {
  'worklet';
  if (!plugin) {
    return { success: false, complete: false, sampleCount: 0, error: 'Plugin not loaded' };
  }
  return plugin.call(frame, { command: 'startCalibration' }) as CalibrationResult;
}

/**
 * Add a calibration sample (call for each frame during calibration)
 */
export function calibrate(frame: Frame): CalibrationResult {
  'worklet';
  if (!plugin) {
    return { success: false, complete: false, sampleCount: 0, error: 'Plugin not loaded' };
  }
  return plugin.call(frame, { command: 'calibrate' }) as CalibrationResult;
}

/**
 * Arm the detector (call after calibration)
 */
export function arm(frame: Frame): { success: boolean; error?: string } {
  'worklet';
  if (!plugin) {
    return { success: false, error: 'Plugin not loaded' };
  }
  return plugin.call(frame, { command: 'arm' }) as { success: boolean; error?: string };
}

/**
 * Process a frame for crossing detection (call every frame when armed)
 */
export function process(frame: Frame): ProcessResult {
  'worklet';
  if (!plugin) {
    return { crossed: false, r: 0, fps: 0, frameDrops: 0, state: 'idle', error: 'Plugin not loaded' };
  }
  return plugin.call(frame, { command: 'process' }) as ProcessResult;
}

/**
 * Reset the detector (call to start over)
 */
export function reset(frame: Frame): { success: boolean } {
  'worklet';
  if (!plugin) {
    return { success: false };
  }
  return plugin.call(frame, { command: 'reset' }) as { success: boolean };
}

/**
 * Get current status
 */
export function getStatus(frame: Frame): StatusResult {
  'worklet';
  if (!plugin) {
    return {
      state: 'idle',
      calibrated: false,
      calibrationCount: 0,
      lineX: 0.5,
      lastR: 0,
      fps: 0,
      frameDrops: 0,
      lastCompositePath: null,
      triggerFramePath: null,
    };
  }
  return plugin.call(frame, { command: 'getStatus' }) as StatusResult;
}

export interface DebugFrameData {
  index: number;
  path: string;
  pts: number;
  r: number;
  triggersAt: string;
}

export interface ExportDebugFramesResult {
  success: boolean;
  error?: string;
  frameCount?: number;
  basePath?: string;
  frames?: DebugFrameData[];
  frameWidth?: number;
  frameHeight?: number;
  gateLineX?: number;
  gatePixelX?: number;
  triggerFrameIndex?: number;
}

/**
 * Export debug frames for scrubbing through
 */
export function exportDebugFrames(frame: Frame): ExportDebugFramesResult {
  'worklet';
  if (!plugin) {
    return { success: false, error: 'Plugin not loaded' };
  }
  return plugin.call(frame, { command: 'exportDebugFrames' }) as ExportDebugFramesResult;
}

/**
 * Get debug frame count
 */
export function getDebugFrameCount(frame: Frame): { count: number; maxFrames: number } {
  'worklet';
  if (!plugin) {
    return { count: 0, maxFrames: 0 };
  }
  return plugin.call(frame, { command: 'getDebugFrameCount' }) as { count: number; maxFrames: number };
}
