# Verdure Phase 2: Advanced Features & Real API Integration

**Status:** In Progress  
**Timeline:** Weeks 1-12 (estimated)  
**Focus:** Real Kindwise API, Disease Detection, Photo Journal, Expert Support

---

## 🎯 Phase 2 Objectives

1. **Real Plant Identification API** — Replace mock with real Kindwise service
2. **Disease Detection & Diagnosis** — Identify plant health issues
3. **Photo Journal** — Track plant growth over time
4. **Expert Escalation** — Connect users with plant experts
5. **Push Notifications** — Watering reminders and alerts
6. **Server Synchronization** — Cloud backup of preferences and plants

---

## 📱 Mobile Features (Phase 2)

### 1. Real Kindwise API Integration

**File:** `src/services/kindwiseProvider.ts`

**Features:**
- ✅ Real plant identification API calls
- ✅ Confidence calibration (Confident/Probably/NotSure)
- ✅ Top 5 candidate results
- ✅ Automatic fallback to mock if API unavailable
- ✅ Disease detection support
- ✅ Feedback loop for model improvement

**Status:** ✅ Implemented

**Environment Variables:**
```bash
KINDWISE_API_KEY=your_api_key_here
KINDWISE_API_SECRET=optional_secret
KINDWISE_BASE_URL=https://plant.id/api/v3
```

**Usage:**
```typescript
const provider = new KindwiseProvider({ apiKey: process.env.KINDWISE_API_KEY });
const result = await provider.identify(imageBase64);
```

---

### 2. Disease Detection

**File:** `app/disease-detection.tsx`

**Features:**
- 📸 Photo capture for disease analysis
- 🔍 Disease detection via Kindwise API
- 📋 Detailed diagnosis results
- 💡 Care recommendations
- 🚨 Severity levels (mild, moderate, severe)
- 👨‍⚕️ Expert escalation from diagnosis

**Status:** ✅ UI Complete, Backend Integration Pending

**Screens:**
1. Analysis screen (take photo)
2. Results screen (disease list, recommendations)
3. Expert help button

**Next Steps:**
- [ ] Connect to Kindwise API
- [ ] Store diagnosis history
- [ ] Create diagnosis comparison view

---

### 3. Photo Journal

**File:** `app/photo-journal.tsx`

**Features:**
- 📷 Multi-photo per plant (vs. single photo in Phase 1)
- 📅 Date-based organization
- 💬 Photo captions
- 🗑️ Photo deletion
- 📈 Visual growth tracking
- ☁️ Cloud backup

**Status:** ✅ UI Complete, Backend Integration Pending

**Screens:**
1. Photo grid (2-column layout)
2. Photo detail (full screen view)
3. Add photo flow (pick, caption, upload)

**Storage:**
- Local: SQLite (fast access)
- Cloud: S3 or Firebase Storage (backup)

**Next Steps:**
- [ ] Connect to cloud storage
- [ ] Implement sync on app startup
- [ ] Add photo filters/editing

---

### 4. Expert Escalation

**File:** `app/expert-escalation.tsx`

**Features:**
- 💬 Real-time chat with plant experts
- ⏳ Queue position tracking
- 👤 Expert assignment and profiles
- 📝 Message history
- 🔔 Notifications for expert replies

**Status:** ✅ UI Complete, Backend Integration Pending

**Screens:**
1. Queue status (while waiting)
2. Chat interface (message thread)
3. Expert info card

**Expert Matching:**
- By specialty (houseplants, vegetables, etc.)
- By language
- By availability

**Pricing:**
- Free: 1 expert question/month
- Pro: 5 expert questions/month
- Premium: Unlimited expert access

**Next Steps:**
- [ ] Implement expert assignment system
- [ ] WebSocket for real-time chat
- [ ] Expert dashboard

---

### 5. Push Notifications

**Status:** 🚧 In Design Phase

**Features:**
- 🌊 Watering reminders (frequency-based)
- 🎉 Milestone notifications (growth, achievements)
- 📰 Feature announcements
- 🚨 Health alerts (disease detected)

**Platforms:**
- iOS: APNs (Apple Push Notification service)
- Android: FCM (Firebase Cloud Messaging)

**Schema:**
```typescript
interface Notification {
  id: string;
  userId: string;
  type: "watering" | "milestone" | "alert" | "announcement";
  title: string;
  body: string;
  plantId?: string;
  actionUrl?: string;
  scheduledFor: Date;
  sent: boolean;
}
```

**Next Steps:**
- [ ] Set up APNs and FCM credentials
- [ ] Create notification scheduling service
- [ ] Build notification preferences UI

---

### 6. Server Synchronization

**Status:** 🚧 In Design Phase

**Features:**
- ☁️ Preferences sync across devices
- 📱 Plant collection sync
- 📷 Photo backup
- 🔄 Delta sync (only changed fields)
- 🔐 End-to-end encryption

**Sync Strategy:**
1. Detect changes locally
2. Upload in batches
3. Merge server state
4. Update local cache
5. Handle conflicts (last-write-wins)

**Next Steps:**
- [ ] Implement sync service
- [ ] Add conflict resolution
- [ ] Create sync status UI

---

## 🔙 Backend Features (Phase 2)

### Backend Stack

**Framework:** Express.js + TypeScript  
**Database:** PostgreSQL (primary) + Redis (cache)  
**Authentication:** JWT + RefreshToken pattern  
**File Storage:** AWS S3 or Firebase Storage  
**Notifications:** Firebase Cloud Messaging, APNs

**Structure:**
```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts           ✅ Registration, login, JWT refresh
│   │   ├── preferences.ts    ✅ Preferences sync
│   │   ├── quota.ts          ✅ Quota management, plan upgrades
│   │   ├── notifications.ts  ✅ Push notification setup
│   │   └── plants.ts         ✅ Plant collection, photos, diagnosis
│   ├── middleware/
│   │   ├── auth.ts           (Next)
│   │   └── rateLimiting.ts   (Next)
│   ├── services/
│   │   ├── kindwise.ts       (Next) - API proxy
│   │   ├── notifications.ts  (Next) - APNs/FCM
│   │   └── email.ts          (Next) - SendGrid
│   └── index.ts              ✅ Express app
```

### API Endpoints (Phase 2)

**Authentication**
```
POST   /api/auth/register              # Email/password signup
POST   /api/auth/login                 # Email/password login
POST   /api/auth/login-anonymous       # Device ID login (Phase 1)
POST   /api/auth/refresh               # JWT refresh
POST   /api/auth/logout                # Logout
POST   /api/auth/password-reset        # Forgot password
```

**Preferences**
```
GET    /api/preferences/:userId        # Get all preferences
POST   /api/preferences/:userId        # Update preferences
GET    /api/preferences/:userId/sync   # Delta sync
```

**Quota & Plans**
```
GET    /api/quota/:userId              # Current quota
POST   /api/quota/:userId/consume      # Use a scan credit
POST   /api/quota/:userId/upgrade      # Upgrade to paid plan
GET    /api/quota/pricing              # Get available plans
```

**Plants**
```
GET    /api/plants/:userId             # Get collection
POST   /api/plants/:userId             # Create plant
GET    /api/plants/:userId/:plantId    # Get plant
PUT    /api/plants/:userId/:plantId    # Update plant
DELETE /api/plants/:userId/:plantId    # Delete plant

POST   /api/plants/:userId/:plantId/photos              # Add photo
POST   /api/plants/:userId/:plantId/water-log           # Log watering
POST   /api/plants/:userId/:plantId/detect-disease      # Diagnose
POST   /api/plants/:userId/:plantId/expert-escalation   # Ask expert
```

**Notifications**
```
POST   /api/notifications/subscribe                         # Register device
POST   /api/notifications/unsubscribe                       # Unregister
POST   /api/notifications/schedule-watering-reminder        # Schedule reminder
GET    /api/notifications/:userId/history                  # Notification log
POST   /api/notifications/send-test                        # Test notification
```

---

## 🗄️ Database Schema (Phase 2)

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  phone VARCHAR,
  passwordHash VARCHAR,
  displayName VARCHAR,
  avatar VARCHAR,
  plan VARCHAR DEFAULT 'free',
  quotaUsedToday INT DEFAULT 0,
  lastQuotaReset TIMESTAMP,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  deletedAt TIMESTAMP
);
```

### Plants Table
```sql
CREATE TABLE plants (
  id UUID PRIMARY KEY,
  userId UUID REFERENCES users(id),
  scientificName VARCHAR,
  commonNames TEXT[],
  nickname VARCHAR,
  location VARCHAR,
  notes TEXT,
  acquisitionDate TIMESTAMP,
  identificationDate TIMESTAMP,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  deletedAt TIMESTAMP
);
```

### Photos Table
```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY,
  plantId UUID REFERENCES plants(id),
  url VARCHAR,
  thumbnailUrl VARCHAR,
  caption TEXT,
  date TIMESTAMP,
  uploadedAt TIMESTAMP,
  createdAt TIMESTAMP,
  deletedAt TIMESTAMP
);
```

### Diagnoses Table
```sql
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY,
  plantId UUID REFERENCES plants(id),
  isHealthy BOOLEAN,
  confidence NUMERIC,
  diseases TEXT[],
  recommendations TEXT[],
  detectedAt TIMESTAMP,
  createdAt TIMESTAMP
);
```

### Expert Tickets Table
```sql
CREATE TABLE expert_tickets (
  id UUID PRIMARY KEY,
  userId UUID REFERENCES users(id),
  plantId UUID REFERENCES plants(id),
  status VARCHAR DEFAULT 'pending',
  expertId UUID REFERENCES users(id),
  position INT,
  estimatedWaitTime VARCHAR,
  createdAt TIMESTAMP,
  resolvedAt TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  ticketId UUID REFERENCES expert_tickets(id),
  authorId UUID REFERENCES users(id),
  text TEXT,
  attachmentUrl VARCHAR,
  createdAt TIMESTAMP
);
```

---

## 🔄 Pricing Model (Phase 2)

### Plans

| Feature | Free | Pro | Premium |
|---------|------|-----|---------|
| Scans/day | 7 | 50 | Unlimited |
| Plant database | Basic (50) | Advanced (500+) | Expert (1000+) |
| Disease detection | ❌ | ✅ | ✅ |
| Photo journal | ✅ | ✅ | ✅ |
| Expert questions/month | 1 | 5 | Unlimited |
| Priority support | ❌ | ❌ | ✅ |
| No ads | ❌ | ✅ | ✅ |
| Cost | Free | $4.99/mo | $9.99/mo |

### Payment Processing
- Stripe for credit card processing
- RevenueCat for subscription management
- Apple In-App Purchase (iOS)
- Google Play Billing (Android)

---

## 📊 Analytics & Monitoring (Phase 2)

**Events to Track:**
- User registration (source: referrer)
- First scan completed
- Plan upgrade
- Plant added to collection
- Disease detected
- Expert question asked
- Watering log entry

**Dashboards:**
- User growth (signups, DAU, MAU)
- Feature adoption (scans, diagnosis, experts)
- Revenue (plan subscriptions)
- Support (expert response times)

**Tools:**
- Firebase Analytics / Mixpanel
- Sentry for error tracking
- LogRocket for session replay (select users)

---

## 📝 Implementation Timeline

### Week 1-2: API Integration
- [ ] Kindwise API authentication
- [ ] Real identification service
- [ ] Disease detection integration
- [ ] Fallback and error handling

### Week 3-4: User Accounts
- [ ] User registration/login
- [ ] JWT token management
- [ ] Password reset flow
- [ ] Social login (optional)

### Week 5-6: Photo & Diagnosis
- [ ] Photo upload to cloud storage
- [ ] Photo gallery UI polish
- [ ] Diagnosis storage and history
- [ ] Comparison view (before/after)

### Week 7-8: Notifications
- [ ] APNs/FCM setup
- [ ] Notification scheduling
- [ ] Watering reminders
- [ ] Notification preferences UI

### Week 9-10: Expert Support
- [ ] Expert assignment system
- [ ] WebSocket for real-time chat
- [ ] Message history retrieval
- [ ] Expert dashboard (admin)

### Week 11-12: Polish & Testing
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] App Store submission prep

---

## 🚀 Deployment Strategy

### Staging Environment
```
Frontend: Expo for iOS (TestFlight)
Backend: Heroku or AWS RDS + Lambda
Database: PostgreSQL
Cache: Redis
Storage: AWS S3
```

### Production Environment
```
Frontend: App Store + Google Play
Backend: AWS ECS + RDS
Database: PostgreSQL (Multi-AZ)
Cache: ElastiCache
Storage: S3 + CloudFront CDN
Analytics: Firebase + Mixpanel
Monitoring: Sentry + DataDog
```

---

## 📈 Success Metrics (Phase 2)

**User Engagement:**
- DAU: 1,000+ users
- MAU: 5,000+ users
- Scans/user/day: 2+
- Retention (7-day): 40%+

**Feature Adoption:**
- Disease detection: 20%+ of active users
- Photo journal: 15%+ of active users
- Expert questions: 5%+ of users

**Monetization:**
- Plan conversion: 5%+
- ARPU (Average Revenue Per User): $2+
- Churn rate: <5% monthly

---

## 🎯 Post-Phase 2 (Phase 3+)

- 🌍 Web app version
- 🔄 Social features (plant swaps, community)
- 📚 Plant care encyclopedia
- 🎮 Gamification (achievements, streaks)
- 🌱 Seedling & grass detection
- 🤖 AI plant therapist chatbot
- 📊 Garden analytics dashboard

---

**Verdure Phase 2 will transform the app from a basic identifier to a comprehensive plant care platform.** 🌿

Status: Building at full speed. Features rolling out weekly.
