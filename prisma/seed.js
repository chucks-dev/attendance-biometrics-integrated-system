const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Computer Science', code: 'CSC' },
  { name: 'Statistics', code: 'STA' },
  { name: 'Accountancy', code: 'ACC' },
  { name: 'Business Administration', code: 'BAD' },
  { name: 'Public Administration', code: 'PAD' },
  { name: 'Mass Communication', code: 'MAC' },
  { name: 'Science Laboratory Technology', code: 'SLT' },
  { name: 'Electrical Engineering', code: 'EEE' },
];

async function main() {
  console.log('Seeding database...');

  // --- Super Admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@fpn.edu.ng';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        mustChangePassword: true, // forces password change on first login, per spec
      },
    });
    console.log(`Created SUPER_ADMIN account: ${adminEmail}`);
  } else {
    console.log('SUPER_ADMIN account already exists — skipping.');
  }

  // --- Departments ---
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }
  console.log(`Seeded ${DEPARTMENTS.length} departments.`);

  // --- Academic Session + Semester (active) ---
  const session = await prisma.academicSession.upsert({
    where: { name: '2024/2025' },
    update: {},
    create: { name: '2024/2025', isActive: true },
  });

  const existingSemester = await prisma.semester.findFirst({
    where: { academicSessionId: session.id, name: 'FIRST' },
  });
  if (!existingSemester) {
    await prisma.semester.create({
      data: { academicSessionId: session.id, name: 'FIRST', isActive: true },
    });
  }
  console.log('Seeded active academic session 2024/2025 — First Semester.');

  console.log('Seeding complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
