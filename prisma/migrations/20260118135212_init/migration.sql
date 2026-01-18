-- CreateTable
CREATE TABLE "Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mainFaceId" TEXT NOT NULL DEFAULT 'unknown',
    "faceIds" TEXT NOT NULL DEFAULT '[]',
    "faceBoxes" TEXT NOT NULL DEFAULT '[]',
    "poseId" TEXT NOT NULL DEFAULT 'unknown_pose',
    "uploaderId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Face" (
    "faceId" TEXT NOT NULL PRIMARY KEY,
    "descriptors" TEXT NOT NULL DEFAULT '[]',
    "descriptor" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "thumbnailDriveId" TEXT,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Photo_driveId_key" ON "Photo"("driveId");

-- CreateIndex
CREATE INDEX "Photo_driveId_idx" ON "Photo"("driveId");

-- CreateIndex
CREATE INDEX "Photo_mainFaceId_idx" ON "Photo"("mainFaceId");

-- CreateIndex
CREATE INDEX "Photo_poseId_idx" ON "Photo"("poseId");

-- CreateIndex
CREATE INDEX "Photo_uploaderId_idx" ON "Photo"("uploaderId");

-- CreateIndex
CREATE INDEX "Photo_timestamp_idx" ON "Photo"("timestamp");

-- CreateIndex
CREATE INDEX "Face_photoCount_idx" ON "Face"("photoCount");

-- CreateIndex
CREATE INDEX "Face_lastSeen_idx" ON "Face"("lastSeen");

-- CreateIndex
CREATE INDEX "Challenge_title_idx" ON "Challenge"("title");
