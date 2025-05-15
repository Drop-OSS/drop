-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "requiredPerms" TEXT[] DEFAULT ARRAY[]::TEXT[];
