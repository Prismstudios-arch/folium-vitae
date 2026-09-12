# PLAN.md — Verdure Phase 1 Implementation

## Module Layout

```
PlantApp.xcodeproj
├── PlantApp (app target, minimal, glues features)
└── Packages/
    ├── DesignSystem/
    │   ├── Sources/DesignSystem/
    │   │   ├── Tokens/ (colors, spacing, fonts, motion)
    │   │   ├── Components/ (buttons, cards, badges, etc)
    │   │   └── Modifiers/ (custom view modifiers)
    │   └── Tests/DesignSystemTests/
    │
    ├── CoreModels/
    │   ├── Sources/CoreModels/
    │   │   ├── Plant/ (Species, PlantIdentified, Taxonomy)
    │   │   ├── Identification/ (IdentificationRequest, IdentificationResult, Confidence)
    │   │   ├── Care/ (CareGuide, WaterSchedule, LightRange, etc)
    │   │   └── Errors/ (domain errors, no external dependencies)
    │   └── Tests/CoreModelsTests/
    │
    ├── Persistence/
    │   ├── Sources/Persistence/
    │   │   ├── Models/ (@Model structs for SwiftData)
    │   │   ├── Stack/ (SwiftDataStack, CloudKit config)
    │   │   ├── Migrations/ (schema versioning)
    │   │   └── Queries/ (fetch helpers)
    │   └── Tests/PersistenceTests/
    │
    ├── Identification/
    │   ├── Sources/Identification/
    │   │   ├── Protocol/ (PlantIdentifying)
    │   │   ├── Providers/
    │   │   │   ├── KindwiseProvider/ (live, uses backend proxy)
    │   │   │   └── MockProvider/ (for testing)
    │   │   └── ConfidenceMapper/ (vendor score → confidence band)
    │   └── Tests/IdentificationTests/
    │
    ├── CareKnowledge/
    │   ├── Sources/CareKnowledge/
    │   │   ├── Models/ (CareData, Season modifiers)
    │   │   ├── Database/ (JSON-based, versioned)
    │   │   ├── Lookup/ (by species, genus fallback)
    │   │   └── Seeds/ (initial ~300 houseplants + ~150 garden plants)
    │   └── Tests/CareKnowledgeTests/
    │
    ├── Entitlements/
    │   ├── Sources/Entitlements/
    │   │   ├── RevenueCat/ (wrapper, quota state)
    │   │   ├── Models/ (Entitlement, SubscriptionStatus)
    │   │   └── Paywall/ (RevenueCat remote config)
    │   └── Tests/EntitlementsTests/
    │
    ├── Backend/
    │   ├── Sources/Backend/
    │   │   ├── Client/ (URLSession + async/await)
    │   │   ├── Models/ (normalized provider responses)
    │   │   ├── QuotaManager/ (DeviceCheck + RevenueCat user ID keying)
    │   │   └── Endpoints/ (identify, diagnose, care-db-deltas, correction-log)
    │   └── Tests/BackendTests/
    │
    ├── Features/
    │   ├── Scan/
    │   │   ├── Sources/
    │   │   │   ├── Camera/ (AVFoundation wrapper, preview layer)
    │   │   │   ├── PreFlight/ (blur, plant detection, light checks)
    │   │   │   ├── Views/ (ScanView, capture UI, feedback)
    │   │   │   └── ViewModel/ (capture state machine)
    │   │   └── Tests/
    │   │
    │   ├── Result/
    │   │   ├── Sources/
    │   │   │   ├── Views/ (ResultView, confidence bands, alternatives)
    │   │   │   ├── ViewModel/
    │   │   │   └── Components/ (ConfidenceBand, WhyWeThinkThis, Correction)
    │   │   └── Tests/
    │   │
    │   ├── MyPlants/
    │   │   ├── Sources/
    │   │   │   ├── Views/ (grid, search, filter)
    │   │   │   ├── Editing/ (inline edit, swipe actions)
    │   │   │   └── ViewModel/
    │   │   └── Tests/
    │   │
    │   ├── PlantDetail/
    │   │   ├── Sources/
    │   │   │   ├── Views/ (full care card, photo journal, notes)
    │   │   │   └── ViewModel/
    │   │   └── Tests/
    │   │
    │   ├── Onboarding/
    │   │   ├── Sources/
    │   │   │   ├── Views/ (3 screens, camera permission, referral question)
    │   │   │   └── ViewModel/
    │   │   └── Tests/
    │   │
    │   ├── Settings/
    │   │   ├── Sources/
    │   │   │   ├── Views/ (units, hemisphere, pets/kids, notifications)
    │   │   │   ├── ManageSubscription/ (deep link to App Store)
    │   │   │   ├── Privacy/ (export data, delete all)
    │   │   │   └── ViewModel/
    │   │   └── Tests/
    │   │
    │   ├── Paywall/
    │   │   ├── Sources/
    │   │   │   ├── Views/ (RevenueCat RemotePaywall, honest copy)
    │   │   │   └── ViewModel/
    │   │   └── Tests/
    │   │
    │   └── Diagnose/ (stub for Phase 2)
    │       └── Sources/
    │           └── Placeholder.swift (no impl yet)
    │
    └── TestSupport/
        ├── Sources/
        │   ├── Fixtures/ (sample plants, care data, scan results)
        │   ├── Fakes/ (MockIdentifier, MockCareDB, MockBackend)
        │   ├── Snapshot/ (snapshot test helpers)
        │   └── StoreKit/ (StoreKit Testing for paywall tests)
        └── Tests/
```

---

## Vertical Slices (smallest first, in order)

### Slice 1: Foundation — DesignSystem & CoreModels
**What:** Build design tokens, common types, no logic yet.

**Deliverables:**
- `DesignSystem` package with:
  - Color tokens (named: `Color.leaf`, `Color.soil`, `Color.danger`, etc. — to be designed in DESIGN.md)
  - Type scale and font definitions (SF Pro, weights, tracking)
  - Spacing grid (8pt base)
  - Motion vocabulary (spring constants)
  - Common components (buttons, cards, badges)
- `CoreModels` package with:
  - `Species` (scientificName, commonNames, family)
  - `PlantIdentified` (score, confidence band)
  - `IdentificationRequest`, `IdentificationResult`
  - `CareGuide` shape (light, water, soil, toxicity, etc)
  - No external dependencies; everything Codable

**Testing:** Unit tests for token values exist, components render without crashing.

**Verification:** Run `swift build` on the packages, zero warnings.

---

### Slice 2: Persistence Layer
**What:** SwiftData stack, CloudKit sync, migrations.

**Deliverables:**
- `Persistence` package with:
  - `SavedPlant` model (@Model for SwiftData)
  - `PlantPhoto` model (date, originalPath, metadata)
  - `WaterLog` model (date, notes)
  - SwiftDataStack (configure CloudKit, privacy, error handling)
  - Queries helper (fetch saved plants, photos by plant, etc)
- Works fully offline (SwiftData → on-device SQLite)
- CloudKit sync with privacy config (private database, no iCloud account required)

**Testing:** Unit tests create/fetch/update/delete plants. Integration tests verify CloudKit tokens.

**Verification:** On simulator: create a plant, kill app, reopen → plant still there. Toggle airplane mode, make edits → syncs when back online.

---

### Slice 3: Camera Capture & Pre-flight Checks
**What:** Custom camera UI (AVFoundation), photo capture, on-device quality checks.

**Deliverables:**
- `Scan` feature package with:
  - `CameraPreviewViewController` (UIViewControllerRepresentable, AVFoundation capture session)
  - Custom focus/exposure tap to lock
  - Torch toggle
  - Instant capture feedback (light haptic on shutter)
  - Pre-flight checks:
    - Blur detection (Laplacian variance via Vision framework)
    - Plant presence check (Vision VNImageClassificationRequest on common plant categories)
    - Light level check (AVCaptureDevice exposure metadata)
  - Guide overlay (suggests framing, not rigid)
  - Session teardown on background (prevents battery drain)
- Capture state machine (idle → focusing → ready → capturing → done)
- Error states (no plant detected, too blurry, too dark → actionable messages)

**Testing:** Unit tests on pre-flight logic (mock Vision results). View tests on state transitions.

**Verification:** On device simulator: tap camera, focus on plant photo, pre-flight should approve. Point at wall → "not a plant". Blurry shot → "that came out blurry". Low light → light suggestion.

---

### Slice 4: Backend Proxy & Identification
**What:** Cloudflare Workers proxy, Kindwise integration, confidence mapping.

**Deliverables:**
- `Backend` package (client-side) with:
  - `BackendClient` (URLSession + async/await, calls our proxy endpoint)
  - Quota manager (DeviceCheck token + RevenueCat anonymous user ID keying)
  - Image normalization (resize to 1024px, strip EXIF, hash for cache)
- `Identification` package with:
  - `PlantIdentifying` protocol
  - `KindwiseProvider` (makes backend calls, parses responses)
  - `ConfidenceMapper` (vendor scores → calibrated bands: Confident / Probably / Not sure)
    - Confident: score > 0.75 (top-1 actually correct ~90% of the time)
    - Probably: score 0.50-0.75 (~70% correct)
    - Not sure: score < 0.50 (show best guesses, offer multi-image)
  - `MockProvider` (returns deterministic results for tests)
- Cloudflare Worker code (separate, provided separately):
  - `/identify` endpoint (takes image, calls Kindwise, normalizes response, checks quota)
  - `/correct` endpoint (logs user corrections for future eval)
  - Perceptual-hash response cache (same-plant → instant response, zero API cost)
  - DeviceCheck token verification (prevents quota bypass)
  - Cost telemetry (track spend per user, per day, per provider)

**Testing:** Unit tests on confidence mapping. Mock provider tests. Integration tests against mock backend.

**Verification:** On simulator: take a photo, scan → result in <3s. Rescan same plant → instant. Check Cloudflare logs for cost tracking.

---

### Slice 5: Result Screen & Honest Confidence
**What:** Display identification with confidence, alternatives, "why we think this".

**Deliverables:**
- `Result` feature package with:
  - `ResultView` (displays user's photo, ID result, confidence band)
  - Confidence band display:
    - **Confident:** large headline, alternatives in dropdown
    - **Probably:** headline + alternatives inline without tap
    - **Not sure:** no headline, "best guesses" as list of 3, offer multi-image or skip for now
  - "Why we think this" section:
    - Shared identifying traits (leaf shape, margins, venation) if provider gives them
    - Reference images side-by-side with user photo (from provider)
    - "That's not right?" correction entry point → user picks correct answer or searches
  - Multi-image coaching:
    - After first shot with low confidence, offer "add a close-up" / "add whole plant" buttons
    - Re-identify with set of images (Kindwise batching)
    - Never charge a credit for the re-identification
  - Save to My Plants button
  - Share button (generates shareable card — Phase 2, stub for now)
  - Loading state (subtle scanning animation over photo, no spinner, timeout message at >6s)

**Testing:** Snapshot tests (light/dark, all confidence bands, XXL text). Mock identifications with known confidence scores.

**Verification:** On device: scan a plant → see confidence band. Test with mock "Not sure" result → see offer for more images. Tap add more → takes photos → instant re-identify. Don't charge credit for re-scan.

---

### Slice 6: Care Knowledge & Cards
**What:** Seeded care data, lookup by species and genus, display care cards.

**Deliverables:**
- `CareKnowledge` package with:
  - Structured JSON database schema:
    - `scientificName`, `commonNames`, `family`, `synonyms`
    - `light` (range: "low" to "bright indirect"), `water` (frequency + seasonal), `soil`, `humidity`, `temperature`, `toxicity` (cats/dogs/humans)
    - `sourceRefs`, `reviewedBy`, `lastReviewedAt`, `confidence: species | genus`
  - Seed data: ~50 common houseplants + ~30 common garden plants (real, curated info)
  - Lookup: by species (exact), by genus (fallback for unknowns)
  - Versioning for remote updates (not Phase 1 scope, but schema ready)
- Care card view component:
  - Contextualizes advice (hemisphere, user's light reading if available, pot size)
  - Review date shown ("Care notes reviewed March 2026")
  - Toxicity badged prominently if relevant
  - Honest "we don't have detailed notes for this one yet" for unknowns

**Testing:** Unit tests on lookup (exact hits, genus fallback). Snapshot tests on care card rendering.

**Verification:** On simulator: identify a common houseplant → see full care card with source review date. Identify an unknown → see genus-level advice + honest "we don't have detailed notes" message.

---

### Slice 7: My Plants Grid & Editing
**What:** Grid view of saved plants, search/filter, inline editing, offline support.

**Deliverables:**
- `MyPlants` feature package with:
  - Grid layout (photo as hero, name overlay)
  - Search by plant name or user nickname
  - Filter by room/location (user-defined tags)
  - Inline editing (tap cell → edit nickname, room, notes, acquisition date)
  - Swipe actions (delete with confirmation, favorite)
  - Empty state ("No plants yet" with invite and illustration)
  - Works fully offline (no network required)
  - Pull-to-refresh syncs CloudKit if online
- Edit flow must be "trivially easy" per spec:
  - Don't require saving, use async saves with optimistic UI
  - Clear cancel/save semantics

**Testing:** Snapshot tests (grid layouts, empty state). Offline mode tests.

**Verification:** On device: save a plant → see it in grid. Edit nickname → changes instantly. Delete → confirm. Go offline → grid loads from cache. Edit → sync when back online.

---

### Slice 8: Monetization — RevenueCat & Paywall
**What:** Subscription setup, paywall, quota enforcement.

**Deliverables:**
- `Entitlements` package with:
  - RevenueCat SDK integration (anonymous user ID)
  - Subscription status tracking (free, trial, active, expired)
  - Quota state (scans remaining, reset time)
  - Paywall trigger logic (show when free user hits 7/day limit)
- `Paywall` feature component with:
  - RevenueCat RemotePaywall (copy/price changeable without app update)
  - Honest subscription disclosure:
    - Price, period, renewal date shown **before** trial starts (plain text, not footnote)
    - Local notification 2 days before trial conversion (what will be charged, how to cancel)
    - Visible close button (no delay, no tiny grey X)
    - No fake countdowns, no "97% off today only"
  - Subscription options: £4.99/month, £29.99/year (7-day trial)
  - Free vs Premium tiers (free: 7 IDs/day; premium: unlimited)
- Backend quota enforcement:
  - Daily cap of 7 for free users (DeviceCheck + RevenueCat user ID keying)
  - Premium users pass quota check
  - Free user hits cap → show "resets tomorrow at 8am" + allow browsing rest of app
  - Never charge credit for identification failures or retries
  - Never charge credit for multi-image re-identification

**Testing:** StoreKit Testing (fake purchases, trial conversion). Mock RevenueCat. Unit tests on quota logic.

**Verification:** On simulator (using StoreKit Testing): start as free user → scan 7 times → 8th blocked with reset time. Tap subscribe → choose plan → trial starts → 2 days later, notification appears. After 7 days, trial converts (with clear charge notification). Premium user → scans unlimited.

---

### Slice 9: Onboarding Flow
**What:** 3 screens + first scan.

**Deliverables:**
- `Onboarding` feature package with:
  - Screen 1: "What this app does" (headline, illustration, forward button)
  - Screen 2: "The honest promise" (no faking, no dark patterns, show screenshots/copy about confidence + pricing)
  - Screen 3: Camera permission (explain benefit, request, explain what we do with photos)
  - Flow completes → immediately offer to scan one of their plants (real scan, not demo)
  - No paywall until **after** first successful result (activation before monetization)
  - Casual question: "How did you find us?" (referral tracking for Apple Search Ads attribution)
  - Onboarding completion flag stored (don't show again)

**Testing:** Snapshot tests on each screen. Flow tests (complete path).

**Verification:** On device: install fresh → see 3 screens → camera permission → scan a real plant → see result → paywall shows. Delete app data → reinstall → onboarding shows again.

---

### Slice 10: Settings & Account Management
**What:** User preferences, subscription management, privacy.

**Deliverables:**
- `Settings` feature package with:
  - Units (metric/imperial)
  - Hemisphere (for seasonal care advice)
  - Pets/kids in home (drives toxicity warnings everywhere in app)
  - Notifications (opt in/out for reminders)
  - **Manage subscription** (button deep-links to `https://apps.apple.com/account/subscriptions`)
  - Restore purchases button
  - Export data (JSON of saved plants, photos, logs, settings)
  - Delete all data (with scary confirmation)
  - Links: Privacy policy, terms, support email
  - Crash reporting/analytics opt-out (if relevant per privacy manifest)

**Testing:** Navigation tests, deep-link verification.

**Verification:** On device: tap Settings → units change → verified in app. Toggle pets/kids → toxicity badges appear/disappear. Tap manage subscription → Apple's subscription page opens. Export data → JSON file appears with all plants.

---

### Slice 11: Analytics & Crash Reporting Setup
**What:** Integration with PostHog (product analytics) and Sentry (crash reporting).

**Deliverables:**
- PostHog SDK integration:
  - Track funnel: install → onboarding → first scan → result → save → paywall → trial start → conversion → D1/D7/D30 retention
  - Track cost telemetry: scans per user per day (vs quota), identification latency, pre-flight rejection reasons
  - Identify by RevenueCat anonymous user ID
- Sentry SDK integration:
  - Crash reporting, uncaught exceptions
  - Performance monitoring (scan-to-result latency, sync times)
- Privacy: no PII, no location data, no images
- Both SDKs included in Privacy Manifest with correct required-reason codes

**Testing:** Verify events fire on test paths. Check Sentry test crash reports.

**Verification:** On simulator: complete onboarding → check PostHog events. Trigger a crash → verify Sentry capture. Production build → monitor dashboard.

---

### Slice 12: Comprehensive Testing & Accessibility
**What:** Unit tests, snapshot tests, UI tests, accessibility pass.

**Deliverables:**
- Unit tests: every logic type (confidence mapping, quota calc, care lookup, etc)
- Snapshot tests: scan view (capturing), result screen (all confidence bands, light/dark, XXL text), My Plants grid (empty/full), paywall, onboarding
- XCUITest covering full path:
  - Install → onboarding → camera permission → scan plant → result → save → My Plants → paywall → subscribe (StoreKit Testing)
  - Device: camera focus/exposure tap works, pre-flight rejects bad photos, multi-image works
- Accessibility audit:
  - VoiceOver: every control labelled, result screen readable end-to-end
  - Contrast: all text ≥ 4.5:1 WCAG AA
  - Dynamic Type: test at XXL, fix clipping (no capping scale)
  - Reduced motion: animations respect `reduceMotion` preference
- Performance (Instruments):
  - Cold launch to interactive camera < 1.2s (iPhone 13)
  - No memory leaks scrolling 200-plant grid
  - Camera session properly released on background
  - Image decode off main thread, downsampled at decode time

**Testing:** All tests pass, zero warnings, Instruments clean.

**Verification:** Run full XCUITest suite on real device. VoiceOver through result screen. Accessibility Inspector reports no issues.

---

## What "Done" Means for Phase 1

- [ ] Project compiles: zero warnings on `swift build` and Xcode build
- [ ] All tests pass: `swift test` on each package + full XCUITest suite
- [ ] No placeholder code: zero `// TODO`, no stub functions returning fake data, no commented-out code
- [ ] Offline-first: My Plants, care cards, settings work in airplane mode; syncs when online
- [ ] Honest confidence: three bands with honest copy, "not sure" screen is a feature not a failure
- [ ] Quota enforced server-side: DeviceCheck + RevenueCat keying prevents bypass
- [ ] No secrets in app: API keys in backend only, DeviceCheck token generated client-side
- [ ] Performance: <1.2s cold launch, <3s capture→result on good network
- [ ] Accessibility: VoiceOver pass, contrast ≥ 4.5:1, Dynamic Type to XXL
- [ ] Monetization ready: paywall truthful, no dark patterns, trial/conversion flow honest
- [ ] CI/CD working: every commit triggers Xcode Cloud or GitHub Actions → TestFlight

## Decisions Made

1. **Provider:** Kindwise (provisional, Phase 0 eval will validate). Can swap via confidence mapper.
2. **Backend:** Cloudflare Workers (simpler, lower cost than Supabase for this scale).
3. **Quota:** Daily hard cap of 7 IDs/day for free users. No confusing 30-day rolling window. Premium users unlimited.
4. **Care data:** I'll seed ~50 houseplants + ~30 garden plants with real, curated info in Phase 1. You can expand post-launch.
5. **Analytics:** PostHog (privacy-aligned) + Sentry (crashes).
6. **Design:** Write DESIGN.md next (before any SwiftUI code). You approve, then I build.
7. **DeviceCheck:** In Phase 1 scope (non-negotiable for quota integrity).
8. **Multi-image:** In Phase 1 (core to "honest confidence" promise).

---

## Next Step

**Before I write one line of code:** approval of DESIGN.md (color tokens, typefaces, type scale, spacing, motion, principles, ASCII wireframes for Scan / Result / My Plants).

I'll have that to you before this meeting ends.
