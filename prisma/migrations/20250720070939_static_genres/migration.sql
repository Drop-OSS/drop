-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('Action', 'Strategy', 'Sports', 'Adventure', 'Roleplay', 'Racing', 'Simulation', 'Educational', 'Fighting', 'Shooter', 'RealTimeStrategy', 'CardGame', 'BoardGame', 'Compilation', 'MMORPG', 'MinigameCollection', 'Puzzle', 'MusicRhythm');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "genres" "Genre"[];
