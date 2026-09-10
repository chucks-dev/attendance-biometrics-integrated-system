-- CreateEnum
CREATE TYPE "SemesterName" AS ENUM ('FIRST', 'SECOND');

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "semesterId" TEXT;

-- AlterTable
ALTER TABLE "course_assignments" ADD COLUMN     "semesterId" TEXT;

-- AlterTable
ALTER TABLE "course_registrations" ADD COLUMN     "semesterId" TEXT;

-- CreateTable
CREATE TABLE "academic_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "name" "SemesterName" NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_sessions_name_key" ON "academic_sessions"("name");

-- CreateIndex
CREATE INDEX "academic_sessions_isActive_idx" ON "academic_sessions"("isActive");

-- CreateIndex
CREATE INDEX "semesters_academicSessionId_idx" ON "semesters"("academicSessionId");

-- CreateIndex
CREATE INDEX "semesters_isActive_idx" ON "semesters"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_academicSessionId_name_key" ON "semesters"("academicSessionId", "name");

-- CreateIndex
CREATE INDEX "attendance_sessions_semesterId_idx" ON "attendance_sessions"("semesterId");

-- CreateIndex
CREATE INDEX "course_assignments_courseId_idx" ON "course_assignments"("courseId");

-- CreateIndex
CREATE INDEX "course_assignments_semesterId_idx" ON "course_assignments"("semesterId");

-- CreateIndex
CREATE INDEX "course_registrations_studentId_idx" ON "course_registrations"("studentId");

-- CreateIndex
CREATE INDEX "course_registrations_semesterId_idx" ON "course_registrations"("semesterId");

-- AddForeignKey
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_assignments" ADD CONSTRAINT "course_assignments_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "academic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
