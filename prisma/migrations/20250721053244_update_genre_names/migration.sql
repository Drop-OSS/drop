/*
  Warnings:

  - The values [RealTimeStrategy,CardGame,BoardGame,MinigameCollection,MusicRhythm] on the enum `Genre` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Genre_new" AS ENUM ('Action', 'Strategy', 'Sports', 'Adventure', 'Roleplay', 'Racing', 'Simulation', 'Educational', 'Fighting', 'Shooter', 'RTS', 'Card', 'Board', 'Compilation', 'MMORPG', 'Minigames', 'Puzzle', 'Rhythm');
ALTER TABLE "Game" ALTER COLUMN "genres" TYPE "Genre_new"[] USING ("genres"::text::"Genre_new"[]);
ALTER TYPE "Genre" RENAME TO "Genre_old";
ALTER TYPE "Genre_new" RENAME TO "Genre";
DROP TYPE "Genre_old";
COMMIT;
