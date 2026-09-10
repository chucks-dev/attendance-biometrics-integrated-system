import { Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';

export const getDashboardStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalStudents, totalLecturers, totalDepartments, totalCourses, todayAttendance, totalRecords, presentOrLate] = await Promise.all([
    prisma.student.count(),
    prisma.lecturer.count(),
    prisma.department.count(),
    prisma.course.count(),
    prisma.attendanceRecord.count({ where: { recordedAt: { gte: startOfToday } } }),
    prisma.attendanceRecord.count(),
    prisma.attendanceRecord.count({ where: { status: { in: ['PRESENT', 'LATE'] } } }),
  ]);

  const attendanceRate = totalRecords > 0 ? Math.round((presentOrLate / totalRecords) * 100) : 0;

  res.json({
    success: true,
    data: {
      totalStudents, totalLecturers, totalDepartments, totalCourses,
      todayAttendance, attendanceRate,
    },
  });
});

export const getAttendanceTrend = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { range = 'daily' } = req.query as { range?: 'daily' | 'weekly' | 'monthly' };

  const days = range === 'monthly' ? 30 : range === 'weekly' ? 7 * 8 : 14;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await prisma.attendanceRecord.findMany({
    where: { recordedAt: { gte: since } },
    select: { recordedAt: true, status: true },
  });

  const buckets = new Map<string, { present: number; late: number; absent: number }>();
  for (const r of records) {
    const key = r.recordedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { present: 0, late: 0, absent: 0 };
    if (r.status === 'PRESENT') bucket.present++;
    else if (r.status === 'LATE') bucket.late++;
    else bucket.absent++;
    buckets.set(key, bucket);
  }

  const trend = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  res.json({ success: true, data: trend });
});

export const getDepartmentPerformance = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const departments = await prisma.department.findMany({
    include: {
      students: {
        include: { attendanceRecords: { select: { status: true } } },
      },
    },
  });

  const performance = departments.map((dept) => {
    const allRecords = dept.students.flatMap((s) => s.attendanceRecords);
    const presentOrLate = allRecords.filter((r) => r.status !== 'ABSENT').length;
    const rate = allRecords.length > 0 ? Math.round((presentOrLate / allRecords.length) * 100) : 0;
    return { department: dept.name, code: dept.code, attendanceRate: rate, totalRecords: allRecords.length };
  });

  res.json({ success: true, data: performance });
});

export const getAttendanceDistribution = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const [present, late, absent] = await Promise.all([
    prisma.attendanceRecord.count({ where: { status: 'PRESENT' } }),
    prisma.attendanceRecord.count({ where: { status: 'LATE' } }),
    prisma.attendanceRecord.count({ where: { status: 'ABSENT' } }),
  ]);
  res.json({ success: true, data: [{ name: 'Present', value: present }, { name: 'Late', value: late }, { name: 'Absent', value: absent }] });
});
