#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import <VisionCamera/Frame.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <Vision/Vision.h>
#import <vector>
#import <algorithm>
#import <numeric>

// Constants
static const int CALIBRATION_FRAMES = 45;
static const int SLIT_WIDTH = 3;
static const int FOREGROUND_THRESHOLD = 30;
static const float BAND_TOP_RATIO = 0.30f;
static const float BAND_BOTTOM_RATIO = 0.85f;
static const float TRIGGER_THRESHOLD_ON = 0.20f;
static const float TRIGGER_THRESHOLD_OFF = 0.10f;
static const int FPS_SAMPLE_COUNT = 30;
static const float PRE_TRIGGER_SECONDS = 0.5f;
static const float POST_TRIGGER_SECONDS = 0.5f;
static const int DEBUG_FRAME_BUFFER_SIZE = 360; // ~1.5s at 240fps

typedef NS_ENUM(NSInteger, DetectorState) {
  DetectorStateIdle,
  DetectorStateCalibrating,
  DetectorStateArmed,
  DetectorStateTriggered,
  DetectorStateCooldown
};

@interface SlitScanMVP : FrameProcessorPlugin
@end

@implementation SlitScanMVP {
  // Frame dimensions
  int _frameWidth;
  int _frameHeight;
  int _bandTop;
  int _bandBottom;
  int _bandHeight;

  // State
  DetectorState _state;
  int _calibrationCount;

  // Background model
  std::vector<float> _bgAccum;  // Accumulator for mean calculation
  std::vector<uint8_t> _bgStrip; // Final background strip

  // Gate line position (0-1)
  float _lineX;

  // Per-frame processing
  std::vector<uint8_t> _currentSlit;
  std::vector<uint8_t> _foreground;
  float _lastR;
  float _prevR;

  // Detection band tracking
  int _detectionStart;
  int _detectionEnd;

  // Timing
  double _sessionStartPTS;
  double _prevPTS;
  double _triggerPTS;
  double _triggerElapsed;

  // FPS tracking
  std::vector<double> _ptsHistory;
  int _ptsIndex;
  int _frameDrops;
  double _expectedFrameInterval;

  // Ring buffer for pre-trigger frames
  std::vector<std::vector<uint8_t>> _slitRingBuffer;
  std::vector<double> _ptsRingBuffer;
  int _ringHead;
  int _ringSize;

  // Post-trigger collection
  int _postTriggerFrames;
  int _postTriggerCount;
  BOOL _collectingPostTrigger;

  // Output paths
  NSString *_lastCompositePath;
  NSString *_triggerFramePath;

  // Trigger frame capture
  CVPixelBufferRef _triggerFrameBuffer;

  // Debug frame buffer
  std::vector<CVPixelBufferRef> _debugFrameBuffer;
  std::vector<double> _debugFramePTS;
  std::vector<float> _debugFrameR;
  int _debugFrameHead;
  int _debugFrameCount;
  BOOL _debugCaptureEnabled;
  int _debugTriggerFrameIndex;
  int _debugPostTriggerCount;
  BOOL _debugTriggered;

  // 2-frame confirmation
  int _aboveThresholdCount;
  int _emptyFrameCount;

  // Interpolation tracking
  float _rBeforeFirstCrossing;
  double _ptsBeforeFirstCrossing;
  float _rFirstCrossing;
  double _ptsFirstCrossing;
  int _debugFirstCrossingIndex;
}

- (instancetype)initWithProxy:(VisionCameraProxyHolder *)proxy withOptions:(NSDictionary *)options {
  self = [super initWithProxy:proxy withOptions:options];
  if (self) {
    _state = DetectorStateIdle;
    _lineX = 0.5f;
    _calibrationCount = 0;
    _lastR = 0;
    _prevR = 0;
    _frameDrops = 0;
    _ptsIndex = 0;
    _ringHead = 0;
    _ringSize = 0;
    _postTriggerCount = 0;
    _collectingPostTrigger = NO;
    _aboveThresholdCount = 0;
    _emptyFrameCount = 0;
    _debugFrameHead = 0;
    _debugFrameCount = 0;
    _debugCaptureEnabled = YES;
    _debugTriggerFrameIndex = -1;
    _debugPostTriggerCount = 0;
    _debugTriggered = NO;
    _triggerFrameBuffer = NULL;
    _rBeforeFirstCrossing = 0;
    _ptsBeforeFirstCrossing = 0;
    _rFirstCrossing = 0;
    _ptsFirstCrossing = 0;
    _debugFirstCrossingIndex = -1;
  }
  return self;
}

- (void)dealloc {
  if (_triggerFrameBuffer) {
    CVPixelBufferRelease(_triggerFrameBuffer);
    _triggerFrameBuffer = NULL;
  }
  for (CVPixelBufferRef buffer : _debugFrameBuffer) {
    if (buffer) {
      CVPixelBufferRelease(buffer);
    }
  }
  _debugFrameBuffer.clear();
}

- (id)callback:(Frame *)frame withArguments:(NSDictionary *)arguments {
  NSString *command = arguments[@"command"];

  if ([command isEqualToString:@"configure"]) {
    return [self handleConfigure:arguments];
  } else if ([command isEqualToString:@"startCalibration"]) {
    return [self handleStartCalibration:frame];
  } else if ([command isEqualToString:@"calibrate"]) {
    return [self handleCalibrate:frame];
  } else if ([command isEqualToString:@"arm"]) {
    return [self handleArm:frame];
  } else if ([command isEqualToString:@"process"]) {
    return [self handleProcess:frame];
  } else if ([command isEqualToString:@"reset"]) {
    return [self handleReset];
  } else if ([command isEqualToString:@"getStatus"]) {
    return [self getStatus];
  } else if ([command isEqualToString:@"exportDebugFrames"]) {
    return [self exportDebugFrames:frame];
  }

  return @{@"success": @NO, @"error": @"Unknown command"};
}

- (NSDictionary *)handleConfigure:(NSDictionary *)arguments {
  NSNumber *lineXNum = arguments[@"lineX"];
  if (lineXNum) {
    _lineX = fmaxf(0.1f, fminf(0.9f, [lineXNum floatValue]));
  }
  return @{@"success": @YES, @"lineX": @(_lineX)};
}

- (NSDictionary *)handleStartCalibration:(Frame *)frame {
  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer);
  _frameWidth = (int)CVPixelBufferGetWidth(pixelBuffer);
  _frameHeight = (int)CVPixelBufferGetHeight(pixelBuffer);

  _bandTop = (int)(_frameHeight * BAND_TOP_RATIO);
  _bandBottom = (int)(_frameHeight * BAND_BOTTOM_RATIO);
  _bandHeight = _bandBottom - _bandTop;

  // Initialize buffers
  _bgAccum.assign(_bandHeight, 0.0f);
  _bgStrip.resize(_bandHeight);
  _currentSlit.resize(_bandHeight);
  _foreground.resize(_bandHeight);

  _calibrationCount = 0;
  _state = DetectorStateCalibrating;

  // Initialize ring buffer for ~0.5s pre-trigger at 240fps
  int ringCapacity = (int)(PRE_TRIGGER_SECONDS * 240);
  _slitRingBuffer.resize(ringCapacity);
  _ptsRingBuffer.resize(ringCapacity);
  for (auto &slit : _slitRingBuffer) {
    slit.resize(_bandHeight);
  }
  _ringHead = 0;
  _ringSize = 0;

  // Initialize FPS tracking
  _ptsHistory.resize(FPS_SAMPLE_COUNT, 0);
  _ptsIndex = 0;
  _sessionStartPTS = -1;
  _prevPTS = -1;

  // Initialize debug frame buffer
  _debugFrameBuffer.resize(DEBUG_FRAME_BUFFER_SIZE, NULL);
  _debugFramePTS.resize(DEBUG_FRAME_BUFFER_SIZE, 0);
  _debugFrameR.resize(DEBUG_FRAME_BUFFER_SIZE, 0);
  _debugFrameHead = 0;
  _debugFrameCount = 0;
  _debugCaptureEnabled = YES;
  _debugTriggerFrameIndex = -1;
  _debugTriggered = NO;

  return @{
    @"success": @YES,
    @"complete": @NO,
    @"sampleCount": @0,
    @"frameWidth": @(_frameWidth),
    @"frameHeight": @(_frameHeight),
    @"bandTop": @(_bandTop),
    @"bandBottom": @(_bandBottom)
  };
}

- (NSDictionary *)handleCalibrate:(Frame *)frame {
  if (_state != DetectorStateCalibrating) {
    return @{@"success": @NO, @"complete": @NO, @"sampleCount": @0, @"error": @"Not calibrating"};
  }

  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer);
  CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  uint8_t *baseAddress = (uint8_t *)CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0);
  size_t bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0);

  [self extractSlit:baseAddress bytesPerRow:bytesPerRow into:_currentSlit.data()];

  CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  // Accumulate for mean calculation
  for (int i = 0; i < _bandHeight; i++) {
    _bgAccum[i] += _currentSlit[i];
  }

  _calibrationCount++;

  BOOL complete = (_calibrationCount >= CALIBRATION_FRAMES);

  if (complete) {
    // Compute mean background
    for (int i = 0; i < _bandHeight; i++) {
      _bgStrip[i] = (uint8_t)(_bgAccum[i] / _calibrationCount);
    }
    _state = DetectorStateIdle; // Ready to arm
  }

  return @{
    @"success": @YES,
    @"complete": @(complete),
    @"sampleCount": @(_calibrationCount),
    @"total": @(CALIBRATION_FRAMES),
    @"frameWidth": @(_frameWidth),
    @"frameHeight": @(_frameHeight),
    @"bandTop": @(_bandTop),
    @"bandBottom": @(_bandBottom)
  };
}

- (NSDictionary *)handleArm:(Frame *)frame {
  if (_bgStrip.empty()) {
    return @{@"success": @NO, @"error": @"Not calibrated"};
  }

  _state = DetectorStateArmed;
  _aboveThresholdCount = 0;
  _emptyFrameCount = 0;
  _lastR = 0;
  _prevR = 0;
  _collectingPostTrigger = NO;
  _postTriggerCount = 0;
  _ringHead = 0;
  _ringSize = 0;
  _debugTriggered = NO;
  _debugTriggerFrameIndex = -1;
  _rBeforeFirstCrossing = 0;
  _ptsBeforeFirstCrossing = 0;
  _rFirstCrossing = 0;
  _ptsFirstCrossing = 0;
  _debugFirstCrossingIndex = -1;

  // Get session start time
  CMTime pts = CMSampleBufferGetPresentationTimeStamp(frame.buffer);
  _sessionStartPTS = CMTimeGetSeconds(pts);
  _prevPTS = _sessionStartPTS;

  // Reset FPS tracking
  std::fill(_ptsHistory.begin(), _ptsHistory.end(), 0.0);
  _ptsIndex = 0;
  _frameDrops = 0;
  _expectedFrameInterval = 1.0 / 240.0;

  return @{@"success": @YES};
}

- (NSDictionary *)handleProcess:(Frame *)frame {
  if (_state != DetectorStateArmed && _state != DetectorStateTriggered && _state != DetectorStateCooldown) {
    return @{
      @"crossed": @NO,
      @"r": @0,
      @"fps": @0,
      @"frameDrops": @0,
      @"state": [self stateString]
    };
  }

  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer);
  CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  uint8_t *baseAddress = (uint8_t *)CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0);
  size_t bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0);

  [self extractSlit:baseAddress bytesPerRow:bytesPerRow into:_currentSlit.data()];

  CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);

  // Get PTS
  CMTime pts = CMSampleBufferGetPresentationTimeStamp(frame.buffer);
  double ptsSeconds = CMTimeGetSeconds(pts);

  // Update FPS tracking
  [self updateFPSTracking:ptsSeconds];

  // Compute foreground mask
  [self computeForeground];

  // Find longest contiguous run in detection band
  int longestRun = 0;
  int currentRun = 0;
  int runStart = 0;
  int bestStart = 0;
  int bestEnd = 0;

  for (int i = 0; i < _bandHeight; i++) {
    if (_foreground[i]) {
      if (currentRun == 0) {
        runStart = i;
      }
      currentRun++;
    } else {
      if (currentRun > longestRun) {
        longestRun = currentRun;
        bestStart = runStart;
        bestEnd = runStart + currentRun;
      }
      currentRun = 0;
    }
  }
  // Check final run
  if (currentRun > longestRun) {
    longestRun = currentRun;
    bestStart = runStart;
    bestEnd = runStart + currentRun;
  }

  _detectionStart = bestStart;
  _detectionEnd = bestEnd;

  // Compute r value with minimum run filter
  int minRun = MAX(60, (int)(0.15f * _bandHeight));
  float r = 0;
  if (longestRun >= minRun) {
    r = (float)longestRun / (float)_bandHeight;
  }

  // Store in ring buffer (pre-trigger frames)
  std::copy(_currentSlit.begin(), _currentSlit.end(), _slitRingBuffer[_ringHead].begin());
  _ptsRingBuffer[_ringHead] = ptsSeconds;
  _ringHead = (_ringHead + 1) % _slitRingBuffer.size();
  if (_ringSize < (int)_slitRingBuffer.size()) {
    _ringSize++;
  }

  // Capture debug frame
  [self captureDebugFrame:pixelBuffer pts:ptsSeconds r:r skipAllowed:NO];

  BOOL crossed = NO;
  double elapsedSeconds = ptsSeconds - _sessionStartPTS;

  // Detection logic with 2-frame confirmation
  if (_state == DetectorStateArmed) {
    if (r >= TRIGGER_THRESHOLD_ON) {
      // Track first crossing for interpolation
      if (_aboveThresholdCount == 0) {
        _rBeforeFirstCrossing = _prevR;
        _ptsBeforeFirstCrossing = _prevPTS;
        _rFirstCrossing = r;
        _ptsFirstCrossing = ptsSeconds;
        _debugFirstCrossingIndex = (_debugFrameHead - 1 + DEBUG_FRAME_BUFFER_SIZE) % DEBUG_FRAME_BUFFER_SIZE;
      }
      _aboveThresholdCount++;

      // 2-frame confirmation: trigger on second consecutive frame
      if (_aboveThresholdCount == 2) {
        crossed = YES;
        _state = DetectorStateTriggered;

        // Interpolate trigger time between previous frame and first crossing
        // Linear interpolation: find where r crossed TRIGGER_THRESHOLD_ON
        float r0 = _rBeforeFirstCrossing;
        float r1 = _rFirstCrossing;
        double t0 = _ptsBeforeFirstCrossing;
        double t1 = _ptsFirstCrossing;

        if (r1 > r0 && r1 > TRIGGER_THRESHOLD_ON) {
          float alpha = (TRIGGER_THRESHOLD_ON - r0) / (r1 - r0);
          alpha = fmaxf(0, fminf(1, alpha));
          _triggerPTS = t0 + alpha * (t1 - t0);
        } else {
          _triggerPTS = _ptsFirstCrossing;
        }

        _triggerElapsed = _triggerPTS - _sessionStartPTS;
        _debugTriggered = YES;
        _debugTriggerFrameIndex = _debugFirstCrossingIndex;

        // Start post-trigger collection
        _collectingPostTrigger = YES;
        _postTriggerFrames = (int)(POST_TRIGGER_SECONDS * [self getCurrentFPS]);
        _postTriggerCount = 0;

        // Capture trigger frame
        [self captureTriggerFrame:pixelBuffer];
      }
    } else {
      _aboveThresholdCount = 0;
    }
  } else if (_state == DetectorStateTriggered) {
    // Collecting post-trigger frames
    if (_collectingPostTrigger) {
      _postTriggerCount++;
      _debugPostTriggerCount = _postTriggerCount;

      if (_postTriggerCount >= _postTriggerFrames) {
        _collectingPostTrigger = NO;
        _state = DetectorStateCooldown;

        // Export composite
        [self exportComposite:frame];
      }
    }
  } else if (_state == DetectorStateCooldown) {
    // Wait for r to drop below TRIGGER_THRESHOLD_OFF before rearming
    if (r < TRIGGER_THRESHOLD_OFF) {
      _emptyFrameCount++;
      if (_emptyFrameCount >= 5) {
        _state = DetectorStateArmed;
        _aboveThresholdCount = 0;
        _emptyFrameCount = 0;
      }
    } else {
      _emptyFrameCount = 0;
    }
  }

  _prevR = _lastR;
  _lastR = r;
  _prevPTS = ptsSeconds;

  // Build response
  NSMutableArray *detectionPoints = [NSMutableArray array];
  for (int i = 0; i < _bandHeight; i++) {
    if (_foreground[i]) {
      float normalizedY = (float)(i + _bandTop) / (float)_frameHeight;
      [detectionPoints addObject:@(normalizedY)];
    }
  }

  NSMutableDictionary *result = [@{
    @"crossed": @(crossed),
    @"r": @(r),
    @"fps": @([self getCurrentFPS]),
    @"frameDrops": @(_frameDrops),
    @"state": [self stateString],
    @"elapsedSeconds": @(elapsedSeconds),
    @"bandTop": @(_bandTop),
    @"bandBottom": @(_bandBottom),
    @"frameWidth": @(_frameWidth),
    @"frameHeight": @(_frameHeight),
    @"gatePixelX": @((int)(_lineX * _frameWidth)),
    @"lineX": @(_lineX),
    @"longestRun": @(longestRun),
    @"bandHeight": @(_bandHeight),
    @"detectionPoints": detectionPoints
  } mutableCopy];

  if (crossed) {
    result[@"triggerPTS"] = @(_triggerPTS);
    result[@"ptsSeconds"] = @(ptsSeconds);

    // Get uptime nanos for network sync (monotonic clock, same as DispatchTime.now().uptimeNanoseconds in Swift)
    uint64_t uptimeNanos = clock_gettime_nsec_np(CLOCK_UPTIME_RAW);
    result[@"uptimeNanos"] = [NSString stringWithFormat:@"%llu", uptimeNanos];
  }

  if (_collectingPostTrigger) {
    result[@"postTriggerCount"] = @(_postTriggerCount);
    result[@"postTriggerTotal"] = @(_postTriggerFrames);
  }

  return result;
}

- (void)extractSlit:(uint8_t *)baseAddress bytesPerRow:(size_t)bytesPerRow into:(uint8_t *)output {
  int gateX = (int)(_lineX * _frameWidth);
  int startX = MAX(0, gateX - SLIT_WIDTH / 2);
  int endX = MIN(_frameWidth - 1, gateX + SLIT_WIDTH / 2);
  int slitWidth = endX - startX + 1;

  for (int y = 0; y < _bandHeight; y++) {
    int frameY = y + _bandTop;
    int sum = 0;
    for (int x = startX; x <= endX; x++) {
      sum += baseAddress[frameY * bytesPerRow + x];
    }
    output[y] = (uint8_t)(sum / slitWidth);
  }
}

- (void)computeForeground {
  for (int i = 0; i < _bandHeight; i++) {
    int diff = abs((int)_currentSlit[i] - (int)_bgStrip[i]);
    _foreground[i] = (diff >= FOREGROUND_THRESHOLD) ? 1 : 0;
  }
}

- (void)updateFPSTracking:(double)ptsSeconds {
  if (_prevPTS > 0) {
    double interval = ptsSeconds - _prevPTS;
    _ptsHistory[_ptsIndex] = interval;
    _ptsIndex = (_ptsIndex + 1) % FPS_SAMPLE_COUNT;

    // Detect frame drops (interval > 1.5x expected)
    if (interval > _expectedFrameInterval * 1.5) {
      _frameDrops++;
    }
  }
}

- (float)getCurrentFPS {
  double sum = 0;
  int count = 0;
  for (int i = 0; i < FPS_SAMPLE_COUNT; i++) {
    if (_ptsHistory[i] > 0) {
      sum += _ptsHistory[i];
      count++;
    }
  }
  if (count > 0 && sum > 0) {
    return (float)count / sum;
  }
  return 240.0f;
}

- (void)captureDebugFrame:(CVPixelBufferRef)pixelBuffer pts:(double)pts r:(float)r skipAllowed:(BOOL)skipAllowed {
  if (!_debugCaptureEnabled) return;

  // Release old buffer at this position
  if (_debugFrameBuffer[_debugFrameHead]) {
    CVPixelBufferRelease(_debugFrameBuffer[_debugFrameHead]);
  }

  // Retain new buffer
  CVPixelBufferRetain(pixelBuffer);
  _debugFrameBuffer[_debugFrameHead] = pixelBuffer;
  _debugFramePTS[_debugFrameHead] = pts;
  _debugFrameR[_debugFrameHead] = r;

  _debugFrameHead = (_debugFrameHead + 1) % DEBUG_FRAME_BUFFER_SIZE;
  if (_debugFrameCount < DEBUG_FRAME_BUFFER_SIZE) {
    _debugFrameCount++;
  }
}

- (void)captureTriggerFrame:(CVPixelBufferRef)pixelBuffer {
  if (_triggerFrameBuffer) {
    CVPixelBufferRelease(_triggerFrameBuffer);
  }
  CVPixelBufferRetain(pixelBuffer);
  _triggerFrameBuffer = pixelBuffer;
}

- (void)exportComposite:(Frame *)frame {
  // Build composite from ring buffer (pre + post trigger slits)
  int totalSlits = _ringSize + _postTriggerCount;
  if (totalSlits == 0) return;

  // Create grayscale image
  int compositeWidth = totalSlits;
  int compositeHeight = _bandHeight;

  std::vector<uint8_t> compositeData(compositeWidth * compositeHeight, 0);

  // Copy pre-trigger slits from ring buffer
  int ringStart = (_ringHead - _ringSize + (int)_slitRingBuffer.size()) % (int)_slitRingBuffer.size();
  for (int i = 0; i < _ringSize; i++) {
    int ringIdx = (ringStart + i) % (int)_slitRingBuffer.size();
    for (int y = 0; y < _bandHeight; y++) {
      compositeData[y * compositeWidth + i] = _slitRingBuffer[ringIdx][y];
    }
  }

  // Save composite to file
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceGray();
  CGContextRef context = CGBitmapContextCreate(
    compositeData.data(),
    compositeWidth,
    compositeHeight,
    8,
    compositeWidth,
    colorSpace,
    kCGImageAlphaNone
  );
  CGColorSpaceRelease(colorSpace);

  if (context) {
    CGImageRef image = CGBitmapContextCreateImage(context);

    NSString *tempDir = NSTemporaryDirectory();
    NSString *filename = [NSString stringWithFormat:@"composite_%.0f.png", [[NSDate date] timeIntervalSince1970] * 1000];
    NSString *path = [tempDir stringByAppendingPathComponent:filename];

    NSURL *url = [NSURL fileURLWithPath:path];
    CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
      (__bridge CFURLRef)url,
      (__bridge CFStringRef)UTTypePNG.identifier,
      1,
      NULL
    );

    if (destination) {
      CGImageDestinationAddImage(destination, image, NULL);
      CGImageDestinationFinalize(destination);
      CFRelease(destination);
      _lastCompositePath = path;
    }

    CGImageRelease(image);
    CGContextRelease(context);
  }
}

- (NSDictionary *)handleReset {
  _state = DetectorStateIdle;
  _calibrationCount = 0;
  _bgAccum.clear();
  _bgStrip.clear();
  _currentSlit.clear();
  _foreground.clear();
  _lastR = 0;
  _prevR = 0;
  _aboveThresholdCount = 0;
  _emptyFrameCount = 0;
  _ringHead = 0;
  _ringSize = 0;
  _collectingPostTrigger = NO;
  _postTriggerCount = 0;
  _lastCompositePath = nil;
  _triggerFramePath = nil;

  if (_triggerFrameBuffer) {
    CVPixelBufferRelease(_triggerFrameBuffer);
    _triggerFrameBuffer = NULL;
  }

  // Clear debug frames
  for (CVPixelBufferRef buffer : _debugFrameBuffer) {
    if (buffer) {
      CVPixelBufferRelease(buffer);
    }
  }
  _debugFrameBuffer.clear();
  _debugFramePTS.clear();
  _debugFrameR.clear();
  _debugFrameHead = 0;
  _debugFrameCount = 0;
  _debugTriggered = NO;
  _debugTriggerFrameIndex = -1;

  return @{@"success": @YES};
}

- (NSDictionary *)getStatus {
  return @{
    @"state": [self stateString],
    @"calibrated": @(!_bgStrip.empty()),
    @"calibrationCount": @(_calibrationCount),
    @"lineX": @(_lineX),
    @"lastR": @(_lastR),
    @"fps": @([self getCurrentFPS]),
    @"frameDrops": @(_frameDrops),
    @"lastCompositePath": _lastCompositePath ?: [NSNull null],
    @"triggerFramePath": _triggerFramePath ?: [NSNull null]
  };
}

- (NSDictionary *)exportDebugFrames:(Frame *)frame {
  if (_debugFrameCount == 0) {
    return @{@"success": @NO, @"error": @"No debug frames captured"};
  }

  NSString *tempDir = NSTemporaryDirectory();
  NSString *sessionDir = [NSString stringWithFormat:@"debug_frames_%.0f", [[NSDate date] timeIntervalSince1970] * 1000];
  NSString *basePath = [tempDir stringByAppendingPathComponent:sessionDir];

  [[NSFileManager defaultManager] createDirectoryAtPath:basePath
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];

  NSMutableArray *frames = [NSMutableArray array];

  int startIdx = (_debugFrameHead - _debugFrameCount + DEBUG_FRAME_BUFFER_SIZE) % DEBUG_FRAME_BUFFER_SIZE;

  for (int i = 0; i < _debugFrameCount; i++) {
    int bufIdx = (startIdx + i) % DEBUG_FRAME_BUFFER_SIZE;
    CVPixelBufferRef buffer = _debugFrameBuffer[bufIdx];

    if (!buffer) continue;

    NSString *filename = [NSString stringWithFormat:@"frame_%04d.png", i];
    NSString *framePath = [basePath stringByAppendingPathComponent:filename];

    // Export frame as PNG
    CIImage *ciImage = [CIImage imageWithCVPixelBuffer:buffer];
    CIContext *context = [CIContext context];
    NSURL *url = [NSURL fileURLWithPath:framePath];

    [context writePNGRepresentationOfImage:ciImage
                                     toURL:url
                                    format:kCIFormatRGBA8
                                colorSpace:CGColorSpaceCreateDeviceRGB()
                                   options:@{}
                                     error:nil];

    NSString *triggersAt = @"";
    if (_debugTriggered && bufIdx == _debugTriggerFrameIndex) {
      triggersAt = @"TRIGGER";
    }

    [frames addObject:@{
      @"index": @(i),
      @"path": framePath,
      @"pts": @(_debugFramePTS[bufIdx]),
      @"r": @(_debugFrameR[bufIdx]),
      @"triggersAt": triggersAt
    }];
  }

  return @{
    @"success": @YES,
    @"frameCount": @(_debugFrameCount),
    @"basePath": basePath,
    @"frames": frames,
    @"frameWidth": @(_frameWidth),
    @"frameHeight": @(_frameHeight),
    @"gateLineX": @(_lineX),
    @"gatePixelX": @((int)(_lineX * _frameWidth)),
    @"triggerFrameIndex": @(_debugTriggerFrameIndex >= 0 ? _debugTriggerFrameIndex : -1)
  };
}

- (NSString *)stateString {
  switch (_state) {
    case DetectorStateIdle: return @"idle";
    case DetectorStateCalibrating: return @"calibrating";
    case DetectorStateArmed: return @"armed";
    case DetectorStateTriggered: return @"triggered";
    case DetectorStateCooldown: return @"cooldown";
    default: return @"unknown";
  }
}

VISION_EXPORT_FRAME_PROCESSOR(SlitScanMVP, slitScanMVP)

@end
