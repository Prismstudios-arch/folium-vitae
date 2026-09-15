import * as SQLite from "expo-sqlite";
import { SavedPlant, PlantPhoto, WaterLog, WaterAmount } from "@domain/plant";
import { generateId } from "@utils/id";
import {
  persistPhoto,
  resolvePhotoUri,
  deletePhotoFile,
  deleteAllPhotoFiles,
} from "./photoStorage";

const DB_NAME = "sorrel.db";

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * The database, opened on first use.
 *
 * There used to be an initializeDatabase() that had to run before anything
 * else — and nothing ever called it. Every function below threw "Database not
 * initialized", so saving a plant, opening My Plants, logging water, the
 * journal, export and delete all failed on every device. Opening lazily
 * removes the ordering requirement: there is no startup step left to forget.
 *
 * The promise is shared so that simultaneous first calls open it once. A
 * failed open is forgotten, so the next call retries instead of replaying
 * the failure forever.
 */
function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = openAndMigrate().catch((error) => {
      opening = null;
      console.error("Database initialization failed:", error);
      throw error;
    });
  }
  return opening;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      scientificName TEXT NOT NULL,
      commonNames TEXT NOT NULL,
      location TEXT,
      acquisitionDate INTEGER,
      notes TEXT,
      identificationDate INTEGER NOT NULL,
      providerData TEXT,
      confidenceBand TEXT NOT NULL,
      rawScore REAL NOT NULL,
      calibratedScore REAL NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      isFavorited INTEGER DEFAULT 0,
      lastSyncedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      plantId TEXT NOT NULL,
      dateTaken INTEGER NOT NULL,
      imagePath TEXT NOT NULL,
      imageHash TEXT NOT NULL,
      caption TEXT,
      FOREIGN KEY (plantId) REFERENCES plants(id)
    );

    CREATE TABLE IF NOT EXISTS waterLogs (
      id TEXT PRIMARY KEY,
      plantId TEXT NOT NULL,
      date INTEGER NOT NULL,
      amount TEXT,
      notes TEXT,
      FOREIGN KEY (plantId) REFERENCES plants(id)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_plantId ON photos(plantId);
    CREATE INDEX IF NOT EXISTS idx_waterLogs_plantId ON waterLogs(plantId);
    CREATE INDEX IF NOT EXISTS idx_waterLogs_date ON waterLogs(date DESC);
  `);

  // CREATE TABLE IF NOT EXISTS does nothing when the table already exists,
  // so a database created before `amount` was added still lacks the column.
  // SQLite has no ADD COLUMN IF NOT EXISTS; the duplicate-column error is
  // the expected outcome on an already-migrated database.
  try {
    await db.execAsync(`ALTER TABLE waterLogs ADD COLUMN amount TEXT`);
  } catch {
    // Column already present.
  }

  return db;
}

/**
 * Open the database ahead of time.
 *
 * Optional — every function opens it on demand. Calling this at launch just
 * means the first screen to need it isn't the one that waits.
 */
export async function initializeDatabase(): Promise<void> {
  await getDb();
}

/** One row of `plants`, with its children, as the app's type. */
function toSavedPlant(row: any, photos: PlantPhoto[], waterLogs: WaterLog[]): SavedPlant {
  return {
    id: row.id,
    nickname: row.nickname ?? undefined,
    scientificName: row.scientificName,
    commonNames: JSON.parse(row.commonNames),
    location: row.location ?? undefined,
    acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate) : undefined,
    notes: row.notes ?? undefined,
    identificationDate: new Date(row.identificationDate),
    providerData: row.providerData ?? undefined,
    confidenceBand: row.confidenceBand,
    rawScore: row.rawScore,
    calibratedScore: row.calibratedScore,
    photos,
    waterLogs,
    sortOrder: row.sortOrder,
    isFavorited: row.isFavorited === 1,
    lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : undefined,
  } as SavedPlant;
}

async function withChildren(row: any): Promise<SavedPlant> {
  const [photos, waterLogs] = await Promise.all([fetchPhotos(row.id), fetchWaterLogs(row.id)]);
  return toSavedPlant(row, photos, waterLogs);
}

// MARK: - Plant Operations

export async function createPlant(plant: Omit<SavedPlant, "id" | "photos" | "waterLogs">): Promise<SavedPlant> {
  const db = await getDb();

  const id = generateId();
  const now = Date.now();

  try {
    await db.runAsync(
      `INSERT INTO plants (
        id, nickname, scientificName, commonNames, location, acquisitionDate,
        notes, identificationDate, providerData, confidenceBand, rawScore,
        calibratedScore, lastSyncedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        plant.nickname || null,
        plant.scientificName,
        JSON.stringify(plant.commonNames),
        plant.location || null,
        plant.acquisitionDate?.getTime() || null,
        plant.notes || null,
        plant.identificationDate.getTime(),
        plant.providerData || null,
        plant.confidenceBand,
        plant.rawScore,
        plant.calibratedScore,
        now,
      ]
    );

    return {
      id,
      ...plant,
      photos: [],
      waterLogs: [],
      lastSyncedAt: new Date(now),
    };
  } catch (error) {
    console.error("Failed to create plant:", error);
    throw error;
  }
}

export async function fetchAllPlants(): Promise<SavedPlant[]> {
  const db = await getDb();

  try {
    const rows = await db.getAllAsync<any>(`SELECT * FROM plants ORDER BY sortOrder ASC`);
    return Promise.all(rows.map(withChildren));
  } catch (error) {
    console.error("Failed to fetch plants:", error);
    throw error;
  }
}

export async function fetchPlant(id: string): Promise<SavedPlant | null> {
  const db = await getDb();

  try {
    const row = await db.getFirstAsync<any>(`SELECT * FROM plants WHERE id = ?`, [id]);
    return row ? withChildren(row) : null;
  } catch (error) {
    console.error("Failed to fetch plant:", error);
    throw error;
  }
}

export async function updatePlant(id: string, updates: Partial<SavedPlant>): Promise<void> {
  const db = await getDb();

  try {
    const sets: string[] = [];
    const values: any[] = [];

    // `in` rather than `!== undefined`: the edit screen passes undefined to
    // mean "cleared", and skipping those left the old nickname in place.
    if ("nickname" in updates) {
      sets.push("nickname = ?");
      values.push(updates.nickname ?? null);
    }
    if ("location" in updates) {
      sets.push("location = ?");
      values.push(updates.location ?? null);
    }
    if ("notes" in updates) {
      sets.push("notes = ?");
      values.push(updates.notes ?? null);
    }
    if (updates.isFavorited !== undefined) {
      sets.push("isFavorited = ?");
      values.push(updates.isFavorited ? 1 : 0);
    }

    // Choosing one of the other possibilities on a plant's page changes what
    // it is. The name and its confidence move together, so the page never
    // shows one plant's name with another's certainty.
    if (updates.scientificName !== undefined) {
      if (
        updates.commonNames === undefined ||
        updates.confidenceBand === undefined ||
        updates.rawScore === undefined ||
        updates.calibratedScore === undefined
      ) {
        throw new Error("Changing a plant's identification needs its names and confidence together.");
      }

      sets.push("scientificName = ?", "commonNames = ?", "confidenceBand = ?", "rawScore = ?", "calibratedScore = ?");
      values.push(
        updates.scientificName,
        JSON.stringify(updates.commonNames),
        updates.confidenceBand,
        updates.rawScore,
        updates.calibratedScore
      );
    }

    if (sets.length === 0) return;

    values.push(id);
    await db.runAsync(`UPDATE plants SET ${sets.join(", ")} WHERE id = ?`, values);
  } catch (error) {
    console.error("Failed to update plant:", error);
    throw error;
  }
}

export async function deletePlant(id: string): Promise<void> {
  const db = await getDb();

  try {
    const photoRows = await db.getAllAsync<{ imagePath: string }>(
      `SELECT imagePath FROM photos WHERE plantId = ?`,
      [id]
    );

    // All or nothing — a half-deleted plant would linger in the list with
    // its history gone.
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM photos WHERE plantId = ?`, [id]);
      await db.runAsync(`DELETE FROM waterLogs WHERE plantId = ?`, [id]);
      await db.runAsync(`DELETE FROM plants WHERE id = ?`, [id]);
    });

    // The confirmation says this removes the plant's photos. Deleting only
    // the rows left every image sitting on the phone.
    photoRows.forEach((row) => deletePhotoFile(row.imagePath));
  } catch (error) {
    console.error("Failed to delete plant:", error);
    throw error;
  }
}

// MARK: - Photo Operations

/** Photo journal for one plant, newest first. */
export async function fetchPhotos(plantId: string): Promise<PlantPhoto[]> {
  const db = await getDb();

  try {
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM photos WHERE plantId = ? ORDER BY dateTaken DESC`,
      [plantId]
    );

    return rows.map((row) => ({
      id: row.id,
      dateTaken: new Date(row.dateTaken),
      imagePath: resolvePhotoUri(row.imagePath),
      imageHash: row.imageHash,
      caption: row.caption ?? undefined,
    }));
  } catch (error) {
    console.error("Failed to fetch photos:", error);
    throw error;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb();

  const row = await db.getFirstAsync<{ imagePath: string }>(
    `SELECT imagePath FROM photos WHERE id = ?`,
    [id]
  );

  await db.runAsync(`DELETE FROM photos WHERE id = ?`, [id]);

  if (row) deletePhotoFile(row.imagePath);
}

/**
 * Save a photo to a plant's journal.
 *
 * Pass the temporary URI from the camera or picker as imagePath. The file is
 * copied somewhere permanent first, and the photo returned carries the
 * permanent URI.
 */
export async function addPhoto(plantId: string, photo: Omit<PlantPhoto, "id">): Promise<PlantPhoto> {
  const db = await getDb();

  const id = generateId();
  const stored = await persistPhoto(photo.imagePath);

  try {
    await db.runAsync(
      `INSERT INTO photos (id, plantId, dateTaken, imagePath, imageHash, caption)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, plantId, photo.dateTaken.getTime(), stored, photo.imageHash, photo.caption || null]
    );
  } catch (error) {
    // Don't leave an orphaned copy behind for a row that was never written.
    deletePhotoFile(stored);
    console.error("Failed to add photo:", error);
    throw error;
  }

  return { id, ...photo, imagePath: resolvePhotoUri(stored) };
}

// MARK: - Water Log Operations

/** Watering history for one plant, newest first. */
export async function fetchWaterLogs(plantId: string): Promise<WaterLog[]> {
  const db = await getDb();

  try {
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM waterLogs WHERE plantId = ? ORDER BY date DESC`,
      [plantId]
    );

    return rows.map((row) => ({
      id: row.id,
      date: new Date(row.date),
      amount: (row.amount as WaterAmount) ?? undefined,
      notes: row.notes ?? undefined,
    }));
  } catch (error) {
    console.error("Failed to fetch water logs:", error);
    throw error;
  }
}

export async function deleteWaterLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM waterLogs WHERE id = ?`, [id]);
}

export async function addWaterLog(plantId: string, log: Omit<WaterLog, "id">): Promise<WaterLog> {
  const db = await getDb();

  const id = generateId();

  try {
    await db.runAsync(
      `INSERT INTO waterLogs (id, plantId, date, amount, notes) VALUES (?, ?, ?, ?, ?)`,
      [id, plantId, log.date.getTime(), log.amount ?? null, log.notes || null]
    );

    return { id, ...log };
  } catch (error) {
    console.error("Failed to add water log:", error);
    throw error;
  }
}

// MARK: - Search & Query

export async function searchPlants(query: string): Promise<SavedPlant[]> {
  const db = await getDb();

  try {
    const searchPattern = `%${query.toLowerCase()}%`;
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM plants WHERE
        LOWER(nickname) LIKE ? OR
        LOWER(scientificName) LIKE ? OR
        LOWER(commonNames) LIKE ?
      ORDER BY sortOrder ASC`,
      [searchPattern, searchPattern, searchPattern]
    );

    return Promise.all(rows.map(withChildren));
  } catch (error) {
    console.error("Failed to search plants:", error);
    throw error;
  }
}

/**
 * Delete every plant, photo and watering log on this device.
 *
 * Throws if the photo files can't be removed, so "Delete all data" never
 * reports success while images are still on the phone.
 */
export async function deleteAllData(): Promise<void> {
  const db = await getDb();

  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM photos;
        DELETE FROM waterLogs;
        DELETE FROM plants;
      `);
    });

    deleteAllPhotoFiles();
  } catch (error) {
    console.error("Failed to delete all data:", error);
    throw error;
  }
}
