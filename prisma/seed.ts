import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@fpn.edu.ng';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: Role.SUPER_ADMIN,
        mustChangePassword: true,
        admin: { create: { fullName: 'System Administrator' } },
      },
    });
    console.log(`Created default admin: ${adminEmail} (must change password on first login)`);
  } else {
    console.log('Default admin already exists — skipping.');
  }

  const departments = [
    { name: 'Computer Science', code: 'CSC' },
    { name: 'Statistics', code: 'STA' },
    { name: 'Accountancy', code: 'ACC' },
    { name: 'Public Administration', code: 'PAD' },
    { name: 'Business Administration', code: 'BAD' },
    { name: 'Mass Communication', code: 'MAC' },
    { name: 'Science Laboratory Technology', code: 'SLT' },
    { name: 'Electrical Engineering', code: 'EEE' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      create: dept,
      update: {},
    });
  }
  console.log(`Seeded ${departments.length} departments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
