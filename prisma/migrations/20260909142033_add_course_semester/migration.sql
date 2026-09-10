-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "semesterId" TEXT;

-- CreateIndex
CREATE INDEX "courses_semesterId_idx" ON "courses"("semesterId");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
