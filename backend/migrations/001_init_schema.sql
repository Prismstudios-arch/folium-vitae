-- Verdure Phase 2 Database Schema
-- PostgreSQL migrations
-- Run with: psql verdure < migrations/001_init_schema.sql

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255),
  display_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(512),
  plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'premium')),
  quota_used_today INTEGER DEFAULT 0,
  last_quota_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR(255),
  notification_token VARCHAR(512),
  revenueCat_subscriber_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_revenueCat ON users(revenueCat_subscriber_id);

-- User preferences
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  units VARCHAR(20) DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  hemisphere VARCHAR(20) DEFAULT 'north' CHECK (hemisphere IN ('north', 'south')),
  has_children_or_pets BOOLEAN DEFAULT FALSE,
  show_toxicity_warnings BOOLEAN DEFAULT TRUE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  notification_time VARCHAR(5) DEFAULT '09:00',
  language VARCHAR(10) DEFAULT 'en',
  theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- User stats
CREATE TABLE user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_scans INTEGER DEFAULT 0,
  total_plants INTEGER DEFAULT 0,
  total_photos INTEGER DEFAULT 0,
  total_diagnoses INTEGER DEFAULT 0,
  expert_questions_asked INTEGER DEFAULT 0,
  first_scan_date TIMESTAMP,
  last_scan_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plants
CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scientific_name VARCHAR(255) NOT NULL,
  common_names TEXT[],
  nickname VARCHAR(255),
  location VARCHAR(255),
  notes TEXT,
  acquisition_date TIMESTAMP,
  identification_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_plants_user_id ON plants(user_id);
CREATE INDEX idx_plants_scientific_name ON plants(scientific_name);

-- Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  url VARCHAR(512) NOT NULL,
  thumbnail_url VARCHAR(512),
  caption TEXT,
  date TIMESTAMP,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_photos_plant_id ON photos(plant_id);

-- Water logs
CREATE TABLE water_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  amount VARCHAR(50) CHECK (amount IN ('light', 'moderate', 'heavy')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_water_logs_plant_id ON water_logs(plant_id);
CREATE INDEX idx_water_logs_date ON water_logs(date DESC);

-- Diagnoses
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  is_healthy BOOLEAN DEFAULT TRUE,
  confidence NUMERIC(3,2),
  diseases TEXT[],
  recommendations TEXT[],
  detected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diagnoses_plant_id ON diagnoses(plant_id);

-- Expert tickets
CREATE TABLE expert_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved')),
  expert_id UUID REFERENCES users(id) ON DELETE SET NULL,
  position_in_queue INTEGER,
  estimated_wait_time VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_tickets_user_id ON expert_tickets(user_id);
CREATE INDEX idx_tickets_status ON expert_tickets(status);
CREATE INDEX idx_tickets_expert_id ON expert_tickets(expert_id);

-- Messages (expert chat)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES expert_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  attachment_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX idx_messages_author_id ON messages(author_id);

-- Watering reminders
CREATE TABLE watering_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  frequency VARCHAR(50) CHECK (frequency IN ('daily', 'weekly', 'custom')),
  days_interval INTEGER DEFAULT 7,
  next_reminder_date TIMESTAMP NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_user_id ON watering_reminders(user_id);
CREATE INDEX idx_reminders_plant_id ON watering_reminders(plant_id);
CREATE INDEX idx_reminders_next_date ON watering_reminders(next_reminder_date);

-- Subscriptions (RevenueCat integration)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  revenueCat_subscription_id VARCHAR(255) UNIQUE,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'pro', 'premium')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled', 'pending')),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,
  auto_renewal BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_revenueCat ON subscriptions(revenueCat_subscription_id);

-- Identification history
CREATE TABLE identifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_hash VARCHAR(255),
  top_candidate_scientific_name VARCHAR(255),
  confidence_band VARCHAR(50),
  raw_score NUMERIC(3,2),
  alternatives TEXT[],
  identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_identifications_user_id ON identifications(user_id);

-- Audit log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255),
  entity_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plants_updated_at BEFORE UPDATE ON plants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watering_reminders_updated_at BEFORE UPDATE ON watering_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default user preferences when user is created
CREATE OR REPLACE FUNCTION create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id) VALUES (NEW.id);
  INSERT INTO user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_user_prefs_trigger AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_user_preferences();
