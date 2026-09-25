-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "gender" TEXT,
ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_firebaseUid_key" ON "Customer"("firebaseUid");
