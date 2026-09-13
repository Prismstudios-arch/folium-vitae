import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { SavedPlant, PlantPhoto, WaterLog } from "@domain/plant";
import { generateId } from "@utils/id";

const DB_NAME = "sorrel.db";
const PLANTS_KEY = "sorrel_plants";

// Initialize database
let db: SQLite.SQLiteDatabase | null = null;

export async function initializeDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Create tables
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
        notes TEXT,
        FOREIGN KEY (plantId) REFERENCES plants(id)
      );

      CREATE INDEX IF NOT EXISTS idx_photos_plantId ON photos(plantId);
      CREATE INDEX IF NOT EXISTS idx_waterLogs_plantId ON waterLogs(plantId);
    `);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

// MARK: - Plant Operations

export async function createPlant(plant: Omit<SavedPlant, "id" | "photos" | "waterLogs">): Promise<SavedPlant> {
  if (!db) throw new Error("Database not initialized");

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
  if (!db) throw new Error("Database not initialized");

  try {
    const result = await db.getAllAsync<any>(
      `SELECT * FROM plants ORDER BY sortOrder ASC`
    );

    return Promise.all(
      result.map(async (row) => {
        const photos = await fetchPhotos(row.id);
        const waterLogs = await fetchWaterLogs(row.id);

        return {
          id: row.id,
          nickname: row.nickname,
          scientificName: row.scientificName,
          commonNames: JSON.parse(row.commonNames),
          location: row.location,
          acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate) : undefined,
          notes: row.notes,
          identificationDate: new Date(row.identificationDate),
          providerData: row.providerData,
          confidenceBand: row.confidenceBand,
          rawScore: row.rawScore,
          calibratedScore: row.calibratedScore,
          photos,
          waterLogs,
          sortOrder: row.sortOrder,
          isFavorited: row.isFavorited === 1,
          lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : undefined,
        } as SavedPlant;
      })
    );
  } catch (error) {
    console.error("Failed to fetch plants:", error);
    throw error;
  }
}

export async function fetchPlant(id: string): Promise<SavedPlant | null> {
  if (!db) throw new Error("Database not initialized");

  try {
    const result = await db.getFirstAsync<any>(
      `SELECT * FROM plants WHERE id = ?`,
      [id]
    );

    if (!result) return null;

    const photos = await fetchPhotos(id);
    const waterLogs = await fetchWaterLogs(id);

    return {
      id: result.id,
      nickname: result.nickname,
      scientificName: result.scientificName,
      commonNames: JSON.parse(result.commonNames),
      location: result.location,
      acquisitionDate: result.acquisitionDate ? new Date(result.acquisitionDate) : undefined,
      notes: result.notes,
      identificationDate: new Date(result.identificationDate),
      providerData: result.providerData,
      confidenceBand: result.confidenceBand,
      rawScore: result.rawScore,
      calibratedScore: result.calibratedScore,
      photos,
      waterLogs,
      sortOrder: result.sortOrder,
      isFavorited: result.isFavorited === 1,
      lastSyncedAt: result.lastSyncedAt ? new Date(result.lastSyncedAt) : undefined,
    } as SavedPlant;
  } catch (error) {
    console.error("Failed to fetch plant:", error);
    throw error;
  }
}

export async function updatePlant(id: string, updates: Partial<SavedPlant>): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  try {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.nickname !== undefined) {
      sets.push("nickname = ?");
      values.push(updates.nickname);
    }
    if (updates.location !== undefined) {
      sets.push("location = ?");
      values.push(updates.location);
    }
    if (updates.notes !== undefined) {
      sets.push("notes = ?");
      values.push(updates.notes);
    }
    if (updates.isFavorited !== undefined) {
      sets.push("isFavorited = ?");
      values.push(updates.isFavorited ? 1 : 0);
    }

    if (sets.length === 0) return;

    values.push(id);
    await db.runAsync(
      `UPDATE plants SET ${sets.join(", ")} WHERE id = ?`,
      values
    );
  } catch (error) {
    console.error("Failed to update plant:", error);
    throw error;
  }
}

export async function deletePlant(id: string): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  try {
    // Cascade delete photos and water logs
    await db.runAsync(`DELETE FROM photos WHERE plantId = ?`, [id]);
    await db.runAsync(`DELETE FROM waterLogs WHERE plantId = ?`, [id]);
    await db.runAsync(`DELETE FROM plants WHERE id = ?`, [id]);
  } catch (error) {
    console.error("Failed to delete plant:", error);
    throw error;
  }
}

// MARK: - Photo Operations

async function fetchPhotos(plantId: string): Promise<PlantPhoto[]> {
  if (!db) throw new Error("Database not initialized");

  try {
    const result = await db.getAllAsync<any>(
      `SELECT * FROM photos WHERE plantId = ? ORDER BY dateTaken DESC`,
      [plantId]
    );

    return result.map((row) => ({
      id: row.id,
      dateTaken: new Date(row.dateTaken),
      imagePath: row.imagePath,
      imageHash: row.imageHash,
      caption: row.caption,
    }));
  } catch (error) {
    console.error("Failed to fetch photos:", error);
    throw error;
  }
}

export async function addPhoto(plantId: string, photo: Omit<PlantPhoto, "id">): Promise<PlantPhoto> {
  if (!db) throw new Error("Database not initialized");

  const id = generateId();

  try {
    await db.runAsync(
      `INSERT INTO photos (id, plantId, dateTaken, imagePath, imageHash, caption)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, plantId, photo.dateTaken.getTime(), photo.imagePath, photo.imageHash, photo.caption || null]
    );

    return { id, ...photo };
  } catch (error) {
    console.error("Failed to add photo:", error);
    throw error;
  }
}

// MARK: - Water Log Operations

async function fetchWaterLogs(plantId: string): Promise<WaterLog[]> {
  if (!db) throw new Error("Database not initialized");

  try {
    const result = await db.getAllAsync<any>(
      `SELECT * FROM waterLogs WHERE plantId = ? ORDER BY date DESC`,
      [plantId]
    );

    return result.map((row) => ({
      id: row.id,
      date: new Date(row.date),
      notes: row.notes,
    }));
  } catch (error) {
    console.error("Failed to fetch water logs:", error);
    throw error;
  }
}

export async function addWaterLog(plantId: string, log: Omit<WaterLog, "id">): Promise<WaterLog> {
  if (!db) throw new Error("Database not initialized");

  const id = generateId();

  try {
    await db.runAsync(
      `INSERT INTO waterLogs (id, plantId, date, notes) VALUES (?, ?, ?, ?)`,
      [id, plantId, log.date.getTime(), log.notes || null]
    );

    return { id, ...log };
  } catch (error) {
    console.error("Failed to add water log:", error);
    throw error;
  }
}

// MARK: - Search & Query

export async function searchPlants(query: string): Promise<SavedPlant[]> {
  if (!db) throw new Error("Database not initialized");

  try {
    const searchPattern = `%${query.toLowerCase()}%`;
    const result = await db.getAllAsync<any>(
      `SELECT * FROM plants WHERE
        LOWER(nickname) LIKE ? OR
        LOWER(scientificName) LIKE ? OR
        LOWER(commonNames) LIKE ?
      ORDER BY sortOrder ASC`,
      [searchPattern, searchPattern, searchPattern]
    );

    return Promise.all(
      result.map(async (row) => {
        const photos = await fetchPhotos(row.id);
        const waterLogs = await fetchWaterLogs(row.id);

        return {
          id: row.id,
          nickname: row.nickname,
          scientificName: row.scientificName,
          commonNames: JSON.parse(row.commonNames),
          location: row.location,
          acquisitionDate: row.acquisitionDate ? new Date(row.acquisitionDate) : undefined,
          notes: row.notes,
          identificationDate: new Date(row.identificationDate),
          providerData: row.providerData,
          confidenceBand: row.confidenceBand,
          rawScore: row.rawScore,
          calibratedScore: row.calibratedScore,
          photos,
          waterLogs,
          sortOrder: row.sortOrder,
          isFavorited: row.isFavorited === 1,
          lastSyncedAt: row.lastSyncedAt ? new Date(row.lastSyncedAt) : undefined,
        } as SavedPlant;
      })
    );
  } catch (error) {
    console.error("Failed to search plants:", error);
    throw error;
  }
}

export async function deleteAllData(): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  try {
    await db.execAsync(`
      DELETE FROM photos;
      DELETE FROM waterLogs;
      DELETE FROM plants;
    `);
  } catch (error) {
    console.error("Failed to delete all data:", error);
    throw error;
  }
}
