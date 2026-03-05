-- CreateEnum
CREATE TYPE "StorageMode" AS ENUM ('LOCAL', 'CLOUD');

-- AlterTable
ALTER TABLE "Room"
ADD COLUMN "storageMode" "StorageMode" NOT NULL DEFAULT 'LOCAL';
