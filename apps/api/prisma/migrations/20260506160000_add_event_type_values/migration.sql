-- Add new values to EventType enum used by schedules.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PERICIA';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'ACORDO';
