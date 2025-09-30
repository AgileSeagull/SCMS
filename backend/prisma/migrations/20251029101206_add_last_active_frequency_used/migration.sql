-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "premiumUser" BOOLEAN NOT NULL DEFAULT false,
    "voluntaryExitScore" REAL NOT NULL DEFAULT 0.5,
    "lastActive" DATETIME,
    "frequencyUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("age", "createdAt", "email", "firstName", "gender", "id", "lastName", "password", "premiumUser", "qrCode", "role", "updatedAt", "voluntaryExitScore") SELECT "age", "createdAt", "email", "firstName", "gender", "id", "lastName", "password", "premiumUser", "qrCode", "role", "updatedAt", "voluntaryExitScore" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_qrCode_key" ON "User"("qrCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
