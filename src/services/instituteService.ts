import prisma from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { Role } from '@prisma/client';

export const instituteService = {
  // Get institute dashboard overview
  getDashboard: async (userId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Get total students count
    const totalStudents = await prisma.student.count({
      where: { instituteId: institute.id },
    });

    // Get test activations stats
    const now = new Date();
    const activeTests = await prisma.instituteTestActivation.count({
      where: {
        instituteId: institute.id,
        isActive: true,
        activationDate: { lte: now },
        expiryDate: { gte: now },
      },
    });

    const upcomingTests = await prisma.instituteTestActivation.count({
      where: {
        instituteId: institute.id,
        isActive: true,
        activationDate: { gt: now },
      },
    });

    const completedTests = await prisma.instituteTestActivation.count({
      where: {
        instituteId: institute.id,
        expiryDate: { lt: now },
      },
    });

    // Get total attempts
    const totalAttempts = await prisma.testAttempt.count({
      where: {
        student: {
          instituteId: institute.id,
        },
        status: 'SUBMITTED',
      },
    });

    // Calculate average performance
    const submittedAttempts = await prisma.testAttempt.findMany({
      where: {
        student: {
          instituteId: institute.id,
        },
        status: 'SUBMITTED',
        percentage: { not: null },
      },
      select: {
        percentage: true,
      },
    });

    const averagePerformance = submittedAttempts.length > 0
      ? submittedAttempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) / submittedAttempts.length
      : 0;

    // Get recent activations
    const recentActivations = await prisma.instituteTestActivation.findMany({
      where: { instituteId: institute.id },
      include: {
        masterTest: {
          select: {
            title: true,
            testType: true,
            totalMarks: true,
          },
        },
        attempts: {
          select: {
            id: true,
            studentId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const formattedActivations = recentActivations.map(activation => ({
      id: activation.id,
      masterTestTitle: activation.masterTest.title,
      testType: activation.masterTest.testType,
      totalMarks: activation.masterTest.totalMarks,
      activationDate: activation.activationDate.toISOString(),
      expiryDate: activation.expiryDate.toISOString(),
      maxAttempts: activation.maxAttempts,
      studentsAssigned: totalStudents,
      studentsAttempted: new Set(activation.attempts.map(a => a.studentId)).size,
    }));

    // Get recent students
    const recentStudents = await prisma.student.findMany({
      where: { instituteId: institute.id },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
        testAttempts: {
          where: { status: 'SUBMITTED' },
          select: {
            percentage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const formattedStudents = recentStudents.map(student => {
      const submittedAttempts = student.testAttempts.filter(a => a.percentage !== null);
      const avgScore = submittedAttempts.length > 0
        ? submittedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / submittedAttempts.length
        : 0;

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.user.email,
        phone: student.phone || '',
        createdAt: student.createdAt.toISOString(),
        testsAttempted: student.testAttempts.length,
        averageScore: avgScore,
      };
    });

    return {
      institute: {
        instituteName: institute.instituteName,
        city: institute.city,
        state: institute.state,
        contactPerson: institute.contactPerson,
        isVerified: institute.isVerified,
      },
      stats: {
        totalStudents,
        activeTests,
        upcomingTests,
        completedTests,
        averagePerformance,
        totalAttempts,
      },
      recentActivations: formattedActivations,
      recentStudents: formattedStudents,
    };
  },

  // Get all students
  getStudents: async (userId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const students = await prisma.student.findMany({
      where: { instituteId: institute.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        testAttempts: {
          where: { status: 'SUBMITTED' },
          select: {
            percentage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return students.map(student => {
      const submittedAttempts = student.testAttempts.filter(a => a.percentage !== null);
      const avgScore = submittedAttempts.length > 0
        ? submittedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / submittedAttempts.length
        : 0;

      return {
        id: student.id,
        userId: student.userId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.user.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth?.toISOString() || null,
        gender: student.gender,
        city: student.city,
        state: student.state,
        createdAt: student.createdAt.toISOString(),
        testsAttempted: student.testAttempts.length,
        averageScore: avgScore,
        isActive: student.user.isActive,
      };
    });
  },

  // Add a new student
  addStudent: async (userId: string, studentData: any) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: studentData.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(studentData.password);

    // Create user and student profile
    const user = await prisma.user.create({
      data: {
        email: studentData.email,
        password: hashedPassword,
        role: Role.STUDENT,
        student: {
          create: {
            firstName: studentData.firstName,
            lastName: studentData.lastName,
            instituteId: institute.id,
            phone: studentData.phone,
            dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : null,
            gender: studentData.gender,
          },
        },
      },
      include: {
        student: true,
      },
    });

    return {
      id: user.student!.id,
      firstName: user.student!.firstName,
      lastName: user.student!.lastName,
      email: user.email,
    };
  },

  // Bulk upload students
  bulkUploadStudents: async (userId: string, studentsData: any[]) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    let successCount = 0;
    const errors: any[] = [];

    for (const studentData of studentsData) {
      try {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: studentData.email },
        });

        if (existingUser) {
          errors.push({ email: studentData.email, error: 'Email already registered' });
          continue;
        }

        // Hash password
        const hashedPassword = await hashPassword(studentData.password);

        // Create user and student profile
        await prisma.user.create({
          data: {
            email: studentData.email,
            password: hashedPassword,
            role: Role.STUDENT,
            student: {
              create: {
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                instituteId: institute.id,
                phone: studentData.phone || null,
                dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : null,
                gender: studentData.gender || null,
              },
            },
          },
        });

        successCount++;
      } catch (error: any) {
        errors.push({ email: studentData.email, error: error.message });
      }
    }

    return { 
      count: successCount, 
      total: studentsData.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  // Toggle student status
  toggleStudentStatus: async (userId: string, studentId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student || student.instituteId !== institute.id) {
      throw new Error('Student not found or does not belong to this institute');
    }

    const updatedUser = await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: !student.user.isActive },
    });

    return {
      id: student.id,
      isActive: updatedUser.isActive,
    };
  },

  // Get all master tests
  getMasterTests: async () => {
    const tests = await prisma.masterTest.findMany({
      where: { isActive: true },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        questions: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tests.map(test => ({
      id: test.id,
      title: test.title,
      description: test.description,
      testType: test.testType,
      duration: test.duration,
      totalMarks: test.totalMarks,
      passingMarks: test.passingMarks,
      totalQuestions: test.questions.length,
      operatorName: `${test.createdBy.firstName} ${test.createdBy.lastName}`,
      createdAt: test.createdAt.toISOString(),
      isActive: test.isActive,
    }));
  },

  // Activate a test
  activateTest: async (userId: string, activationData: any) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Check if test is already activated
    const existing = await prisma.instituteTestActivation.findUnique({
      where: {
        instituteId_masterTestId: {
          instituteId: institute.id,
          masterTestId: activationData.masterTestId,
        },
      },
    });

    if (existing) {
      throw new Error('Test already activated for this institute');
    }

    const activation = await prisma.instituteTestActivation.create({
      data: {
        instituteId: institute.id,
        masterTestId: activationData.masterTestId,
        activationDate: new Date(activationData.activationDate),
        expiryDate: new Date(activationData.expiryDate),
        startTime: activationData.startTime ? new Date(activationData.startTime) : null,
        endTime: activationData.endTime ? new Date(activationData.endTime) : null,
        maxAttempts: activationData.maxAttempts || 1,
        isActive: true,
      },
    });

    return activation;
  },

  // Get test activations
  getTestActivations: async (userId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const totalStudents = await prisma.student.count({
      where: { instituteId: institute.id },
    });

    const activations = await prisma.instituteTestActivation.findMany({
      where: { instituteId: institute.id },
      include: {
        masterTest: {
          select: {
            title: true,
            testType: true,
            totalMarks: true,
            duration: true,
          },
        },
        attempts: {
          where: { status: 'SUBMITTED' },
          select: {
            studentId: true,
            percentage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return activations.map(activation => {
      const uniqueStudents = new Set(activation.attempts.map(a => a.studentId)).size;
      const avgScore = activation.attempts.length > 0
        ? activation.attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / activation.attempts.length
        : 0;

      return {
        id: activation.id,
        masterTestTitle: activation.masterTest.title,
        testType: activation.masterTest.testType,
        totalMarks: activation.masterTest.totalMarks,
        duration: activation.masterTest.duration,
        activationDate: activation.activationDate.toISOString(),
        expiryDate: activation.expiryDate.toISOString(),
        startTime: activation.startTime?.toISOString() || null,
        endTime: activation.endTime?.toISOString() || null,
        maxAttempts: activation.maxAttempts,
        isActive: activation.isActive,
        studentsAssigned: totalStudents,
        studentsAttempted: uniqueStudents,
        averageScore: avgScore,
      };
    });
  },

  // Deactivate test
  deactivateTest: async (userId: string, activationId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const activation = await prisma.instituteTestActivation.findUnique({
      where: { id: activationId },
    });

    if (!activation || activation.instituteId !== institute.id) {
      throw new Error('Test activation not found');
    }

    const updated = await prisma.instituteTestActivation.update({
      where: { id: activationId },
      data: { isActive: false },
    });

    return updated;
  },

  // Extend deadline
  extendDeadline: async (userId: string, activationId: string, expiryDate: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const activation = await prisma.instituteTestActivation.findUnique({
      where: { id: activationId },
    });

    if (!activation || activation.instituteId !== institute.id) {
      throw new Error('Test activation not found');
    }

    const updated = await prisma.instituteTestActivation.update({
      where: { id: activationId },
      data: { expiryDate: new Date(expiryDate) },
    });

    return updated;
  },

  // Get analytics
  getAnalytics: async (userId: string, period: string = 'month') => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // TODO: Implement detailed analytics based on period
    // For now, return mock data structure
    return {
      period,
      totalStudents: 0,
      totalTests: 0,
      totalAttempts: 0,
      averageScore: 0,
      passPercentage: 0,
    };
  },
};
