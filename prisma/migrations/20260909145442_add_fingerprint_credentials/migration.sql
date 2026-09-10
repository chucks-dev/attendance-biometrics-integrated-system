-- CreateTable
CREATE TABLE "fingerprint_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceLabel" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fingerprint_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fingerprint_credentials_credentialId_key" ON "fingerprint_credentials"("credentialId");

-- CreateIndex
CREATE INDEX "fingerprint_credentials_userId_idx" ON "fingerprint_credentials"("userId");

-- AddForeignKey
ALTER TABLE "fingerprint_credentials" ADD CONSTRAINT "fingerprint_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
