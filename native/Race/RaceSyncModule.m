#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RaceSyncModule, NSObject)

RCT_EXTERN_METHOD(getUptimeNanos)

RCT_EXTERN_METHOD(handleSyncPing:(NSString *)t1)

RCT_EXTERN_METHOD(addSyncSample:(NSString *)t1
                  t2:(NSString *)t2
                  t3:(NSString *)t3
                  t4:(NSString *)t4)

RCT_EXTERN_METHOD(resetSync)

RCT_EXTERN_METHOD(getSyncStatus)

RCT_EXTERN_METHOD(convertRemoteToLocal:(NSString *)remoteNanos
                  offsetNanos:(NSString *)offsetNanos)

@end
