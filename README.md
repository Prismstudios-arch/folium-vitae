# Verdure — Honest Plant Identification App

An iOS app that identifies plants from photos with honest confidence and trustworthy care advice.

## Development

### Setup

This project uses Swift 6 with strict concurrency enabled, and local Swift packages for modular architecture.

**Requirements:**
- Xcode 16+ (iOS 18 SDK)
- macOS 13+ (for development)

### Building

1. **Clone and open in Xcode:**
   ```bash
   cd Verdure
   # Open in Xcode
   open PlantApp.xcodeproj
   ```

2. **Add packages to Xcode project:**
   - File → Add Packages
   - Select `Packages/DesignSystem`
   - Repeat for other packages in `Packages/`
   - Xcode will automatically resolve dependencies

3. **Build:**
   ```bash
   xcodebuild build -scheme PlantApp
   ```

### Project Structure

```
Packages/
  ├── DesignSystem/        — color tokens, spacing, typography, components
  ├── CoreModels/          — plant, care, identification domain types
  ├── Persistence/         — SwiftData, CloudKit (Phase 1)
  ├── Identification/      — PlantIdentifying protocol, providers (Phase 1)
  ├── CareKnowledge/       — curated care database (Phase 1)
  ├── Entitlements/        — RevenueCat wrapper (Phase 1)
  ├── Backend/             — proxy client, quota management (Phase 1)
  ├── Features/            — UI features (Scan, Result, MyPlants, etc.)
  └── TestSupport/         — fixtures, fakes, snapshot helpers
```

## Development Workflow

Each vertical slice:
1. Compiles with zero warnings
2. Tests pass
3. Commit with conventional-commit message
4. Append to PROGRESS.md
5. Provide simulator verification steps

## Design

See `DESIGN.md` for the visual direction, color tokens, typography, and layout principles.

See `PLAN.md` for the Phase 1 build order and vertical slices.

## Spec

See `SPEC.md` for the full product specification and strategic positioning.
