-- CreateEnum
CREATE TYPE "MapEditPolicy" AS ENUM ('DM_ONLY', 'PLAYERS');

-- AlterTable
ALTER TABLE "RoomSettings"
ADD COLUMN "mapEditPolicy" "MapEditPolicy" NOT NULL DEFAULT 'DM_ONLY',
ADD COLUMN "mapEditUserOverridesJson" JSONB NOT NULL DEFAULT '[]'::jsonb;
