#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RaceSessionModule, NSObject)

RCT_EXTERN_METHOD(setRole:(NSString *)role)

RCT_EXTERN_METHOD(getRole)

RCT_EXTERN_METHOD(setSessionId:(NSString *)sessionId)

RCT_EXTERN_METHOD(setClockOffset:(NSString *)offsetNanos)

RCT_EXTERN_METHOD(convertPtsToUptime:(double)tCrossPtsSeconds
                  ptsNowSeconds:(double)ptsNowSeconds
                  uptimeNowNanos:(NSString *)uptimeNowNanos)

RCT_EXTERN_METHOD(recordLocalStart:(double)tCrossPtsSeconds
                  ptsNowSeconds:(double)ptsNowSeconds
                  uptimeNowNanos:(NSString *)uptimeNowNanos)

RCT_EXTERN_METHOD(recordRemoteStart:(NSString *)tStartRemoteNanos)

RCT_EXTERN_METHOD(computeSplit:(double)tCrossPtsSeconds
                  ptsNowSeconds:(double)ptsNowSeconds
                  uptimeNowNanos:(NSString *)uptimeNowNanos)

RCT_EXTERN_METHOD(reset)

RCT_EXTERN_METHOD(fullReset)

RCT_EXTERN_METHOD(getStatus)

@end
