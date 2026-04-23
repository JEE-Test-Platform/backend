import { Role } from '@prisma/client';
import prisma from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import {
  RegisterStudentDTO,
  RegisterInstituteDTO,
  RegisterOperatorDTO,
  RegisterSuperAdminDTO,
  LoginDTO,
} from '../types';

export class AuthService {
  // Register Student
  async registerStudent(data: RegisterStudentDTO) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Check if institute exists
    const institute = await prisma.institute.findUnique({
      where: { id: data.instituteId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user and student profile in a transaction
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: Role.STUDENT,
        student: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            instituteId: data.instituteId,
            phone: data.phone,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            gender: data.gender,
            address: data.address,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
            guardianName: data.guardianName,
            guardianPhone: data.guardianPhone,
            emergencyContact: data.emergencyContact,
          },
        },
      },
      include: {
        student: true,
      },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId: user.student!.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.student,
      },
    };
  }

  // Register Institute
  async registerInstitute(data: RegisterInstituteDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: Role.INSTITUTE,
        institute: {
          create: {
            instituteName: data.instituteName,
            registrationNo: data.registrationNo,
            address: data.address,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
            phone: data.phone,
            website: data.website,
            establishedYear: data.establishedYear,
            principalName: data.principalName,
            contactPerson: data.contactPerson,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            isVerified: false, // Requires admin verification
          },
        },
      },
      include: {
        institute: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId: user.institute!.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.institute,
      },
    };
  }

  // Register Operator
  async registerOperator(data: RegisterOperatorDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: Role.OPERATOR,
        operator: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            department: data.department,
            designation: data.designation,
          },
        },
      },
      include: {
        operator: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId: user.operator!.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.operator,
      },
    };
  }

  // Register Super Admin
  async registerSuperAdmin(data: RegisterSuperAdminDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        superAdmin: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            permissions: data.permissions,
          },
        },
      },
      include: {
        superAdmin: true,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId: user.superAdmin!.id,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.superAdmin,
      },
    };
  }

  // Login
  async login(data: LoginDTO) {
    // Step 1: fetch only auth fields — no profile joins yet
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, email: true, password: true, role: true, isActive: true },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Your account has been deactivated. Please contact support.');
    }

    const isPasswordValid = await comparePassword(data.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Step 2: fetch only the profile that matches this user's role
    let profile: Record<string, unknown> | null = null;
    let profileId: string | undefined;

    switch (user.role) {
      case Role.STUDENT: {
        const s = await prisma.student.findUnique({ where: { userId: user.id } });
        profile = s; profileId = s?.id; break;
      }
      case Role.INSTITUTE: {
        const i = await prisma.institute.findUnique({ where: { userId: user.id } });
        profile = i; profileId = i?.id; break;
      }
      case Role.OPERATOR: {
        const o = await prisma.operator.findUnique({ where: { userId: user.id } });
        profile = o; profileId = o?.id; break;
      }
      case Role.SUPER_ADMIN: {
        const a = await prisma.superAdmin.findUnique({ where: { userId: user.id } });
        profile = a; profileId = a?.id; break;
      }
      case Role.TEACHER: {
        const t = await prisma.teacher.findUnique({ where: { userId: user.id } });
        profile = t; profileId = t?.id; break;
      }
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    };
  }

  // Get current user profile
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        institute: true,
        operator: true,
        superAdmin: true,
        teacher: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let profile = null;

    switch (user.role) {
      case Role.STUDENT:
        profile = user.student;
        break;
      case Role.INSTITUTE:
        profile = user.institute;
        break;
      case Role.OPERATOR:
        profile = user.operator;
        break;
      case Role.SUPER_ADMIN:
        profile = user.superAdmin;
        break;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      profile,
    };
  }

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  // Get all verified institutes (for student registration dropdown)
  async getVerifiedInstitutes() {
    const institutes = await prisma.institute.findMany({
      where: {
        isVerified: true,
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        instituteName: true,
        city: true,
        state: true,
      },
      orderBy: {
        instituteName: 'asc',
      },
    });

    return institutes;
  }
}
