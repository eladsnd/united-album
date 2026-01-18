-- CreateTable
CREATE TABLE "PhotoLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "photoId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mainFaceId" TEXT NOT NULL DEFAULT 'unknown',
    "faceIds" TEXT NOT NULL DEFAULT '[]',
    "faceBoxes" TEXT NOT NULL DEFAULT '[]',
    "poseId" TEXT NOT NULL DEFAULT 'unknown_pose',
    "uploaderId" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Photo" ("createdAt", "driveId", "faceBoxes", "faceIds", "id", "mainFaceId", "name", "poseId", "timestamp", "updatedAt", "uploaderId", "url") SELECT "createdAt", "driveId", "faceBoxes", "faceIds", "id", "mainFaceId", "name", "poseId", "timestamp", "updatedAt", "uploaderId", "url" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE UNIQUE INDEX "Photo_driveId_key" ON "Photo"("driveId");
CREATE INDEX "Photo_driveId_idx" ON "Photo"("driveId");
CREATE INDEX "Photo_mainFaceId_idx" ON "Photo"("mainFaceId");
CREATE INDEX "Photo_poseId_idx" ON "Photo"("poseId");
CREATE INDEX "Photo_uploaderId_idx" ON "Photo"("uploaderId");
CREATE INDEX "Photo_timestamp_idx" ON "Photo"("timestamp");
CREATE INDEX "Photo_likeCount_idx" ON "Photo"("likeCount");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PhotoLike_photoId_idx" ON "PhotoLike"("photoId");

-- CreateIndex
CREATE INDEX "PhotoLike_userId_idx" ON "PhotoLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoLike_photoId_userId_key" ON "PhotoLike"("photoId", "userId");
