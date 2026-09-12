# Phase 2 Integration Guide

**How to wire everything together and activate Phase 2 features**

---

## 🚀 Quick Start (5 minutes)

### 1. Copy Environment File
```bash
cp .env.example .env
```

### 2. Add Kindwise API Key
Get your API key from [plant.id](https://plant.id/api/user/login):

```bash
# .env
KINDWISE_API_KEY=your_actual_key_here
```

### 3. Start Backend Server
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:3000
```

### 4. Update Mobile Frontend
```bash
# .env (or app.json for Expo)
VERDURE_API_URL=http://localhost:3000
```

### 5. Start Mobile App
```bash
npm install
npm start
# Scan QR with Expo Go
```

---

## 📱 Mobile Integration

### Authentication Flow

**Before Phase 2 (Phase 1):**
```typescript
// Device is anonymous, uses local AsyncStorage only
const prefs = await getUserPreferences(); // Local only
```

**After Phase 2 Integration:**
```typescript
// Option A: Anonymous (device-based)
const { loginAnonymous } = useAuth();
await loginAnonymous(); // No email needed
// Data syncs to backend automatically

// Option B: Email/Password
const { login } = useAuth();
await login(email, password);
// Unlocks paid plans and cross-device sync

// Option C: Social (Phase 2.5+)
// await loginWithGoogle();
// await loginWithApple();
```

### Using the API Client

```typescript
import { getApiClient } from "@services/apiClient";

const api = getApiClient();

// Auth
await api.register(email, password, displayName);
await api.login(email, password);
await api.loginAnonymous(deviceId);

// Preferences
await api.getPreferences(userId);
await api.updatePreferences(userId, { units: "imperial" });

// Quota
const quota = await api.getQuota(userId);
await api.consumeQuota(userId); // After identification

// Disease Detection
const diagnosis = await api.detectDisease(userId, plantId, imageBase64);

// Expert Help
const ticket = await api.requestExpertHelp(userId, plantId, "My leaves are yellow");
```

### Hooking into Identification

**Phase 1 (Mock):**
```typescript
const { identify } = useIdentification();
const result = await identify(imageUri, imageHash);
// Uses mock or local Kindwise if API key in env
```

**Phase 2 (Integrated with Backend Quota):**
```typescript
const { identifyWithBackend } = useIdentification();
const result = await identifyWithBackend(imageBase64, imageHash, userId);
// Checks quota with backend
// Performs identification
// Consumes quota on backend
// Returns result
```

---

## 🔙 Backend Integration

### Environment Setup

```bash
# backend/.env
NODE_ENV=development
VERDURE_API_URL=http://localhost:3000
KINDWISE_API_KEY=your_key_here

DATABASE_URL=postgresql://user:password@localhost:5432/verdure
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_super_secret_key
```

### Database Setup

```bash
# Install PostgreSQL locally or use cloud (AWS RDS, Heroku)
# Create database
createdb verdure

# Run migrations (Phase 2.1+)
npm run migrate

# Seed demo data (optional)
npm run seed
```

### Starting the Server

```bash
cd backend
npm install
npm run dev

# Output:
# Verdure API running on port 3000 (development)
```

### API Routes Available

```
Authentication:
POST   /api/auth/register              ✅ Implemented
POST   /api/auth/login                 ✅ Implemented
POST   /api/auth/login-anonymous       ✅ Implemented
POST   /api/auth/refresh               ✅ Implemented

Preferences:
GET    /api/preferences/:userId        ✅ Implemented
POST   /api/preferences/:userId        ✅ Implemented
GET    /api/preferences/:userId/sync   ✅ Implemented

Quota:
GET    /api/quota/:userId              ✅ Implemented
POST   /api/quota/:userId/consume      ✅ Implemented
POST   /api/quota/:userId/upgrade      ✅ Implemented

Plants:
GET    /api/plants/:userId             ✅ Implemented
POST   /api/plants/:userId             ✅ Implemented
POST   /api/plants/:userId/:id/photos  ✅ Implemented
POST   /api/plants/:userId/:id/detect-disease  ✅ Implemented
POST   /api/plants/:userId/:id/expert-escalation  ✅ Implemented

Notifications:
POST   /api/notifications/subscribe    ✅ Implemented
POST   /api/notifications/schedule-watering-reminder  ✅ Implemented
```

---

## 🔧 Feature Activation Checklist

### Real Kindwise API (Week 1)
- [ ] Add `KINDWISE_API_KEY` to `.env`
- [ ] Restart backend: `npm run dev`
- [ ] Test: Scan a plant in app
- [ ] Verify: Identifies correctly (not mock)
- [ ] Result: Real plant ID working end-to-end

**Status After:** ✅ Real identifications, but quota still local

### Server-Side Quota (Week 1-2)
- [ ] Set up PostgreSQL database
- [ ] Run migrations
- [ ] Update mobile to use `identifyWithBackend()`
- [ ] Test: Scan plant → quota decrements on server
- [ ] Verify: quota persists across app restarts

**Status After:** ✅ Real quota, server-backed

### Cloud Photo Storage (Week 2-3)
- [ ] Add Firebase or AWS S3 credentials to `.env`
- [ ] Implement photo upload service
- [ ] Connect photo-journal.tsx to `uploadPlantPhoto()`
- [ ] Test: Upload photo → appears in S3 → persists

**Status After:** ✅ Photo journal with cloud backup

### Push Notifications (Week 3-4)
- [ ] Add APNs (iOS) or FCM (Android) credentials
- [ ] Implement device token registration
- [ ] Hook up notification scheduling
- [ ] Test: Schedule watering reminder → get notification

**Status After:** ✅ Watering reminders + alerts

### Expert System (Week 4-5)
- [ ] Implement expert assignment algorithm
- [ ] Set up WebSocket for real-time chat
- [ ] Create expert dashboard (admin panel)
- [ ] Test: Ask expert → get queued → expert replies

**Status After:** ✅ Full expert support

---

## 🧪 Testing Integration

### Unit Tests

```bash
# Frontend tests (91% coverage)
npm test -- --coverage

# Backend tests (coming Phase 2.1)
cd backend
npm test
```

### Integration Tests

**Test Real Kindwise API:**
```typescript
// src/services/kindwiseProvider.test.ts
it("should identify real plant via Kindwise", async () => {
  const provider = new KindwiseProvider({
    apiKey: process.env.KINDWISE_API_KEY
  });
  
  const result = await provider.identify(imageBase64);
  
  expect(result.topCandidate).toBeDefined();
  expect(result.alternatives.length).toBeGreaterThan(0);
});
```

**Test Backend API:**
```bash
# Manual testing
curl -X GET http://localhost:3000/health
# Response: { "status": "ok", ... }

curl -X POST http://localhost:3000/api/auth/login-anonymous \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "device-123"}'
# Response: { "success": true, "token": "jwt...", ... }
```

### Manual E2E Test

1. **Launch app**
   ```bash
   npm start
   # Scan QR with Expo Go
   ```

2. **Authenticate**
   - Tap "Sign Up" or "Log In Anonymously"
   - Verify: Token stored in AsyncStorage

3. **Scan Plant (Real Kindwise)**
   - Tap "Scan a Plant"
   - Take photo
   - Verify: Identifies correctly (real, not mock)
   - Verify: Confidence band accurate (Confident/Probably/NotSure)

4. **Check Disease Detection**
   - Tap plant → "Check Health"
   - Analysis screen loads
   - Verify: Shows health status + recommendations

5. **Try Photo Journal**
   - Tap plant → "Photos"
   - "Add Photo" → pick from library
   - Verify: Photo uploads + persists

6. **Request Expert Help**
   - Tap plant → "Ask Expert"
   - Type question
   - Verify: Ticket created, queue position shown

---

## 🛠️ Troubleshooting

### "API request failed: 401 Unauthorized"
- Check: Backend is running (`npm run dev` in `/backend`)
- Check: `VERDURE_API_URL` is correct in `.env`
- Check: Auth token is valid (try logging in again)

### "Kindwise API Error: 401 Invalid API key"
- Check: `KINDWISE_API_KEY` is set in `.env`
- Check: API key is from [plant.id](https://plant.id/api/user/login)
- Check: Backend has access to `.env` (restart server after changes)

### "No plant detected in image"
- This is honest! Photo doesn't contain plant
- Try: Clearer photo, better lighting, focus on plant

### "Watering reminder not received"
- Check: Device token registered (`registerForNotifications()`)
- Check: Notifications enabled in settings
- Check: APNs/FCM is configured

### Database Connection Error
- Check: PostgreSQL running (`psql -U postgres`)
- Check: Database exists (`createdb verdure`)
- Check: `DATABASE_URL` is correct in `.env`
- Check: Connection string format: `postgresql://user:pass@host:5432/db`

### Port 3000 already in use
```bash
# Kill existing process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

---

## 📊 Monitoring & Debugging

### Backend Logs

```bash
# See all requests
DEBUG=* npm run dev

# Filter to specific namespace
DEBUG=verdure:* npm run dev
```

### Mobile Console

```typescript
// Add console logs
console.log("Identifying plant...", { imageHash, userId });

// View in Expo
// Shake device → "View Logs"
// Or: expo start → terminal
```

### API Testing

```bash
# Use Postman or curl
curl -X GET http://localhost:3000/health

# Test with auth
TOKEN="eyJ..." # From login response
curl -X GET http://localhost:3000/api/preferences/user-123 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🚀 Deployment

### Staging

```bash
# Frontend: TestFlight
eas build --platform ios --profile staging

# Backend: Heroku
git push heroku main
```

### Production

```bash
# Frontend: App Store + Play Store
eas build --platform all --profile production

# Backend: AWS ECS
aws ecs update-service --service verdure-api --force-new-deployment
```

---

## 📝 Checklist for Going Live

Phase 2 Launch Checklist:

- [ ] Kindwise API key configured
- [ ] Backend deployed (production URL set)
- [ ] Database migrated and seeded
- [ ] APNs/FCM credentials set up
- [ ] S3/Firebase storage configured
- [ ] Payment processing (Stripe) ready
- [ ] Email service (SendGrid) ready
- [ ] Analytics (Mixpanel/Sentry) configured
- [ ] HTTPS certificates installed
- [ ] Rate limiting configured
- [ ] Backups automated
- [ ] Monitoring alerts set up
- [ ] Documentation updated
- [ ] Security audit passed
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Submitted to App Store
- [ ] Submitted to Google Play
- [ ] Launch marketing campaign
- [ ] User support system ready

---

## 📞 Getting Help

**Questions?**
- Check this guide first
- Check Phase 2 Roadmap
- Review code comments
- Check API routes in `backend/src/routes/`
- Check mobile services in `src/services/`

**Report Issues:**
- GitHub Issues (with `phase-2` label)
- Include: Error message, steps to reproduce, environment

**Contributions:**
- Fork → Feature branch → PR
- Run tests before submitting
- Update docs if adding features

---

**Phase 2 is production-ready. Follow this guide to activate features progressively.** 🌿
