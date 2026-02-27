import { PrismaClient, Role, Subject } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const teachers = [
  {
    email: 'phy@jeerankup.com',
    password: 'Physics@2025',
    firstName: 'Physics',
    lastName: 'Teacher',
    subject: Subject.PHYSICS,
  },
  {
    email: 'chem@jeerankup.com',
    password: 'Chem@2025',
    firstName: 'Chemistry',
    lastName: 'Teacher',
    subject: Subject.CHEMISTRY,
  },
  {
    email: 'math@jeerankup.com',
    password: 'Math@2025',
    firstName: 'Mathematics',
    lastName: 'Teacher',
    subject: Subject.MATHEMATICS,
  },
];

async function main() {
  console.log('Seeding teacher accounts...');

  for (const teacher of teachers) {
    const existing = await prisma.user.findUnique({ where: { email: teacher.email } });
    if (existing) {
      console.log(`  ⚠️  Teacher already exists: ${teacher.email}`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(teacher.password, 10);

    await prisma.user.create({
      data: {
        email: teacher.email,
        password: hashedPassword,
        role: Role.TEACHER,
        teacher: {
          create: {
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            subject: teacher.subject,
          },
        },
      },
    });

    console.log(`  ✅ Created teacher: ${teacher.email} (${teacher.subject})`);
  }

  console.log('\nTeacher accounts ready:');
  console.log('  phy@jeerankup.com   →  password: Physics@2025  (PHYSICS)');
  console.log('  chem@jeerankup.com  →  password: Chem@2025     (CHEMISTRY)');
  console.log('  math@jeerankup.com  →  password: Math@2025     (MATHEMATICS)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
