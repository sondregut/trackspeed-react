# SprintTimerMVP - Claude Code Notes

## Development Commands

### Run app with logs on device
```bash
npx expo run:ios --device "Sondre (2)"
```

### Build only (no logs)
```bash
cd ios && xcodebuild -workspace SprintTimerMVP.xcworkspace -scheme SprintTimerMVP -configuration Debug -destination "name=Sondre (2)" -derivedDataPath build
```

### Install and launch (no logs)
```bash
xcrun devicectl device install app --device "Sondre (2)" ios/build/Build/Products/Debug-iphoneos/SprintTimerMVP.app && xcrun devicectl device process launch --device "Sondre (2)" com.sprinttimer.mvp
```

### Pod install
```bash
cd ios && pod install
```

## Key Files

- Native frame processor: `ios/SprintTimerMVP/FrameProcessors/SlitScanMVP.mm`
- Setup screen: `src/screens/SetupScreen.tsx`
- Debug frame viewer: `src/screens/DebugFrameViewer.tsx`
- Types: `src/types.ts`

## Detection Parameters (SlitScanMVP.mm)

- `TRIGGER_THRESHOLD_ON = 0.20` (20% r-value triggers)
- `TRIGGER_THRESHOLD_OFF = 0.10` (10% r-value rearms)
- 2-frame confirmation required before trigger
- Detection band: 30% - 85% of screen height
