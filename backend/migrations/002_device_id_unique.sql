-- One anonymous user per device.
--
-- 001 created a plain index on users.device_id, which does not stop two rows
-- sharing a device. That matters because anonymous sign-in is find-or-create:
-- without uniqueness, two requests racing from the same device create two
-- users, and the second one silently orphans the first one's plants.
--
-- Partial, because device_id is NULL for every email account and NULLs must
-- stay free to collide.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_device_id_unique
  ON users (device_id)
  WHERE device_id IS NOT NULL;
