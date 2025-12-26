import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  // Check if superadmin already exists
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: 'superadmin@gmail.com' },
  });

  if (existingSuperAdmin) {
    console.log('SuperAdmin already exists');
    return;
  }

  // Create superadmin user with hashed password
  const hashedPassword = await hashPassword('asdfghjkl');

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@gmail.com',
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      isActive: true,
      superAdmin: {
        create: {
          firstName: 'Super',
          lastName: 'Admin',
          phone: '0000000000',
          permissions: {
            canManageOperators: true,
            canManageInstitutes: true,
            canManageStudents: true,
            canViewAnalytics: true,
          },
        },
      },
    },
    include: {
      superAdmin: true,
    },
  });

  console.log('✅ SuperAdmin created:', superAdmin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
