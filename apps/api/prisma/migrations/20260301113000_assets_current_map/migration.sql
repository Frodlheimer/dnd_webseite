-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MAP', 'TOKEN_IMAGE', 'SOUND');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "currentMapAssetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "type" "AssetType" NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE INDEX "Asset_roomId_type_createdAt_idx" ON "Asset"("roomId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_ownerUserId_idx" ON "Asset"("ownerUserId");

-- CreateIndex
CREATE INDEX "Room_currentMapAssetId_idx" ON "Room"("currentMapAssetId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_currentMapAssetId_fkey" FOREIGN KEY ("currentMapAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
