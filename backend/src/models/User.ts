/**
 * User Model
 * Represents a Verdure user with auth, plan, and quota
 */

export interface User {
  id: string;
  email?: string;
  phone?: string;
  passwordHash?: string; // Only for email/password auth
  displayName: string;
  avatar?: string;
  plan: "free" | "pro" | "premium";
  quotaUsedToday: number;
  lastQuotaReset: string; // ISO date
  deviceId?: string; // For anonymous users
  notificationToken?: string; // APNs or FCM
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface UserPreferences {
  userId: string;
  units: "metric" | "imperial";
  hemisphere: "north" | "south";
  hasChildrenOrPets: boolean;
  showToxicityWarnings: boolean;
  notificationsEnabled: boolean;
  notificationTime: string; // HH:MM format
  language: string;
  theme: "light" | "dark" | "system";
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  userId: string;
  totalScans: number;
  totalPlants: number;
  totalPhotos: number;
  totalDiagnoses: number;
  expertQuestionsAsked: number;
  firstScanDate?: string;
  lastScanDate?: string;
  createdAt: string;
  updatedAt: string;
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(user: Omit<User, "id" | "createdAt" | "updatedAt">) {
    // TODO: Hash password if email/password auth
    // TODO: Generate user ID
    // TODO: Insert into database
    // TODO: Create preferences record
    // TODO: Create stats record

    return {
      id: "user-" + Date.now(),
      ...user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string) {
    // TODO: Load from database with preferences and stats
    return null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    // TODO: Query database
    return null;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ) {
    // TODO: Merge and update in database
    return preferences;
  }

  /**
   * Increment quota usage
   */
  async consumeQuota(userId: string) {
    // TODO: Increment quotaUsedToday
    // TODO: Check against plan limit
    // TODO: Return updated quota
  }

  /**
   * Reset quota for new day
   */
  async resetDailyQuota(userId: string) {
    // TODO: Set quotaUsedToday = 0
    // TODO: Update lastQuotaReset = today
  }

  /**
   * Upgrade user plan
   */
  async upgradePlan(userId: string, newPlan: "pro" | "premium") {
    // TODO: Update plan in database
    // TODO: Process payment
    // TODO: Create subscription record
  }
}
