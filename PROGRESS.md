# PROGRESS.md — Phase 1 Build Log (React Native + Expo)

**Platform:** React Native + Expo, Windows-friendly  
**Status:** Setup complete, ready for Slice 1

---

## Setup: React Native + Expo Configuration

**Date:** 2026-09-12  
**Status:** ✅ Complete and committed

### What Was Built

**Package Configuration:**
- `package.json`: All dependencies
  - React Native 0.75, Expo 51, TypeScript
  - Camera: expo-camera, expo-image-picker, react-native-vision-camera
  - Persistence: expo-sqlite, AsyncStorage
  - Navigation: React Navigation
  - State: Zustand + zustand-persist
  - Haptics, image manipulation, sensors

- `app.json`: Expo config with permissions
  - iOS: camera, photo library, location
  - Android: same permissions
  - Auto-linking for plugins

- `tsconfig.json`: Strict mode, path aliases
  - @components, @hooks, @types, @utils, @services, @constants

**Design System (Constants):**
- `src/constants/theme.ts`: All tokens from DESIGN.md
  - Colors: primary palette (leaf, cream, glass, soil)
  - Semantic colors (confident, probably, notSure, toxicity)
  - Dark mode variants
  - Spacing grid (8pt base)
  - Typography (sizes, weights, tracking)
  - Motion (springs, durations)
  - Haptics (feedback types)

**Domain Types:**
- `src/types/plant.ts`: All plant entities
  - Species, CareGuide, SavedPlant, PlantPhoto, WaterLog
  - Enums: ConfidenceBand, LightLevel, WaterFrequency, SoilType, ToxicityLevel
  - Helper functions for display names, toxicity text

- `src/types/errors.ts`: Error system
  - VerdureErrorType enum (all cases)
  - VerdureError interface (type, message, description, recovery)
  - createError() factory
  - isRecoverable() helper
  - Specific, actionable error messages (no apologies)

**Navigation & Home:**
- `app/_layout.tsx`: Root layout with gesture handler, safe area, navigation
- `app/index.tsx`: Welcome screen
  - Shows Verdure title and promise
  - Scan Plant button (navigates to /scan)
  - My Plants button (placeholder)
  - Uses design tokens throughout

### Decisions Made

1. **Expo Go for development:** Instant testing on iPhone, no builds needed
2. **TypeScript strict:** Compiler catches errors before runtime
3. **Design tokens as constants:** Imported everywhere, no magic values
4. **Error system defined first:** Honest error messages before UI
5. **Navigation structure in place:** Ready for all screens

### Code Quality

- TypeScript strict mode enforced
- All colors/spacing/typography as constants
- Error messages specific and actionable
- Zero hardcoded values
- Accessible from day one (safe area, proper spacing)

### How to Run (Windows)

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Open Expo Go on your iPhone
# Scan QR code from terminal
```

### What's Ready for Slice 1

- ✅ Expo project runs on iPhone via Expo Go
- ✅ All design tokens available
- ✅ All domain types defined
- ✅ Error types with honest messages
- ✅ Navigation scaffolding
- ✅ Home screen rendering

### Next Slice

**Slice 1: Components & Persistence**
- Reusable buttons, cards, badges (enforcing design system)
- Database layer (SQLite, AsyncStorage)
- CRUD operations for plants
- Tests for data access

**Slice 2: Camera Capture**
- Camera preview (expo-camera)
- Pre-flight checks (blur, plant detection, light)
- Photo capture with feedback

**Slice 3: Identification**
- Backend proxy client
- Kindwise integration
- Confidence mapping

And so on...
