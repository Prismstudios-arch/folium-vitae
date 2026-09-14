import { useState, useEffect, useCallback } from "react";
import {
  fetchAllPlants,
  fetchPlant,
  createPlant,
  updatePlant,
  deletePlant,
  addPhoto,
  addWaterLog,
  searchPlants,
} from "@services/database";
import { SavedPlant, PlantPhoto, WaterLog } from "@domain/plant";

/**
 * Hook for managing plants in the database
 * Handles loading, caching, and mutations
 */
export function usePlants() {
  const [plants, setPlants] = useState<SavedPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load all plants on mount
  useEffect(() => {
    loadPlants();
  }, []);

  /**
   * silent: refresh without flipping the loading flag — for returning to a
   * screen that is already showing the list.
   */
  const loadPlants = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);
      const data = await fetchAllPlants();
      setPlants(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  const addPlant = useCallback(
    async (plant: Omit<SavedPlant, "id" | "photos" | "waterLogs">) => {
      try {
        const newPlant = await createPlant(plant);
        setPlants((prev) => [...prev, newPlant]);
        return newPlant;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to create plant");
        setError(error);
        throw error;
      }
    },
    []
  );

  const updatePlantData = useCallback(
    async (id: string, updates: Partial<SavedPlant>) => {
      try {
        await updatePlant(id, updates);
        setPlants((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update plant");
        setError(error);
        throw error;
      }
    },
    []
  );

  const removePlant = useCallback(async (id: string) => {
    try {
      await deletePlant(id);
      setPlants((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to delete plant");
      setError(error);
      throw error;
    }
  }, []);

  const addPlantPhoto = useCallback(
    async (plantId: string, photo: Omit<PlantPhoto, "id">) => {
      try {
        const newPhoto = await addPhoto(plantId, photo);
        setPlants((prev) =>
          prev.map((p) =>
            p.id === plantId ? { ...p, photos: [newPhoto, ...p.photos] } : p
          )
        );
        return newPhoto;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to add photo");
        setError(error);
        throw error;
      }
    },
    []
  );

  const addPlantWaterLog = useCallback(
    async (plantId: string, log: Omit<WaterLog, "id">) => {
      try {
        const newLog = await addWaterLog(plantId, log);
        setPlants((prev) =>
          prev.map((p) =>
            p.id === plantId ? { ...p, waterLogs: [newLog, ...p.waterLogs] } : p
          )
        );
        return newLog;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to add water log");
        setError(error);
        throw error;
      }
    },
    []
  );

  const search = useCallback(async (query: string) => {
    try {
      setError(null);
      return await searchPlants(query);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Search failed");
      setError(error);
      throw error;
    }
  }, []);

  return {
    plants,
    loading,
    error,
    loadPlants,
    addPlant,
    updatePlant: updatePlantData,
    removePlant,
    addPlantPhoto,
    addPlantWaterLog,
    search,
  };
}

/**
 * Hook for accessing a single plant
 */
export function usePlant(id: string) {
  const [plant, setPlant] = useState<SavedPlant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadPlant();
  }, [id]);

  /**
   * silent: refresh without the full-screen spinner — used when returning
   * to a screen that is already showing the plant.
   */
  const loadPlant = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      setError(null);
      const data = await fetchPlant(id);
      setPlant(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load plant"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { plant, loading, error, reload: loadPlant };
}
