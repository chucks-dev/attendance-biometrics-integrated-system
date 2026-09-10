import { NotificationType } from '@prisma/client';
import { prisma } from '../config/prisma';

export async function notifyUser(userId: string, type: NotificationType, title: string, message: string) {
  return prisma.notification.create({ data: { userId, type, title, message } });
}

export async function notifyCourseStudents(courseId: string, type: NotificationType, title: string, message: string) {
  const registrations = await prisma.courseRegistration.findMany({
    where: { courseId },
    include: { student: { include: { user: true } } },
  });

  if (registrations.length === 0) return;

  await prisma.notification.createMany({
    data: registrations.map((r) => ({
      userId: r.student.user.id,
      type,
      title,
      message,
    })),
  });
}

export async function notifyStudentUser(studentUserId: string, type: NotificationType, title: string, message: string) {
  return notifyUser(studentUserId, type, title, message);
}
