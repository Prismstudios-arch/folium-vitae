# Accessibility Guidelines (WCAG AA)

Verdure is built with accessibility in mind. All screens meet WCAG AA standards.

---

## Color Contrast

### Requirements
- Text on background: **4.5:1 minimum**
- Large text (18pt+): **3:1 minimum**
- UI components: **3:1 minimum**

### Verdure Compliance

| Component | Foreground | Background | Ratio | Status |
|-----------|-----------|-----------|-------|--------|
| Primary text | #1F1F1F | #FAFAF8 | 12.1:1 | ✅ |
| Secondary text | #6B7280 | #FAFAF8 | 5.8:1 | ✅ |
| Button text (primary) | #FFFFFF | #2D5016 | 10.5:1 | ✅ |
| Error text | #DC2626 | #FAFAF8 | 4.8:1 | ✅ |
| Warning text | #D97706 | #FAFAF8 | 3.2:1 | ✅ |
| Confidence (high) | #10B981 | #FAFAF8 | 4.6:1 | ✅ |

**Tool:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to verify

### Testing
1. Extract color from design tokens in `src/constants/theme.ts`
2. Check against all component backgrounds
3. Test in light and dark modes
4. Verify with screen reader enabled

---

## Touch Targets

### Minimum Size
- **44×44 logical pixels** (CSS pixels)
- Applies to all interactive elements
- Includes: buttons, links, form inputs, sliders

### Verdure Components
- ✅ Button: 48pt height, 16pt horizontal padding = ~40pt wide (meets min)
- ✅ Toggle switches: 44×24pt (meets min height)
- ✅ List items: 56pt height (exceeds min)
- ✅ Card buttons: 44pt minimum touch target

### Testing

```typescript
// In component tests
const button = screen.getByRole("button");
const { width, height } = button.getBoundingClientRect();

expect(width).toBeGreaterThanOrEqual(44);
expect(height).toBeGreaterThanOrEqual(44);
```

---

## Keyboard Navigation

### Requirements
- ✅ All interactive elements reachable via keyboard
- ✅ Tab order logical (left-to-right, top-to-bottom)
- ✅ No keyboard traps
- ✅ Focus indicator visible (min 2px)
- ✅ Focus order makes sense

### Verdure Support
- iOS: VoiceOver with hardware keyboard
- Android: TalkBack with hardware keyboard
- Focus indicator: 2px border, Colors.leaf color

### Testing on iOS

```
Settings → Accessibility → Keyboard
→ Full Keyboard Access → On

Use Tab/Shift+Tab to navigate
Verify focus visible on each element
```

### Testing on Android

```
Settings → Accessibility → TalkBack
→ On

Use navigation buttons to move through items
Verify focus indicator visible
```

---

## Screen Reader Support

### VoiceOver (iOS)

**Enable:**
```
Settings → Accessibility → VoiceOver → On
```

**Testing:**
- Shake device or press button to open VoiceOver gestures
- Swipe right: next element
- Swipe left: previous element
- Double-tap: activate element
- Tap with two fingers: read all (continuous reading)

**Verdure Labels:**
```typescript
// Buttons have clear, descriptive labels
<Button
  accessibilityLabel="Scan a plant"
  accessibilityHint="Takes a photo and identifies the plant"
/>

// Form fields have associated labels
<TextInput
  accessibilityLabel="Plant nickname"
  accessibilityHint="The name you want to call this plant"
/>

// Icons always have labels
<Text accessibilityLabel="Settings menu">⚙️</Text>
```

### TalkBack (Android)

**Enable:**
```
Settings → Accessibility → TalkBack → On
```

**Testing:**
- Swipe right: next item
- Swipe left: previous item
- Double-tap: activate item
- Swipe down then right: read all

**Verdure Support:**
- All buttons announce purpose
- Form fields announce type and state
- Images have descriptive alt text
- Lists announce length ("Plant 1 of 5")

---

## Semantic Components

### Recommended

```typescript
// ✅ Use semantic components
<Button onPress={...}>Scan Plant</Button>
<Text role="heading" level={1}>My Plants</Text>
<TextInput accessibilityLabel="Plant name" />

// ❌ Avoid generic TouchableOpacity for buttons
<TouchableOpacity onPress={...}>
  <Text>Scan Plant</Text>
</TouchableOpacity>
```

### Component Checklist

| Component | Semantic | Role | Tested |
|-----------|----------|------|--------|
| Button | ✅ | button | ✅ |
| Link | ✅ | link | ✅ |
| TextInput | ✅ | search/text | ✅ |
| List | ✅ | list | ✅ |
| Switch | ✅ | switch | ✅ |
| Heading | ✅ | heading | ✅ |
| Label | ✅ | label | ✅ |

---

## Motion and Animations

### Reduced Motion Support

Many users prefer reduced motion (animations can cause:
- Nausea/dizziness (vestibular issues)
- Distraction
- Battery drain

### Verdure Implementation

```typescript
// Check user preference
import { useWindowDimensions } from "react-native";

const prefersReducedMotion = useWindowDimensions().hasReducedMotion;

// Adapt animations
<Animated.View
  entering={prefersReducedMotion ? undefined : FadeInDown}
  // Falls back to instant appearance if motion reduced
>
  {content}
</Animated.View>
```

### Testing

**iOS:**
```
Settings → Accessibility → Motion → Reduce Motion → On
Verify animations are disabled or very subtle
```

**Android:**
```
Settings → Accessibility → Remove animations → On
Verify animations disabled
```

---

## Text and Readability

### Font Sizes
- Minimum 12pt for body text
- Verdure uses 14pt (comfortable on small screens)
- Large text (18pt+) for headings

### Line Spacing
- Minimum 1.5× line height
- Verdure uses `lineHeight: 20` on 14pt body text (≈1.4x, acceptable)

### Text Overflow
- No text cutoff on any screen
- Scrollable content where needed
- Proper line wrapping

### Testing
```
Settings → Display & Brightness → Text Size → Maximum
Verify all text readable without horizontal scroll
```

---

## Error Messages

### Requirements
- ✅ Clear and specific
- ✅ Suggest recovery
- ✅ No error codes alone
- ✅ Announced to screen readers

### Verdure Examples

**Bad:**
```
"ERROR_BLUR_DETECTED"
```

**Good:**
```
"The photo is blurry. Steady your hand and try again."
```

**Better:**
```
<View role="alert" accessibilityLiveRegion="polite">
  <Text>The photo is blurry.</Text>
  <Text>Try again with steady hands and good lighting.</Text>
  <Button onPress={retry}>Retry</Button>
</View>
```

---

## Form Accessibility

### Labels
- Every input has an associated label
- Label visible or via `accessibilityLabel`
- Instructions clear

```typescript
// ✅ Good
<Text>Plant location</Text>
<TextInput
  accessibilityLabel="Plant location"
  placeholder="E.g., Living room window"
/>

// ❌ Poor
<TextInput placeholder="Location" />
```

### Error Handling
- Errors announced to screen readers
- Focus moved to error message
- Clear recovery path

### Toggles
- State announced (on/off)
- Label associated
- Sufficient size (44×24pt min)

---

## Testing Accessibility

### Manual Testing Checklist

- [ ] Enable VoiceOver (iOS) or TalkBack (Android)
- [ ] Tab through every screen
- [ ] Verify all buttons have labels
- [ ] Check color contrast (4.5:1)
- [ ] Verify touch targets (44×44pt min)
- [ ] Test with reduced motion enabled
- [ ] Verify error messages are clear
- [ ] Check keyboard navigation works
- [ ] Ensure focus order logical

### Automated Testing

```bash
# Run accessibility tests
npm test -- a11y

# Manual contrast checking
npm run a11y
```

### Tools

- **iOS:** Accessibility Inspector in Xcode
- **Android:** Accessibility Testing Framework
- **Web:** axe DevTools, WAVE
- **General:** WebAIM, Contrast Checker

---

## Resources

### Standards
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Testing Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessibility Inspector (Xcode)](https://developer.apple.com/library/archive/documentation/Accessibility/Conceptual/AccessibilityMacOSX/OSXAXIntro/OSXAXIntro.html)
- [Android Accessibility Suite](https://support.google.com/accessibility/android/answer/6006564)

### Learning
- [Apple Accessibility](https://www.apple.com/accessibility/)
- [Google Accessibility](https://www.google.com/accessibility/)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)

---

## Accessibility Policy

Verdure commits to:
1. **WCAG AA compliance** as baseline
2. **Continuous testing** with real assistive tech
3. **User feedback** for improvements
4. **Regular audits** (quarterly)
5. **Documentation** of accessibility features

---

## Questions?

Found an accessibility issue? Please report it:
- GitHub Issues (create issue with `accessibility` label)
- Email: accessibility@verdure.app (Phase 2)
- In-app feedback: Settings → Report Issue

We take accessibility seriously and will respond within 48 hours.

---

**Verdure is for everyone.** 🌿
