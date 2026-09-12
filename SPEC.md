# SPEC.md — Plant identification app (working name: **Verdure**)

> **How to use this file:** put it in your repo root, open the repo in VS Code with Claude Code, and send the message in §0. Everything after §0 is the spec Claude Code will read. Do not paste the whole thing as a chat message — it works far better as a file on disk that gets re-read as the build progresses.

---

## 0. The message to send to Claude Code

```
Read SPEC.md in the repo root, in full, before doing anything.

You are the tech lead and sole engineer on this iOS app. I am the product owner.
I am not a strong Swift engineer, so I cannot catch your mistakes by reading
code — you have to be the one who cares about correctness.

Before you write a single line:

1. Tell me anything in SPEC.md that is contradictory, underspecified, or a bad
   idea. Push back on me. I would rather rewrite the spec than rewrite the app.
2. Ask me every question you need answered to build Phase 1 without guessing.
   Ask them all at once, numbered. Do not ask me things the spec already answers.
3. Then write PLAN.md: the module layout, the vertical slices you'll build in
   order, and what "done" looks like for each slice. Stop and wait for my
   approval of PLAN.md.

Then build in vertical slices, smallest first. After each slice:
- the project must compile with zero warnings
- the tests for that slice must pass
- commit with a conventional-commit message
- append what you did and any decisions you made to PROGRESS.md
- stop and tell me how to verify it by hand on the simulator, then wait

Hard rules for the whole project:
- No placeholder code, no `// TODO: implement`, no stub functions that return
  fake data, no commented-out code. If a slice can't be finished, tell me
  instead of faking it.
- No new third-party dependency without asking me first and telling me the
  binary size cost and what happens if it's abandoned.
- No secrets, API keys, or tokens in the app target or in git. Ever. See §6.
- If you are unsure what I meant, ask. Do not pick an interpretation and build
  it. A wrong guess costs me a week.
- If I ask for something that will get the app rejected from the App Store or
  will lose money on unit economics, say so before doing it.

Start with step 1.
```

That's it. The rest of this file is what it reads.

---

## 1. What this app is

An iOS app that identifies plants from a photo, tells you honestly how sure it is, and gives care advice you can trust. It competes directly with PictureThis (~200M downloads, App Store top-grossing utility) by being the *honest* option.

**The strategic bet:** PictureThis's reviews are full of people who feel tricked by the subscription and misled by confident wrong answers. There is a large, identifiable, angry, high-intent audience. We win them by never doing the three things they hate:

1. **Never pretend to be sure.** Always show confidence and alternatives.
2. **Never trap anyone.** Price visible before trial, cancel link in the app, reminder before we charge.
3. **Never give generic care advice.** Curated, species-specific, human-reviewed.

Everything in this spec serves those three promises. If a feature conflicts with one of them, the feature loses.

**Positioning line (for internal clarity, not marketing copy):** *The plant app that tells you when it doesn't know.*

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Language | Swift 6, strict concurrency enabled | Not Swift 5 mode. Data-race safety at compile time is worth the early pain. |
| UI | SwiftUI, iOS 18.0 minimum, latest SDK | ~95%+ of active devices. UIKit only where SwiftUI genuinely can't (camera preview layer). |
| Persistence | SwiftData + CloudKit private DB | "My Plants" must survive a new phone. No login required. |
| Camera | AVFoundation, custom capture UI | Not `ImagePicker`. The capture experience is a core differentiator (§5). |
| On-device ML | Vision + Core ML | Pre-flight photo quality checks (§5.2). Not the identifier itself, at launch. |
| Networking | `URLSession` + async/await, no Alamofire | No dependency needed for this. |
| Payments | RevenueCat SDK + RevenueCat remote Paywalls | Paywall copy/price/layout changeable without an app update. |
| Backend | One thin serverless proxy (Cloudflare Workers or Supabase Edge Functions) | Non-negotiable. See §6. |
| Analytics | One product analytics SDK (PostHog or Amplitude) + RevenueCat integration | |
| Crash reporting | Sentry or Firebase Crashlytics | |
| CI | Xcode Cloud or GitHub Actions + Fastlane → TestFlight | Set up in Phase 1, not later. |

### Module layout — local Swift packages, not one big app target

```
PlantApp.xcodeproj
Packages/
  DesignSystem/      tokens, components, motion, haptics. No feature logic.
  CoreModels/        domain types, no UIKit/SwiftUI imports
  Persistence/       SwiftData stack, migrations, CloudKit config
  Identification/    the PlantIdentifying protocol + providers + fakes
  CareKnowledge/     curated care DB, lookup + genus fallback
  Entitlements/      RevenueCat wrapper, quota state, paywall triggers
  Features/
    Scan/  Result/  MyPlants/  PlantDetail/  Diagnose/  Onboarding/  Settings/
  TestSupport/       fixtures, fakes, snapshot helpers
```

Rules: features never import each other, only the layers below. `CoreModels` imports nothing. Every package has its own test target. This is what makes the codebase survivable at 40k lines instead of collapsing into a 3,000-line `ContentView`.

---

## 3. The thing that actually makes or breaks this app: identification quality

Read this section twice. Everything else is craft; this is the product.

### 3.1 We don't train a model

Training a competitive plant classifier requires millions of labelled images and ongoing ML ops. We license. Abstract it so we can swap or combine providers:

```swift
public protocol PlantIdentifying: Sendable {
    func identify(_ request: IdentificationRequest) async throws -> IdentificationResult
}
```

Candidate providers to evaluate in Phase 0 (ask me before committing to one):
- **Plant.id / Kindwise** — strong, has a separate plant-health/disease endpoint. Likely launch choice.
- **Pl@ntNet API** — academic, excellent on European/wild flora, cheap, weaker on cultivars/houseplants.
- **iNaturalist CV** — broad taxa, strong on wild plants.

**Evaluate before building on one.** Build a tiny Phase 0 CLI harness: 100 photos I supply (houseplants, succulents, lawn grasses, weeds, seedlings, variegated cultivars, diseased leaves), run through each provider, dump a CSV of top-1 correct / top-3 correct / mean confidence / latency / cost-per-call. **The grasses, seedlings and lookalikes are the categories PictureThis fails at — that's where we need to win, so weight them heavily in the eval.** Tell me the results and recommend.

### 3.2 Multi-image capture is our accuracy edge

Single-photo ID is the ceiling most apps hit. Providers get substantially more accurate with multiple organs (leaf + whole plant + flower/fruit + bark). PictureThis nudges at this weakly.

So: capture flow *coaches*. After the first shot, if confidence is below the high threshold, don't dump a bad answer — offer "add a leaf close-up" / "add the whole plant" / "add a flower" with a visual guide, then re-identify with the set. Frame it as helping, never as an error.

Pre-flight checks on-device before spending money on an API call:
- Blur detection (Laplacian variance or Vision's sharpness signals) → "hold still, that came out blurry"
- Is there plausibly a plant in frame? (Vision classification pass) → "point it at a plant"
- Too dark / blown out → "needs a bit more light"

This both improves accuracy *and* cuts API spend. It's the single highest-ROI thing in the app.

### 3.3 Confidence must be honest

This is the promise the whole brand rests on, so do not fudge it.

- Never display a raw model score as a percentage without checking it's calibrated. Vendor scores are often not probabilities. Run the Phase 0 eval, find the thresholds at which top-1 is actually right ~90% / ~70% / below, and map to bands.
- Three bands, with copy that matches reality:
  - **Confident** — one answer, shown large, alternatives available under a tap.
  - **Probably** — one answer, but alternatives shown inline without tapping.
  - **Not sure** — *no headline answer*. Show "Best guesses" as a list of 3, plus the coaching prompt from §3.2. This screen is the most important screen in the app. Design it as a feature, not a failure.
- Always accessible: the top 3 candidates with their relative likelihoods.
- **"Why we think this"** — show the shared identifying traits (leaf shape, margin, venation, growth habit) and, where the provider gives them, reference images side by side with the user's photo so they can judge for themselves. This turns our uncertainty into user trust instead of user doubt.
- Let the user correct us. "That's not right" → they pick the right one or search → we store their label locally, and log the correction (photo hash + provider answer + user answer) for our own eval set. Over a year this becomes a genuine competitive asset.

### 3.4 Disease diagnosis (Phase 2) — photo alone is not enough

The complaint about PictureThis is that diagnosis is generic ("overwatering") and repetitive. The reason is that a photo of a yellow leaf is genuinely ambiguous; the information needed isn't in the pixels.

So diagnosis = photo **+ a short guided questionnaire**: how often do you water, does the pot drain, how much light, indoor/outdoor, how long has it been happening, are the spots spreading, underside of leaf checked for pests, recently repotted or moved. 5–6 taps, skippable.

Combine into a ranked list of causes with likelihoods, and give a **treatment plan with specific, checkable steps and a follow-up** ("check back in 7 days" → scheduled notification → "did it improve?"). That follow-up loop is both better medicine and a strong retention mechanic. No app in this category does it well.

Be honest here too: if it's ambiguous, say "this could be a few things, here's how to tell them apart" and give a differential-diagnosis test the user can perform.

---

## 4. Care advice: curate, don't generate

**Do not call an LLM at runtime to write care advice.** It hallucinates specifics, it's unattributable, it will vary between two users with the same plant, and if it kills someone's £200 fiddle-leaf fig we have no defence. The "advice killed my plant" reviews are exactly what we're attacking.

Build `CareKnowledge` as a structured, versioned dataset:

- Keyed by accepted scientific name, with synonym mapping, and **genus-level fallback** (we'd rather say "most *Philodendron* want…" than invent species detail).
- Fields: light range, water frequency with a seasonal modifier, soil, humidity, temperature range, feeding, repotting, propagation, common problems, growth habit and mature size, **toxicity to cats / dogs / humans**, hardiness zone, indoor/outdoor.
- Every record carries `sourceRefs`, `reviewedBy`, `lastReviewedAt`, `confidence: species | genus`. Surface the review date in the UI — "care notes reviewed March 2026" is a trust signal nobody else shows.
- Ships bundled as JSON for offline use, with a remote delta update mechanism so I can fix a wrong record without shipping a build.
- Seed the top ~300 houseplants and ~150 common garden plants/weeds properly. That covers the overwhelming majority of scans. Long tail gets genus-level plus an honest "we don't have detailed notes for this one yet."

**Contextualise it.** Same species, different advice: northern vs southern hemisphere season, the user's actual light reading (§8), pot size and material, indoor vs outdoor. "Water every 7–10 days" is the generic advice everyone hates. "Yours is in a 12cm terracotta pot in medium light — check the top 2cm and water when it's dry, roughly weekly in summer" is why someone pays us.

---

## 5. Screens (Phase 1)

Spec is behaviour, not pixels. You propose the visual design per §7.

**Onboarding — 3 screens maximum, then a real scan.** Screen 1: what the app does. Screen 2: the honesty promise (confidence + no dark patterns) — this *is* our marketing. Screen 3: camera permission, asked with a reason. Then immediately scan one of *their* plants. No paywall until they've had one successful result. Activation before monetisation, always. Also ask once, casually, "how did you find us?" — we need this to sanity-check Apple Search Ads attribution.

**Scan.** Custom camera, instant shutter response, capture feedback haptic. Photo-library entry. Torch. Focus/exposure tap. Guide overlay that suggests framing without being a rigid frame. Pre-flight checks (§3.2). Camera session **must** be torn down on background/scene-inactive — battery drain is a real PictureThis complaint and it's usually a leaked capture session.

**Identifying.** No spinner. Show *their photo*, with a subtle scanning treatment over it, and honest progressive status. If it takes >6s, say so. If it fails, the error explains what to do next and offers retry — and it does not consume a quota credit. Charging someone a credit for our failure is exactly the kind of thing we're supposed to be better than.

**Result.** Common name, scientific name, family. Confidence band per §3.3. Alternatives. "Why we think this." Care card summary. Toxicity badge if relevant, prominent. Save to My Plants. Share. "Not right?" correction entry point.

**My Plants.** Grid with photos as the hero. Sort/filter, search. Per plant: nickname, room/location, acquisition date, notes, the full photo timeline. Swipe actions. Editing must be trivially easy — "hard to edit entries" is a named complaint. Works fully offline.

**Plant detail.** Full care card, the photo journal timeline, notes, watering log, and a "my history with this plant" feel rather than an encyclopaedia entry.

**Settings.** Units. Hemisphere. Pets/kids in home (drives toxicity warnings everywhere). Notifications. **Manage subscription** as a top-level row that deep-links to `https://apps.apple.com/account/subscriptions`. Restore purchases. Export my data. Delete all my data. Privacy policy, terms, contact — a real support email, not a form.

---

## 6. Backend proxy — non-negotiable

**Never ship the identification API key inside the app.** Anyone can extract strings from an IPA in minutes; a leaked key on a metered vision API is an unbounded bill. So all provider calls route through our own endpoint:

```
iOS → our proxy → provider(s) → normalised response → iOS
```

The proxy also gives us:
- **Server-enforced quota.** Client-side counters are defeated by deleting the app, or changing the device clock. Key the quota to the RevenueCat anonymous app-user ID **plus an Apple DeviceCheck token** (`DCDevice.generateToken`, two persistent bits per device, survives reinstall) — that's the standard defence against free-tier farming and almost every indie app misses it.
- **Entitlement verification** via RevenueCat webhooks, so premium isn't decided by a client boolean anyone can flip.
- **Perceptual-hash response cache.** Same/near-identical photo → cached result, zero provider cost, instant response. Users re-scan constantly.
- **Provider switching and A/B ensembling without an app update.**
- **Cost telemetry** per user and per day, with a kill-switch if spend spikes.
- **Image normalisation** — resize to the provider's optimum (usually ~1024px long edge), strip EXIF including GPS before it leaves our infrastructure.

Keep it boring: one endpoint for identify, one for diagnose, one for care-DB deltas, one for the correction log. No user accounts, no passwords, no PII if we can avoid it.

### Unit economics — check this before writing the paywall

Vision APIs bill per call. At 7 free IDs/day, one enthusiastic free user can cost more per month than a subscriber pays. Do the arithmetic with real provider pricing and show me the numbers, then we tune. Mitigations already in the design: on-device pre-flight rejection, perceptual-hash cache, aggressive downscaling, disease module only on explicit request, daily cap *and* a rolling 30-day cap, and the free tier not including the expensive disease endpoint. Track cost-per-DAU and cost-per-paid-conversion as first-class metrics from day one, because Apple Search Ads will multiply whatever that number is.

---

## 7. Making it feel like it cost millions

The brief: *this must not look like a template.* Before building any UI, write `DESIGN.md` with a proposed direction and wait for my sign-off.

### 7.1 Design direction (you propose, I approve)

Give me a compact token system: 5–6 named hex values, the typefaces and their roles, a type scale, the spacing grid, the motion vocabulary, and 3–4 principles specific to *this* product. Include ASCII wireframes for scan, result and My Plants. Ground it in the subject: botanical illustration, herbaria, field guides, nurseries, soil and glass and green — there's a deep visual well here. Use it.

Then critique your own plan: if any part of it is what you'd produce for any app, replace that part and tell me what you changed. Specifically avoid the current generated-app tells — cream #F4F1EA backgrounds with a terracotta accent, near-black with one acid accent, everything chopped into identical rounded cards with the same soft grey shadow, ALL-CAPS eyebrow labels over every heading, gradient washes as decoration, "→" glued onto button labels.

**Spend the boldness in one place.** My instinct: the plant photography is the hero and everything around it is quiet and disciplined. But argue for something better if you have it.

### 7.2 The craft details that separate premium from vibe-coded

- **Zero raw values in views.** No hex, no magic numbers. `Color.leaf`, `Spacing.md`, `Motion.springStandard`. Enforced by review.
- **Type set properly.** A real scale, deliberate weights, tracking adjusted at display sizes (SF Pro at default tracking in a 34pt headline is a tell). Dynamic Type honoured — test to accessibility XXL and fix the clipping, don't cap the scale.
- **One motion vocabulary.** Two or three springs used everywhere, not a different animation per screen. `matchedGeometryEffect` for the photo carrying from capture into result — one orchestrated moment, not fade-and-slide on every element. Respect `reduceMotion`.
- **Haptics as a language.** Capture = light impact. Confident result = success. Low confidence = nothing (don't buzz "sorry"). Save = light. Destructive = warning. Consistent, sparse, meaningful.
- **Skeletons, never spinners**, and optimistic UI on saves.
- **Designed empty states.** "No plants yet" is a chance to invite an action, with a real illustration. Errors state what happened and what to do, in the product's voice, without apologising.
- **60fps everywhere.** Image decoding and thumbnail generation off the main thread, downsampled at decode time. Never load a 12MP image into a 120pt grid cell.
- **Launch continuity** — icon → launch screen → first frame should feel like one object opening, not three assets.
- **Copy is design.** Sentence case, plain verbs, active voice, no filler. The same action keeps the same name through the whole flow: a "Save" button produces a "Saved" toast. Write every string as if a person wrote it.
- **Dark mode designed, not derived.** Photos read very differently on dark; the greens need separate values, not an automatic inversion.
- **Localisation-ready from day one.** String Catalog, no concatenated sentences, no fixed-width text containers. English-only at launch, but German/French/Spanish are where the second wave of revenue is and retrofitting is miserable.

### 7.3 Non-negotiable quality bar

- Cold launch to interactive camera < 1.2s on an iPhone 13.
- Capture → result, P50 < 3s on good network.
- No force unwraps, no `try!`, no `fatalError` on any path a user can reach.
- `@MainActor` discipline; no data races; strict concurrency clean.
- Every logic type unit-tested. Snapshot tests on scan/result/paywall/My Plants, light and dark, default and XXL type. XCUITest covering: onboarding → first scan → result → save, and the full paywall purchase flow against StoreKit Testing.
- Instruments pass before each phase ships: no leaks, no unbounded memory growth scrolling a 200-plant grid, camera session correctly released on background.
- VoiceOver: every control labelled, every result screen readable end to end without sight. Contrast ≥ 4.5:1. This is both right and a reviewable App Store consideration.
- Offline: My Plants, care cards for saved plants, journal, reminders all work in airplane mode. Scans queue with a clear pending state.

---

## 8. Features I want that PictureThis doesn't do well

Phase 2/3, but design the data model so they don't require a rewrite.

1. **Photo journal + growth timeline.** Every plant accumulates dated photos; generate a time-lapse. This is the retention feature *and* the shareable one — a 6-month growth time-lapse is native social content that markets the app for free.
2. **Low-confidence escalation.** When we're "Not sure", offer to send it to a human expert queue and answer within 24h (a premium perk, and a genuinely defensible one). Start with me answering them manually — at low volume that's fine, and it directly converts the "it's inaccurate" complaint into "they told me they weren't sure and then got me the right answer."
3. **Camera light meter.** Estimate lux from `AVCaptureDevice` exposure/ISO. "This spot is medium-low light — your monstera would prefer the window 2m to the left." Cheap to build, feels like magic, and makes care advice specific.
4. **Pet/child toxicity mode.** Set it once in onboarding; then toxicity is surfaced everywhere, badged in the grid, warned about on save. The named complaint is that this is buried. Make it a first-class trust feature and mention it in the App Store screenshots.
5. **Seedling and grass modes.** Explicitly handle the two categories PictureThis is worst at. Seedlings get a "too early to tell, here's what to look for as it grows, remind me in 2 weeks" flow. Lawn weeds get a regional weed database. Both are highly searched and currently badly served.
6. **Smart reminders that aren't nagging.** Season-aware, skippable, "I watered it" from the notification itself, and they adapt if the user consistently waters later than we suggest. **Do not put basic reminders behind the paywall** — that's the locked-feature complaint. Premium gets advanced scheduling, fertilising/repotting cycles, and multi-plant routines.
7. **App Intents / Siri / Shortcuts / widgets.** "Hey Siri, log watering for the fiddle leaf." Home-screen widget with what needs water today. Lock Screen widget. Spotlight indexing of the user's plants. This is a small amount of work that reads as deep platform integration, which is exactly what "premium" looks like on iOS.
8. **Beautifully designed shareable plant cards.** Photo, name, care summary, subtle attribution. A viral loop that costs nothing per install.
9. **"What should I put here?"** Point the camera at an empty spot, get a light reading, get plant suggestions that will actually survive there. Nobody does this. It's a hook for the first TikTok.
10. **Apple Watch quick log**, later.

---

## 9. Monetisation — the honest paywall

RevenueCat, remote-configured Paywalls so I can iterate copy and price without a build.

- **Free:** 7 IDs/day, full basic care cards, My Plants unlimited, basic watering reminders. No account, no card.
- **Premium:** unlimited IDs, disease diagnosis + treatment plans, expert escalation, advanced care and seasonal scheduling, full offline care library, journal time-lapses, widgets.
- **Price:** £4.99/$4.99 monthly, £29.99/$34.99 annual, 7-day trial on annual. Also offer a **no-trial monthly** so people who hate trials can just buy. Localised pricing via App Store tiers from launch.

### Rules that make it "honest" — treat as product requirements, not nice-to-haves

- Price, period and renewal date shown **before** the trial starts, in plain text, not in a footnote.
- A local notification **2 days before the trial converts**, saying what will be charged and how to cancel. This will cost us some conversions and win us the reviews that define the brand. Ship it.
- Visible close button on every paywall, from the first frame. No 3-second delay, no tiny grey X.
- No fake countdowns, no fake discounts, no "97% off today only", no blur-teasing content the user has already earned.
- "Manage subscription" in Settings, top level, deep-linking to Apple's page. Plus a one-tap "How do I cancel?" that actually explains it.
- Paywall must include the required links (terms, privacy) and full subscription disclosure — App Store Review Guideline 3.1.2 rejects builds that don't.
- Never gate a result the user already spent a credit on.
- When a free user hits the daily cap: tell them exactly when it resets, and let them keep using everything else.

Instrument the funnel: install → onboarding complete → first scan → first result → save → paywall view → trial start → trial conversion → D1/D7/D30 retention → churn reason. Then we tune with data instead of vibes. Run the paywall as a RevenueCat experiment from week one.

---

## 10. Legal, privacy, App Store

- `PrivacyInfo.xcprivacy` privacy manifest, with required-reason API declarations, and matching App Privacy answers in App Store Connect. Mismatches get builds rejected.
- Camera and photo library permission strings that explain the benefit in the user's language, requested at the moment of use, never at launch.
- Strip EXIF/GPS from images before upload. Say so in the privacy policy — it's a differentiator.
- Data deletion and export in Settings even though we have no accounts.
- **Toxicity and health disclaimers:** clear, non-panicky, with "if a pet or child has eaten this, contact a vet or poison control" and a link. Never phrase toxicity data as medical advice. Same for disease: "this is guidance, not a plant pathology lab."
- Third-party provider terms — check whether the ID provider's licence permits our commercial redistribution of results and whether reference images can be displayed. Verify before building UI that depends on them.
- Trademark check on the final name before I spend a penny on ads. Note: **"Leafly" is an existing US cannabis company with registered marks — do not use it.** "PlantSnap", "Flora", "Folia" and "Planta" are all live apps in or adjacent to this category. From my list, **Verdure**, **FloraScan** and **Rootwise** look cleanest, but tell me to get a real clearance search before filing.

---

## 11. Build order

**Phase 0 — 3–5 days.** Provider evaluation harness and the 100-photo benchmark (§3.1). Unit-economics model. Trademark/domain/App Store name check. `DESIGN.md`. Repo, module skeleton, CI to TestFlight with a hello-world build. *Do this before writing app code.* If the provider accuracy on grasses and seedlings is no better than PictureThis, the whole positioning changes and I need to know in week one, not month three.

**Phase 1 — MVP.** Onboarding, camera with pre-flight, proxy, identification, honest result screen with confidence and alternatives, care cards for the seeded species set, My Plants with easy editing, Settings, RevenueCat + paywall, quota enforcement, offline behaviour, analytics, crash reporting, full test and accessibility pass. Ship to TestFlight, get 20 real testers, watch 5 of them use it without helping them.

**Phase 2 — differentiation.** Diagnosis with questionnaire and treatment plans with follow-up, photo journal, smart reminders, expert escalation queue, shareable cards, correction-feedback loop.

**Phase 3 — retention and growth.** Widgets, App Intents/Siri, light meter, "what should I put here", time-lapse export, seedling and grass modes, localisation, Watch.

---

## 12. Things I will judge you on

1. Did you tell me when I was wrong, or did you just build what I asked?
2. Does the honest-confidence promise hold everywhere, including when it costs us a conversion?
3. Could another engineer join and ship a feature in week one?
4. Does it feel like one person with taste made every decision, or like a template with a plant theme?
5. Is there a single line of fake, stubbed or placeholder code in the shipped app?
