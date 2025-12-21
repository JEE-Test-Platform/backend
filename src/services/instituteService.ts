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

  // Get single master test with full details
  getMasterTestById: async (testId: string) => {
    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        questions: {
          include: {
            options: {
              orderBy: { optionLabel: 'asc' },
            },
          },
          orderBy: { questionOrder: 'asc' },
        },
      },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    return {
      id: test.id,
      title: test.title,
      description: test.description,
      testType: test.testType,
      duration: test.duration,
      totalMarks: test.totalMarks,
      passingMarks: test.passingMarks,
      instructions: test.instructions || '',
      isActive: test.isActive,
      createdAt: test.createdAt.toISOString(),
      operatorName: `${test.createdBy.firstName} ${test.createdBy.lastName}`,
      questions: test.questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        subject: q.subject,
        difficulty: q.difficulty,
        marks: q.marks,
        negativeMarks: 0, // Default to 0 as schema doesn't have this field
        orderIndex: q.questionOrder,
        options: q.options.map(o => ({
          id: o.id,
          optionText: o.optionText,
          optionLabel: o.optionLabel,
        })),
      })),
    };
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

    // Parse dates and times
    const activationDate = new Date(activationData.activationDate);
    const expiryDate = new Date(activationData.expiryDate);

    // Combine date with time if provided (time is in HH:MM format)
    let startTime = null;
    let endTime = null;

    if (activationData.startTime) {
      const [hours, minutes] = activationData.startTime.split(':');
      startTime = new Date(activationData.activationDate);
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    if (activationData.endTime) {
      const [hours, minutes] = activationData.endTime.split(':');
      endTime = new Date(activationData.expiryDate);
      endTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    const activation = await prisma.instituteTestActivation.create({
      data: {
        instituteId: institute.id,
        masterTestId: activationData.masterTestId,
        activationDate,
        expiryDate,
        startTime,
        endTime,
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

  // Get detailed activation information
  getActivationDetails: async (userId: string, activationId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const activation = await prisma.instituteTestActivation.findUnique({
      where: { id: activationId },
      include: {
        masterTest: {
          select: {
            title: true,
            testType: true,
            totalMarks: true,
            passingMarks: true,
            duration: true,
          },
        },
        attempts: {
          where: { status: 'SUBMITTED' },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!activation || activation.instituteId !== institute.id) {
      throw new Error('Activation not found');
    }

    const totalStudents = await prisma.student.count({
      where: { instituteId: institute.id },
    });

    // Calculate statistics
    const uniqueStudents = new Set(activation.attempts.map(a => a.studentId)).size;
    const percentages = activation.attempts.map(a => a.percentage || 0);

    const avgScore = percentages.length > 0
      ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      : 0;

    const highestScore = percentages.length > 0
      ? Math.max(...percentages)
      : 0;

    const lowestScore = percentages.length > 0
      ? Math.min(...percentages)
      : 0;

    const passedCount = activation.attempts.filter(a =>
      (a.obtainedMarks || 0) >= activation.masterTest.passingMarks
    ).length;

    const passPercentage = percentages.length > 0
      ? (passedCount / percentages.length) * 100
      : 0;

    return {
      id: activation.id,
      masterTestTitle: activation.masterTest.title,
      testType: activation.masterTest.testType,
      totalMarks: activation.masterTest.totalMarks,
      passingMarks: activation.masterTest.passingMarks,
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
      highestScore: highestScore,
      lowestScore: lowestScore,
      passPercentage: passPercentage,
      attempts: activation.attempts.map(attempt => ({
        id: attempt.id,
        studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
        studentEmail: attempt.student.user.email,
        obtainedMarks: attempt.obtainedMarks || 0,
        percentage: attempt.percentage || 0,
        rank: attempt.rank || 0,
        submittedAt: attempt.submittedAt?.toISOString() || '',
        timeTaken: (attempt.timeSpent || 0) * 60, // Convert minutes to seconds for consistency
      })),
    };
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

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
    }

    // Get all students for this institute
    const totalStudents = await prisma.student.count({
      where: { instituteId: institute.id },
    });

    // Get all test activations for this institute
    const totalTestsActivated = await prisma.instituteTestActivation.count({
      where: { 
        instituteId: institute.id,
        createdAt: { gte: startDate },
      },
    });

    // Get all submitted attempts for this institute's students within period
    const attempts = await prisma.testAttempt.findMany({
      where: {
        student: { instituteId: institute.id },
        status: 'SUBMITTED',
        submittedAt: { gte: startDate },
      },
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                testType: true,
                passingMarks: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                subject: true,
                difficulty: true,
                questionType: true,
                marks: true,
              },
            },
          },
        },
      },
    });

    const totalAttempts = attempts.length;

    // Calculate average score and pass rate
    const percentages = attempts.map(a => a.percentage || 0);
    const averageScore = percentages.length > 0
      ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      : 0;

    const passedAttempts = attempts.filter(a => 
      (a.obtainedMarks || 0) >= (a.testActivation.masterTest.passingMarks || 0)
    ).length;
    const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;

    // Subject-wise Performance
    const subjectStats: Record<string, { totalQuestions: number; correctAnswers: number; totalMarks: number; obtainedMarks: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const subject = answer.question.subject;
        if (!subjectStats[subject]) {
          subjectStats[subject] = { totalQuestions: 0, correctAnswers: 0, totalMarks: 0, obtainedMarks: 0 };
        }
        subjectStats[subject].totalQuestions++;
        subjectStats[subject].totalMarks += answer.question.marks;
        subjectStats[subject].obtainedMarks += answer.marksObtained || 0;
        if (answer.isCorrect) {
          subjectStats[subject].correctAnswers++;
        }
      }
    }

    const subjectWisePerformance = Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      totalAttempts: stats.totalQuestions,
      averageScore: stats.totalMarks > 0 ? (stats.obtainedMarks / stats.totalMarks) * 100 : 0,
      passRate: stats.totalQuestions > 0 ? (stats.correctAnswers / stats.totalQuestions) * 100 : 0,
      accuracy: stats.totalQuestions > 0 ? (stats.correctAnswers / stats.totalQuestions) * 100 : 0,
    }));

    // Difficulty-wise Performance
    const difficultyStats: Record<string, { totalQuestions: number; correctAnswers: number; totalMarks: number; obtainedMarks: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const difficulty = answer.question.difficulty;
        if (!difficultyStats[difficulty]) {
          difficultyStats[difficulty] = { totalQuestions: 0, correctAnswers: 0, totalMarks: 0, obtainedMarks: 0 };
        }
        difficultyStats[difficulty].totalQuestions++;
        difficultyStats[difficulty].totalMarks += answer.question.marks;
        difficultyStats[difficulty].obtainedMarks += answer.marksObtained || 0;
        if (answer.isCorrect) {
          difficultyStats[difficulty].correctAnswers++;
        }
      }
    }

    const difficultyWisePerformance = Object.entries(difficultyStats).map(([difficulty, stats]) => ({
      difficulty,
      totalQuestions: stats.totalQuestions,
      correctAnswers: stats.correctAnswers,
      averageScore: stats.totalMarks > 0 ? (stats.obtainedMarks / stats.totalMarks) * 100 : 0,
      accuracy: stats.totalQuestions > 0 ? (stats.correctAnswers / stats.totalQuestions) * 100 : 0,
    }));

    // Question Type Performance
    const questionTypeStats: Record<string, { totalQuestions: number; correctAnswers: number; totalMarks: number; obtainedMarks: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const qType = answer.question.questionType;
        if (!questionTypeStats[qType]) {
          questionTypeStats[qType] = { totalQuestions: 0, correctAnswers: 0, totalMarks: 0, obtainedMarks: 0 };
        }
        questionTypeStats[qType].totalQuestions++;
        questionTypeStats[qType].totalMarks += answer.question.marks;
        questionTypeStats[qType].obtainedMarks += answer.marksObtained || 0;
        if (answer.isCorrect) {
          questionTypeStats[qType].correctAnswers++;
        }
      }
    }

    const questionTypePerformance = Object.entries(questionTypeStats).map(([questionType, stats]) => ({
      questionType,
      totalQuestions: stats.totalQuestions,
      correctAnswers: stats.correctAnswers,
      averageScore: stats.totalMarks > 0 ? (stats.obtainedMarks / stats.totalMarks) * 100 : 0,
      accuracy: stats.totalQuestions > 0 ? (stats.correctAnswers / stats.totalQuestions) * 100 : 0,
    }));

    // Test Type Performance
    const testTypeStats: Record<string, { activations: Set<string>; attempts: number; totalPercentage: number }> = {};
    
    for (const attempt of attempts) {
      const testType = attempt.testActivation.masterTest.testType;
      if (!testTypeStats[testType]) {
        testTypeStats[testType] = { activations: new Set(), attempts: 0, totalPercentage: 0 };
      }
      testTypeStats[testType].activations.add(attempt.testActivation.id);
      testTypeStats[testType].attempts++;
      testTypeStats[testType].totalPercentage += attempt.percentage || 0;
    }

    const testTypePerformance = Object.entries(testTypeStats).map(([testType, stats]) => ({
      testType,
      totalActivations: stats.activations.size,
      totalAttempts: stats.attempts,
      averageScore: stats.attempts > 0 ? stats.totalPercentage / stats.attempts : 0,
    }));

    // Top Performers
    const studentPerformance: Record<string, { name: string; totalPercentage: number; testsAttempted: number }> = {};
    
    for (const attempt of attempts) {
      const studentId = attempt.student.id;
      const studentName = `${attempt.student.firstName} ${attempt.student.lastName}`;
      if (!studentPerformance[studentId]) {
        studentPerformance[studentId] = { name: studentName, totalPercentage: 0, testsAttempted: 0 };
      }
      studentPerformance[studentId].totalPercentage += attempt.percentage || 0;
      studentPerformance[studentId].testsAttempted++;
    }

    const topPerformers = Object.entries(studentPerformance)
      .map(([studentId, stats]) => ({
        studentId,
        studentName: stats.name,
        testsAttempted: stats.testsAttempted,
        averageScore: stats.testsAttempted > 0 ? stats.totalPercentage / stats.testsAttempted : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    // Recent Trends (monthly breakdown)
    const trendData: Record<string, { totalPercentage: number; count: number }> = {};
    
    for (const attempt of attempts) {
      const monthYear = attempt.submittedAt 
        ? `${attempt.submittedAt.getFullYear()}-${String(attempt.submittedAt.getMonth() + 1).padStart(2, '0')}`
        : '';
      if (monthYear) {
        if (!trendData[monthYear]) {
          trendData[monthYear] = { totalPercentage: 0, count: 0 };
        }
        trendData[monthYear].totalPercentage += attempt.percentage || 0;
        trendData[monthYear].count++;
      }
    }

    const recentTrends = Object.entries(trendData)
      .map(([month, stats]) => ({
        month,
        averageScore: stats.count > 0 ? stats.totalPercentage / stats.count : 0,
        totalAttempts: stats.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Completion Rate Analysis
    const allAttempts = await prisma.testAttempt.findMany({
      where: {
        student: { instituteId: institute.id },
        startedAt: { gte: startDate },
      },
      select: {
        status: true,
      },
    });

    const completionStats = {
      submitted: allAttempts.filter(a => a.status === 'SUBMITTED').length,
      inProgress: allAttempts.filter(a => a.status === 'IN_PROGRESS').length,
      expired: allAttempts.filter(a => a.status === 'EXPIRED').length,
      completed: allAttempts.filter(a => a.status === 'COMPLETED').length,
    };

    // Time Analysis
    const timeStats = attempts.filter(a => a.timeSpent !== null);
    const avgTimeSpent = timeStats.length > 0
      ? timeStats.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / timeStats.length
      : 0;

    // Score Distribution (for histogram)
    const scoreDistribution = [
      { range: '0-20%', count: attempts.filter(a => (a.percentage || 0) >= 0 && (a.percentage || 0) < 20).length },
      { range: '20-40%', count: attempts.filter(a => (a.percentage || 0) >= 20 && (a.percentage || 0) < 40).length },
      { range: '40-60%', count: attempts.filter(a => (a.percentage || 0) >= 40 && (a.percentage || 0) < 60).length },
      { range: '60-80%', count: attempts.filter(a => (a.percentage || 0) >= 60 && (a.percentage || 0) < 80).length },
      { range: '80-100%', count: attempts.filter(a => (a.percentage || 0) >= 80 && (a.percentage || 0) <= 100).length },
    ];

    return {
      overview: {
        totalStudents,
        totalTestsActivated,
        totalAttempts,
        averageScore,
        passRate,
        avgTimeSpent,
      },
      subjectWisePerformance,
      difficultyWisePerformance,
      questionTypePerformance,
      testTypePerformance,
      topPerformers,
      recentTrends,
      completionStats,
      scoreDistribution,
    };
  },

  // Get top performers for the institute
  getTopPerformers: async (userId: string, limit: number = 10) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Import leaderboard service
    const { leaderboardService } = require('./leaderboardService');
    
    return await leaderboardService.getInstituteTopPerformers(institute.id, limit);
  },

  // Get leaderboard overview
  getLeaderboardOverview: async (userId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Import leaderboard service
    const { leaderboardService } = require('./leaderboardService');
    
    return await leaderboardService.getInstituteLeaderboardOverview(institute.id);
  },

  // Get test-specific leaderboard
  getTestLeaderboard: async (userId: string, testActivationId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Import leaderboard service
    const { leaderboardService } = require('./leaderboardService');
    
    return await leaderboardService.getTestLeaderboard(testActivationId, institute.id);
  },

  // Get detailed analytics for a specific student
  getStudentAnalytics: async (userId: string, studentId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    // Verify student belongs to this institute
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!student || student.instituteId !== institute.id) {
      throw new Error('Student not found or does not belong to this institute');
    }

    // Get all attempts for this student
    const attempts = await prisma.testAttempt.findMany({
      where: {
        studentId: studentId,
        status: 'SUBMITTED',
      },
      include: {
        testActivation: {
          include: {
            masterTest: {
              select: {
                title: true,
                testType: true,
                totalMarks: true,
                passingMarks: true,
              },
            },
          },
        },
        answers: {
          include: {
            question: {
              select: {
                subject: true,
                difficulty: true,
                questionType: true,
                marks: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Basic stats
    const totalTests = attempts.length;
    const percentages = attempts.map(a => a.percentage || 0);
    const averageScore = percentages.length > 0
      ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      : 0;
    const highestScore = percentages.length > 0 ? Math.max(...percentages) : 0;
    const lowestScore = percentages.length > 0 ? Math.min(...percentages) : 0;

    const passedTests = attempts.filter(a => 
      (a.obtainedMarks || 0) >= (a.testActivation.masterTest.passingMarks || 0)
    ).length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    // Subject-wise breakdown
    const subjectStats: Record<string, { total: number; correct: number; totalMarks: number; obtained: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const subject = answer.question.subject;
        if (!subjectStats[subject]) {
          subjectStats[subject] = { total: 0, correct: 0, totalMarks: 0, obtained: 0 };
        }
        subjectStats[subject].total++;
        subjectStats[subject].totalMarks += answer.question.marks;
        subjectStats[subject].obtained += answer.marksObtained || 0;
        if (answer.isCorrect) {
          subjectStats[subject].correct++;
        }
      }
    }

    const subjectWisePerformance = Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      totalQuestions: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      averageScore: stats.totalMarks > 0 ? (stats.obtained / stats.totalMarks) * 100 : 0,
    }));

    // Difficulty breakdown
    const difficultyStats: Record<string, { total: number; correct: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const difficulty = answer.question.difficulty;
        if (!difficultyStats[difficulty]) {
          difficultyStats[difficulty] = { total: 0, correct: 0 };
        }
        difficultyStats[difficulty].total++;
        if (answer.isCorrect) {
          difficultyStats[difficulty].correct++;
        }
      }
    }

    const difficultyWisePerformance = Object.entries(difficultyStats).map(([difficulty, stats]) => ({
      difficulty,
      totalQuestions: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }));

    // Test history
    const testHistory = attempts.map(attempt => ({
      id: attempt.id,
      testTitle: attempt.testActivation.masterTest.title,
      testType: attempt.testActivation.masterTest.testType,
      totalMarks: attempt.testActivation.masterTest.totalMarks,
      obtainedMarks: attempt.obtainedMarks || 0,
      percentage: attempt.percentage || 0,
      isPassed: (attempt.obtainedMarks || 0) >= (attempt.testActivation.masterTest.passingMarks || 0),
      rank: attempt.rank,
      timeSpent: attempt.timeSpent,
      submittedAt: attempt.submittedAt?.toISOString() || '',
    }));

    // Progress over time (last 6 tests)
    const progressTrend = attempts.slice(0, 6).reverse().map(attempt => ({
      testTitle: attempt.testActivation.masterTest.title,
      percentage: attempt.percentage || 0,
      submittedAt: attempt.submittedAt?.toISOString() || '',
    }));

    // Strengths and weaknesses
    const subjectsByScore = subjectWisePerformance.sort((a, b) => b.accuracy - a.accuracy);
    const strengths = subjectsByScore.slice(0, 2).map(s => s.subject);
    const weaknesses = subjectsByScore.slice(-2).reverse().map(s => s.subject);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.user.email,
        isActive: student.user.isActive,
      },
      overview: {
        totalTests,
        averageScore,
        highestScore,
        lowestScore,
        passRate,
        passedTests,
        totalTimeSpent: attempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0),
      },
      subjectWisePerformance,
      difficultyWisePerformance,
      testHistory,
      progressTrend,
      insights: {
        strengths,
        weaknesses,
        recommendation: averageScore < 50 
          ? 'Focus on fundamentals and practice more questions'
          : averageScore < 70 
          ? 'Good progress! Target weak areas for improvement'
          : 'Excellent performance! Maintain consistency',
      },
    };
  },

  // Get test-wise analytics for an activation
  getTestAnalytics: async (userId: string, activationId: string) => {
    const institute = await prisma.institute.findUnique({
      where: { userId },
    });

    if (!institute) {
      throw new Error('Institute not found');
    }

    const activation = await prisma.instituteTestActivation.findUnique({
      where: { id: activationId },
      include: {
        masterTest: {
          include: {
            questions: {
              select: {
                id: true,
                subject: true,
                difficulty: true,
                questionType: true,
                marks: true,
              },
            },
          },
        },
      },
    });

    if (!activation || activation.instituteId !== institute.id) {
      throw new Error('Test activation not found');
    }

    // Get all submitted attempts for this test
    const attempts = await prisma.testAttempt.findMany({
      where: {
        testActivationId: activationId,
        status: 'SUBMITTED',
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                subject: true,
                difficulty: true,
                questionType: true,
              },
            },
          },
        },
      },
      orderBy: { percentage: 'desc' },
    });

    // Basic stats
    const totalAttempts = attempts.length;
    const totalStudents = await prisma.student.count({
      where: { instituteId: institute.id },
    });
    const participationRate = totalStudents > 0 ? (totalAttempts / totalStudents) * 100 : 0;

    const percentages = attempts.map(a => a.percentage || 0);
    const averageScore = percentages.length > 0
      ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      : 0;
    const highestScore = percentages.length > 0 ? Math.max(...percentages) : 0;
    const lowestScore = percentages.length > 0 ? Math.min(...percentages) : 0;

    const passedAttempts = attempts.filter(a => 
      (a.obtainedMarks || 0) >= (activation.masterTest.passingMarks || 0)
    ).length;
    const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;

    // Question-wise analysis
    const questionStats: Record<string, { total: number; correct: number; avgTime: number; timeCount: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const qId = answer.question.id;
        if (!questionStats[qId]) {
          questionStats[qId] = { total: 0, correct: 0, avgTime: 0, timeCount: 0 };
        }
        questionStats[qId].total++;
        if (answer.isCorrect) {
          questionStats[qId].correct++;
        }
        if (answer.timeSpent) {
          questionStats[qId].avgTime += answer.timeSpent;
          questionStats[qId].timeCount++;
        }
      }
    }

    // Subject breakdown
    const subjectStats: Record<string, { total: number; correct: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const subject = answer.question.subject;
        if (!subjectStats[subject]) {
          subjectStats[subject] = { total: 0, correct: 0 };
        }
        subjectStats[subject].total++;
        if (answer.isCorrect) {
          subjectStats[subject].correct++;
        }
      }
    }

    const subjectPerformance = Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      totalAttempts: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }));

    // Difficulty breakdown
    const difficultyStats: Record<string, { total: number; correct: number }> = {};
    
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const difficulty = answer.question.difficulty;
        if (!difficultyStats[difficulty]) {
          difficultyStats[difficulty] = { total: 0, correct: 0 };
        }
        difficultyStats[difficulty].total++;
        if (answer.isCorrect) {
          difficultyStats[difficulty].correct++;
        }
      }
    }

    const difficultyPerformance = Object.entries(difficultyStats).map(([difficulty, stats]) => ({
      difficulty,
      totalAttempts: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }));

    // Score distribution
    const scoreDistribution = [
      { range: '0-20%', count: attempts.filter(a => (a.percentage || 0) >= 0 && (a.percentage || 0) < 20).length },
      { range: '20-40%', count: attempts.filter(a => (a.percentage || 0) >= 20 && (a.percentage || 0) < 40).length },
      { range: '40-60%', count: attempts.filter(a => (a.percentage || 0) >= 40 && (a.percentage || 0) < 60).length },
      { range: '60-80%', count: attempts.filter(a => (a.percentage || 0) >= 60 && (a.percentage || 0) < 80).length },
      { range: '80-100%', count: attempts.filter(a => (a.percentage || 0) >= 80 && (a.percentage || 0) <= 100).length },
    ];

    // Top performers
    const topPerformers = attempts.slice(0, 5).map(attempt => ({
      studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
      obtainedMarks: attempt.obtainedMarks || 0,
      percentage: attempt.percentage || 0,
      rank: attempt.rank,
    }));

    // Hardest questions (lowest accuracy)
    const questionAnalysis = activation.masterTest.questions.map(q => {
      const stats = questionStats[q.id] || { total: 0, correct: 0, avgTime: 0, timeCount: 0 };
      return {
        questionId: q.id,
        subject: q.subject,
        difficulty: q.difficulty,
        questionType: q.questionType,
        marks: q.marks,
        totalAttempts: stats.total,
        correctAttempts: stats.correct,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        avgTimeSpent: stats.timeCount > 0 ? stats.avgTime / stats.timeCount : 0,
      };
    }).sort((a, b) => a.accuracy - b.accuracy);

    return {
      test: {
        title: activation.masterTest.title,
        testType: activation.masterTest.testType,
        totalMarks: activation.masterTest.totalMarks,
        passingMarks: activation.masterTest.passingMarks,
        totalQuestions: activation.masterTest.questions.length,
        activationDate: activation.activationDate.toISOString(),
        expiryDate: activation.expiryDate.toISOString(),
      },
      overview: {
        totalStudents,
        totalAttempts,
        participationRate,
        averageScore,
        highestScore,
        lowestScore,
        passRate,
        passedCount: passedAttempts,
      },
      subjectPerformance,
      difficultyPerformance,
      scoreDistribution,
      topPerformers,
      questionAnalysis: questionAnalysis.slice(0, 10), // Top 10 hardest questions
    };
  },
};

