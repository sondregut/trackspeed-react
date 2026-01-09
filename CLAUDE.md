# SprintTimerMVP

## IMPORTANT

**NEVER build or run the app.** The user will ALWAYS build and run manually. Only make code changes.

## Build & Run (User runs this)

```bash
npm install && npx expo prebuild --platform ios --clean && npx expo run:ios --device "Sondre (2)"
```

## Key Files

- Native frame processor: `native/FrameProcessors/SlitScanMVP.mm` (source of truth)
- Setup screen: `src/screens/SetupScreen.tsx`
- Types: `src/types.ts`

## Detection Parameters (SlitScanMVP.mm)

- `TRIGGER_THRESHOLD_ON = 0.20` (20% r-value triggers)
- `TRIGGER_THRESHOLD_OFF = 0.10` (10% r-value rearms)
- 2-frame confirmation required before trigger
- Detection band: 30% - 85% of screen height
