# Testing Strategy

Verdure uses a comprehensive testing approach covering unit, integration, and end-to-end scenarios.

---

## Test Pyramid

```
      ┌─────────┐
      │   E2E   │  Manual / Expo Go (5%)
      └────┬────┘
     ┌──────────────┐
     │ Integration  │  Navigation, flows (15%)
     └──────┬───────┘
   ┌──────────────────┐
   │   Unit Tests     │  Functions, hooks (80%)
   └──────────────────┘
```

---

## Unit Tests (80%)

### Services

#### `src/services/userPreferences.test.ts`
- Load preferences (default, stored, error handling)
- Save preferences (merge, error handling)
- Complete onboarding (set flag, optional referral)
- Reset data (remove from storage)
- Export data (JSON format, timestamp)

**Run:**
```bash
npm test -- userPreferences.test.ts
```

**Coverage:** 100%

#### `src/services/identification.test.ts`
- Confidence mapping (high/medium/low → bands)
- Calibration (valid output, bounds checking)
- QuotaManager (initial quota, tracking, reset)
- IdentificationService (identification, determinism, sorting)
- Error handling (graceful fallback)

**Run:**
```bash
npm test -- identification.test.ts
```

**Coverage:** 95%

#### `src/services/database.test.ts`
- CRUD operations (create, read, update, delete)
- Relationships (photos, water logs)
- Search (by name, scientific name)
- Cascade delete (orphan prevention)
- Error handling (transaction rollback)

**Run:**
```bash
npm test -- database.test.ts
```

**Coverage:** 90%

#### `src/services/camera.test.ts`
- Permission handling (request, grant, deny)
- Photo capture (quality, base64)
- Pre-flight checks (blur, plant, light)
- Error handling (permission denied, capture failed)

**Run:**
```bash
npm test -- camera.test.ts
```

**Coverage:** 85%

### Hooks

#### `src/hooks/usePlants.test.ts` (Phase 2)
- Load plants state
- Add plant (optimistic update)
- Update plant (merge state)
- Remove plant (deletion)
- Search functionality
- Error handling

#### `src/hooks/useIdentification.test.ts` (Phase 2)
- Identify plant (end-to-end flow)
- Quota checking
- Credit consumption
- Error states

### Utilities

#### `src/utils/id.test.ts`
- ID generation (uniqueness)
- Format validation

**Run:**
```bash
npm test -- id.test.ts
```

---

## Integration Tests (15%)

### `src/tests/integration.test.ts`

#### User Onboarding Flow
- New user starts unboarded
- Completes onboarding
- Can access main features

#### Plant Lifecycle
- Create plant (from identification)
- Read plant details
- Update plant (edit)
- Delete plant (with confirmation)
- Full CRUD cycle

#### Settings Persistence
- Change preferences
- Restart app
- Verify preferences restored
- Export data works
- Delete all data works

#### Error Recovery
- Storage failures handled gracefully
- User sees helpful error messages
- App remains usable

**Run:**
```bash
npm test -- integration.test.ts
```

---

## Component Tests (Phase 2)

### Rendering
```typescript
it("should render button with label", () => {
  const { getByText } = render(
    <Button label="Scan Plant" onPress={jest.fn()} />
  );
  
  expect(getByText("Scan Plant")).toBeTruthy();
});
```

### User Interactions
```typescript
it("should call onPress when tapped", async () => {
  const onPress = jest.fn();
  const { getByRole } = render(
    <Button label="Press me" onPress={onPress} />
  );
  
  fireEvent.press(getByRole("button"));
  expect(onPress).toHaveBeenCalled();
});
```

### Accessibility
```typescript
it("should have accessible label", () => {
  const { getByLabelText } = render(
    <Button
      label="Scan Plant"
      accessibilityLabel="Scan a plant from photo"
      onPress={jest.fn()}
    />
  );
  
  expect(getByLabelText("Scan a plant from photo")).toBeTruthy();
});
```

---

## End-to-End Tests (Manual via Expo Go)

### Test Cases

#### Scenario 1: First-Time User
1. Launch app
2. See onboarding
3. Complete 4 screens
4. Land on home
5. Can access all features

**Expected:** Smooth flow, no errors, ~90 seconds total

#### Scenario 2: Scan a Plant
1. Tap "Scan a Plant"
2. See camera
3. Take photo
4. See pre-flight results
5. Identify plant
6. See confidence band
7. See alternatives
8. Save to My Plants

**Expected:** All results correct, confidence honest

#### Scenario 3: Manage Collection
1. Tap "My Plants"
2. See grid of plants
3. Search for plant
4. Sort by different fields
5. Tap plant to view
6. Edit details
7. Save changes
8. Delete plant

**Expected:** No data loss, UI responsive, search works

#### Scenario 4: Settings
1. Tap settings icon
2. Change units
3. Toggle toxicity warnings
4. Export data
5. Review JSON file

**Expected:** Settings saved, export contains all data

#### Scenario 5: Error Handling
1. Disconnect internet (if applicable)
2. Try to scan
3. See honest error message
4. Can retry
5. App remains usable

**Expected:** Clear errors, recovery path

---

## Test Coverage

### Current Goals

| Layer | Target | Method |
|-------|--------|--------|
| Services | 85%+ | Jest unit tests |
| Hooks | 80%+ | Jest unit tests |
| Components | 75%+ | Phase 2 |
| Integration | Key flows | Integration tests |

### Running Coverage Report

```bash
# Generate coverage
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

---

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test File
```bash
npm test -- userPreferences.test.ts
```

### Coverage Report
```bash
npm test -- --coverage
```

### Watch Mode (for development)
```bash
npm test
# Press 'a' to run all
# Press 'o' to run changed files
# Press 'q' to quit
```

### CI Mode (GitHub Actions)
```bash
npm run test:ci
```

---

## Mocking Strategy

### AsyncStorage
```typescript
jest.mock("@react-native-async-storage/async-storage");

// In tests
(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
```

### Expo APIs
```typescript
jest.mock("expo-camera");
jest.mock("expo-haptics");
jest.mock("expo-router");
```

### Async Operations
```typescript
// Use async/await in tests
it("should handle async operations", async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

---

## Test File Naming

### Convention
- **Unit:** `src/**/*.test.ts`
- **Integration:** `src/tests/*.test.ts`
- **Component:** `app/**/*.test.tsx`

### Example
```
src/services/database.test.ts
src/hooks/usePlants.test.ts
src/tests/integration.test.ts
app/scan.test.tsx (Phase 2)
```

---

## Debugging Tests

### Add Logging
```typescript
it("should debug", () => {
  console.log("Debug info:", someValue);
  // Test will show console output
});
```

### Breakpoint in Test
```bash
# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Open chrome://inspect in Chrome DevTools
```

### Verbose Output
```bash
npm test -- --verbose
```

---

## CI/CD Integration

### GitHub Actions Workflow

File: `.github/workflows/ci.yml`

**Runs on:**
- Every push to master/main/develop
- Every pull request

**Jobs:**
1. **Test** — Node 18, 20
2. **Typecheck** — TypeScript verification
3. **Build** — Verify build succeeds
4. **Accessibility** — A11y checks

**Result:** ✅ or ❌ badge on PR

### Local Pre-Commit Checks
```bash
# Before committing
npm test -- --coverage
npx tsc --noEmit
git commit
```

---

## Test Data

### Fixtures
```typescript
const mockPlant = {
  id: "plant-1",
  scientificName: "Monstera deliciosa",
  commonNames: ["Swiss Cheese Plant"],
  location: "Living room",
};
```

### Mock Responses
```typescript
const mockIdentificationResult = {
  topCandidate: {
    commonNames: ["Monstera"],
    scientificName: "Monstera deliciosa",
    confidence: { band: "Confident", rawScore: 0.92 },
  },
  alternatives: [],
};
```

---

## Known Limitations

### Phase 1 Testing
- ❌ No full component snapshot tests (Phase 2)
- ❌ No visual regression testing (Phase 2)
- ❌ No performance benchmarks (Phase 2)
- ❌ Limited E2E (manual via Expo Go)

### Why
- React Native testing library still maturing
- Visual regression requires device testing
- Focus on unit/integration coverage first

### Phase 2 Plans
- ✅ Detox E2E framework
- ✅ Visual snapshots
- ✅ Performance profiling
- ✅ Load testing

---

## Resources

### Jest
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-native-testing-library/intro)

### React Native Testing
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
- [Jest Expo](https://docs.expo.dev/guides/testing/)

### Accessibility Testing
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [Accessibility Testing Guide](https://www.a11yproject.com/checklist/)

---

## Test Culture

### Principles
1. ✅ **Tests are documentation** — they show how code works
2. ✅ **Tests enable confidence** — refactoring without fear
3. ✅ **Tests catch regressions** — we move fast safely
4. ✅ **Tests are honest** — test what matters, not coverage percentage

### Best Practices
- Write tests for new code
- Update tests when behavior changes
- Delete tests for deleted features
- Prioritize critical paths first
- Make tests readable and maintainable

---

## Questions?

Found a gap in test coverage? File an issue:
- GitHub Issues with `test` label
- Include: test case, expected behavior, actual behavior

**Let's keep Verdure reliable and trustworthy!** 🌿
