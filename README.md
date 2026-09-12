# Verdure 🌿

**Honest plant identification for iPhone and Android**

An open-source plant identification app built with React Native + Expo. Snap photos to identify plants with honest confidence levels, explore expert-reviewed care guides, and track your plant collection.

[**Features**](#features) • [**Getting Started**](#getting-started) • [**Architecture**](#architecture) • [**Development**](#development) • [**Testing**](#testing)

---

## Features

### 🎯 Identify Plants
- 📸 Snap photos and get instant identification
- 💯 Honest confidence bands: **Confident** / **Probably** / **NotSure**
- 🔍 Top 5 alternatives sorted by confidence
- ✅ Pre-flight checks (blur detection, plant detection, lighting)
- 7 free scans per day (Phase 1)

### 📚 Expert Care Guides
- 50+ seeded plant database
- Detailed care for light, water, soil, humidity, temperature
- Seasonal advice for Northern/Southern hemispheres
- ⚠️ Toxicity warnings (kids, cats, dogs)
- Review dates showing expertise currency

### 🌱 Manage Your Collection
- 📱 Save plants you own
- 💧 Track watering history
- ✏️ Edit nicknames, locations, notes
- 🔍 Search by name, scientific name, or common names
- 📊 Sort by name, date added, or recent photos

### ⚙️ User Preferences
- Measurement units (metric/imperial)
- Growing hemisphere (north/south for seasonal advice)
- Toxicity warning toggles (kids/pets)
- Notification settings (watering reminders)
- **Data ownership:** Export as JSON anytime

### 🔐 Honest by Design
- ✅ Never fake confidence — always show uncertainty
- ✅ Always show alternatives — never pretend it's certain
- ✅ Never trap you — full data export, delete anytime
- ✅ Expert-reviewed care — not AI-generated
- ✅ Privacy-first — no photo uploads (Phase 1)

---

## Getting Started

### Requirements
- **Node.js** 18+ and npm
- **Expo CLI:** `npm install -g expo-cli`
- **iPhone or Android** with [Expo Go](https://expo.dev/client)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/verdure.git
cd verdure

# Install dependencies
npm install

# Start Expo dev server
npm start
```

### Running on Your Phone

1. Install **Expo Go** on your iPhone or Android
2. In terminal, press `i` (iOS) or `a` (Android)
   - OR scan the QR code with your phone camera
3. App launches in Expo Go
4. Complete onboarding (4 screens, ~90 seconds)
5. Grant camera permission
6. **Scan your first plant!** 🌿

### Troubleshooting

```bash
# Port already in use?
npm start -- --tunnel

# Dependencies not found?
npm install

# TypeScript errors in editor?
# Wait ~5s for IntelliSense to catch up

# Expo Go closes?
npm start --reset-cache
```

---

## Architecture

### Tech Stack
- **Frontend:** React Native 0.75
- **Runtime:** Expo 51 (Windows-compatible!)
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router (file-based)
- **Database:** SQLite (expo-sqlite)
- **Camera:** expo-camera
- **Persistence:** AsyncStorage + SQLite
- **State:** React Hooks
- **Testing:** Jest + React Testing Library
- **CI/CD:** GitHub Actions

### Project Structure

```
verdure/
├── app/                          # Expo Router pages
│   ├── _layout.tsx              # Root layout, onboarding gate
│   ├── index.tsx                # Home screen
│   ├── onboarding.tsx           # 4-screen user flow
│   ├── scan.tsx                 # Camera capture
│   ├── result.tsx               # Identification results
│   ├── my-plants.tsx            # Plant collection (2-column grid)
│   ├── plant-detail.tsx         # View/edit single plant
│   └── settings.tsx             # User preferences
│
├── src/
│   ├── components/              # Reusable UI
│   │   ├── Button.tsx           # Primary/secondary/tertiary
│   │   ├── Card.tsx             # Container + badges
│   │   └── CareCard.tsx         # Care display (compact/full)
│   │
│   ├── services/                # Business logic
│   │   ├── database.ts          # SQLite CRUD
│   │   ├── identification.ts    # Identification engine
│   │   ├── camera.ts            # Camera + checks
│   │   ├── careDatabase.ts      # Seeded plant data
│   │   └── userPreferences.ts   # Preferences storage
│   │
│   ├── hooks/                   # Custom hooks
│   │   ├── usePlants.ts         # Plant state
│   │   └── useIdentification.ts # Identification flow
│   │
│   ├── types/                   # TypeScript
│   │   ├── plant.ts             # Domain models
│   │   └── errors.ts            # Error types
│   │
│   ├── constants/
│   │   └── theme.ts             # Design tokens
│   │
│   ├── utils/
│   │   └── id.ts                # ID generation
│   │
│   └── tests/                   # Integration tests
│       └── integration.test.ts
│
├── jest.config.js               # Test config
├── tsconfig.json                # TypeScript config
├── app.json                     # Expo config
└── package.json                 # Dependencies
```

### Design Tokens

All styling uses constants from `src/constants/theme.ts`:

```typescript
// Colors — semantic meaning
Colors.leaf                // Primary green
Colors.cream              // Light neutral
Colors.glass              // Secondary bg
Colors.soil               // Accent brown
Colors.confident          // Success (green)
Colors.probably           // Warning (yellow)
Colors.notSure            // Info (blue)

// Spacing — 8pt base
Spacing.compact           // 4pt
Spacing.tight             // 8pt
Spacing.default           // 16pt
Spacing.loose             // 24pt
Spacing.spacious          // 32pt

// Typography
Typography.displayLarge
Typography.headline
Typography.subheadline
Typography.body
Typography.caption1
```

### End-to-End Flow

```
┌─────────────────┐
│  First Launch   │  → Onboarding (4 screens)
└────────┬────────┘
         ↓
┌─────────────────┐
│  Home Screen    │  → Scan Plant or View My Plants
└────────┬────────┘
         ↓
┌─────────────────┐
│ Camera Capture  │  → Pre-flight checks
└────────┬────────┘
         ↓
┌─────────────────┐
│ Identification  │  → Confidence mapping
└────────┬────────┘
         ↓
┌─────────────────┐
│ Result Screen   │  → Save to My Plants
└────────┬────────┘
         ↓
┌─────────────────┐
│ My Plants Grid  │  → Search, sort, edit, delete
└─────────────────┘
```

---

## Development

### Running Tests

```bash
# All tests
npm test

# Specific test
npm test -- userPreferences.test.ts

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Code Quality

```bash
# Type checking
npx tsc --noEmit

# Format code (prettier)
npx prettier --write .

# Quick lint check
npm test -- --coverage
```

### Making Changes

1. Create a branch: `git checkout -b feature/xyz`
2. Make changes and test: `npm test`
3. Type check: `npx tsc --noEmit`
4. Commit: `git commit -m "feat: xyz"`
5. Push: `git push origin feature/xyz`
6. Create pull request

### Debugging

```bash
# Dev menu in Expo Go
Shake device or Ctrl+M (Android)

# React DevTools
npm install -g react-devtools
react-devtools

# Console logs
Check terminal window
```

---

## Testing

### Test Coverage

| Layer | Target | Status |
|-------|--------|--------|
| Services | 85%+ | ✅ In progress |
| Hooks | 80%+ | ✅ In progress |
| Components | 75%+ | ✅ In progress |
| Integration | Key flows | ✅ In progress |

### Test Files

```
src/services/*.test.ts          # Database, identification, camera, prefs
src/tests/integration.test.ts   # Cross-cutting flows
app/**/*.test.tsx              # Component tests (Phase 2)
```

### Running Tests

```bash
# Jest with coverage
npm test -- --coverage

# Watch specific file
npm test -- --watch userPreferences.test.ts

# Debug test
node --inspect-brk node_modules/.bin/jest --runInBand
```

### CI/CD Pipeline

GitHub Actions on every push:
- ✅ Tests (Node 18, 20)
- ✅ TypeScript check
- ✅ Coverage tracking
- ✅ Accessibility audit
- ✅ Build verification

View workflow: `.github/workflows/ci.yml`

---

## Accessibility

### WCAG AA Compliance

- ✅ Color contrast ≥ 4.5:1 for all text
- ✅ Touch targets minimum 44×44pt
- ✅ Semantic components (buttons, labels)
- ✅ Keyboard-only navigation works
- ✅ Error messages clear and actionable
- ✅ Emoji for decoration, not content

### Screen Readers
- iOS VoiceOver supported
- Android TalkBack supported
- Proper roles and labels throughout

### Testing Accessibility

```bash
# Enable on iOS
Settings → Accessibility → VoiceOver

# Enable on Android  
Settings → Accessibility → TalkBack

# Manual checklist
- Tab through all screens
- Verify color contrast (Contrast Ratio)
- Check all interactive elements 44×44pt min
- Confirm error messages are clear
```

---

## Deployment

### Prepare for App Stores

Phase 2 checklist:
- [ ] Testflight build
- [ ] App Store screenshots
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Support contact
- [ ] GDPR/CCPA compliance

### Build for Distribution

```bash
# Configure EAS
eas build:configure

# Build for TestFlight
eas build --platform ios

# Build for Google Play
eas build --platform android
```

---

## Phase 2 Roadmap

- 🔐 **Server sync** — preferences, plants, photos
- 🔔 **Notifications** — watering reminders
- 📸 **Photo journal** — multiple photos per plant
- 🩺 **Disease diagnosis** — identify plant problems
- 👤 **Expert escalation** — connect with horticulturists
- 🌱 **Seedling/grass modes** — specialty detection
- 📊 **Dashboard** — collection analytics

---

## Contributing

1. Fork the repo
2. Create feature branch
3. Make changes with tests
4. Verify: `npm test && npx tsc --noEmit`
5. Submit PR

### Code Standards
- **TypeScript strict mode** — no `any` types
- **Design tokens only** — no hardcoded values
- **Honest errors** — specific, actionable messages
- **Test coverage** — new code needs tests
- **Conventional commits** — feat, fix, docs, test, etc.

---

## FAQ

**Q: Why React Native and not Expo alone?**  
A: We use Expo but as the full runtime. React Native is the framework.

**Q: Why Windows-friendly development?**  
A: Users may not have Macs. Expo Go on iPhone works from Windows.

**Q: Why 7 scans/day limit?**  
A: Prevents API abuse during Phase 1. Removed in Phase 2.

**Q: Can I use this on Android?**  
A: Yes! Same Expo app, all features. Phase 1 targets iOS first though.

**Q: How do I export my data?**  
A: Home → Settings → Data → Export My Data (JSON file)

**Q: What about privacy?**  
A: Phase 1: No photo uploads. Full privacy policy coming Phase 2.

---

## License

MIT License — see LICENSE for details

## Support

- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions  
- **Email:** support@verdure.app (Phase 2)

## Credits

- **Plant care data:** Expert horticulturists
- **Design:** SwiftUI + minimalist philosophy
- **Community:** React Native, Expo teams

---

**Built with ❤️ for plant lovers who value honesty**

🌿 Verdure: Never fake confidence.
