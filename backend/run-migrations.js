/**
 * Migration Runner
 * Reads SQL migration files and executes them against Supabase
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL not found in .env file');
    process.exit(1);
  }

  console.log('🚀 Starting migrations...');
  console.log(`📍 Database: ${connectionString.split('@')[1]}`);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  });

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_init_schema.sql');

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Connect to database
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Execute migration
    console.log('⏳ Running migrations...');
    await client.query(sql);

    client.release();
    console.log('✅ Migrations completed successfully!');
    console.log('📊 Database tables created:');
    console.log('   • users');
    console.log('   • user_preferences');
    console.log('   • user_stats');
    console.log('   • plants');
    console.log('   • photos');
    console.log('   • water_logs');
    console.log('   • diagnoses');
    console.log('   • expert_tickets');
    console.log('   • messages');
    console.log('   • watering_reminders');
    console.log('   • subscriptions');
    console.log('   • identifications');
    console.log('   • audit_logs');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
