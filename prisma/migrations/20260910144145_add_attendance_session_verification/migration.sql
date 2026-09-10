/*
  Warnings:

  - A unique constraint covering the columns `[sessionToken]` on the table `attendance_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VerificationMode" AS ENUM ('QR_CODE', 'DEVICE_FINGERPRINT', 'QR_AND_FINGERPRINT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationMethod" ADD VALUE 'DEVICE_FINGERPRINT';
ALTER TYPE "VerificationMethod" ADD VALUE 'QR_CODE';
ALTER TYPE "VerificationMethod" ADD VALUE 'QR_AND_FINGERPRINT';

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "requiredVerification" "VerificationMode" NOT NULL DEFAULT 'QR_AND_FINGERPRINT',
ADD COLUMN     "sessionToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_sessionToken_key" ON "attendance_sessions"("sessionToken");
