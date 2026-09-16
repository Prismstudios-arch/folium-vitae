-- Free allowance: a seven-day window instead of a calendar day.
--
-- Three identifications a day is about 91 a month. At €0.05 an identification
-- that is €4.55 for one free user who uses every one, while an annual
-- subscription nets about $2.12 a month after Apple's cut — so a single
-- maxed-out free account cost more than two subscribers brought in.
--
-- Five per seven days caps that at €1.09, and a window rather than a daily
-- reset means someone can still identify a whole windowsill in one sitting,
-- which is how people actually use it.
--
-- The columns are renamed to match what they now hold: the counter is no
-- longer "today's", and the timestamp is the start of a window rather than
-- the moment of the last reset.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'quota_used_today'
  ) THEN
    ALTER TABLE users RENAME COLUMN quota_used_today TO quota_used_in_window;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_quota_reset'
  ) THEN
    ALTER TABLE users RENAME COLUMN last_quota_reset TO quota_window_start;
  END IF;
END $$;

COMMENT ON COLUMN users.quota_used_in_window IS
  'Identifications used since quota_window_start.';

COMMENT ON COLUMN users.quota_window_start IS
  'Start of the current seven-day allowance window. Moved forward by the first identification made after a window has run out, so the week starts when someone actually uses it.';

-- Existing accounts start a fresh window now rather than inheriting a
-- daily counter that meant something else.
UPDATE users
   SET quota_used_in_window = 0,
       quota_window_start = CURRENT_TIMESTAMP
 WHERE quota_used_in_window > 0;
