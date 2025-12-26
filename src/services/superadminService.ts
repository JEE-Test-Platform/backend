import { PrismaClient, Role, Gender } from '@prisma/client';
import { hashPassword } from '../utils/password';

const prisma = new PrismaClient();

// Dashboard Overview
export const getDashboard = async (userId: string) => {
  const [totalOperators, totalInstitutes, totalStudents, totalTests, totalAttempts] = await Promise.all([
    prisma.operator.count(),
    prisma.institute.count(),
    prisma.student.count(),
    prisma.masterTest.count(),
    prisma.testAttempt.count({ where: { status: 'SUBMITTED' } }),
  ]);

  const avgScoreResult = await prisma.testAttempt.aggregate({
    where: { status: 'SUBMITTED' },
    _avg: { percentage: true },
  });

  return {
    totalOperators,
    totalInstitutes,
    totalStudents,
    totalTests,
    totalAttempts,
    averageScore: avgScoreResult._avg.percentage || 0,
  };
};

// ==================== OPERATOR CRUD ====================

export const getAllOperators = async () => {
  const operators = await prisma.operator.findMany({
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          masterTests: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return operators.map((op) => ({
    id: op.id,
    userId: op.userId,
    firstName: op.firstName,
    lastName: op.lastName,
    email: op.user.email,
    phone: op.phone,
    department: op.department,
    designation: op.designation,
    testsCreated: op._count.masterTests,
    isActive: op.user.isActive,
    createdAt: op.createdAt,
  }));
};

export const getOperatorById = async (operatorId: string) => {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      masterTests: {
        select: {
          id: true,
          title: true,
          testType: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!operator) {
    throw new Error('Operator not found');
  }

  return {
    id: operator.id,
    userId: operator.userId,
    firstName: operator.firstName,
    lastName: operator.lastName,
    email: operator.user.email,
    phone: operator.phone,
    department: operator.department,
    designation: operator.designation,
    isActive: operator.user.isActive,
    masterTests: operator.masterTests,
    createdAt: operator.createdAt,
    updatedAt: operator.updatedAt,
  };
};

export const createOperator = async (data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  department?: string;
  designation?: string;
}) => {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await hashPassword(data.password);

  const operator = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      role: Role.OPERATOR,
      isActive: true,
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

  return operator;
};

export const updateOperator = async (
  operatorId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    department?: string;
    designation?: string;
  }
) => {
  const operator = await prisma.operator.update({
    where: { id: operatorId },
    data,
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
        },
      },
    },
  });

  return operator;
};

export const deleteOperator = async (operatorId: string) => {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
  });

  if (!operator) {
    throw new Error('Operator not found');
  }

  // Delete User (cascade will delete operator)
  await prisma.user.delete({
    where: { id: operator.userId },
  });

  return { message: 'Operator deleted successfully' };
};

export const toggleOperatorStatus = async (operatorId: string) => {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    include: { user: true },
  });

  if (!operator) {
    throw new Error('Operator not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: operator.userId },
    data: { isActive: !operator.user.isActive },
  });

  return { isActive: updatedUser.isActive };
};

// ==================== INSTITUTE CRUD ====================

export const getAllInstitutes = async () => {
  const institutes = await prisma.institute.findMany({
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          students: true,
          testActivations: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return institutes.map((inst) => ({
    id: inst.id,
    userId: inst.userId,
    instituteName: inst.instituteName,
    registrationNo: inst.registrationNo,
    email: inst.user.email,
    city: inst.city,
    state: inst.state,
    phone: inst.phone,
    contactPerson: inst.contactPerson,
    contactEmail: inst.contactEmail,
    isVerified: inst.isVerified,
    isActive: inst.user.isActive,
    studentsCount: inst._count.students,
    activeTestsCount: inst._count.testActivations,
    createdAt: inst.createdAt,
  }));
};

export const getInstituteById = async (instituteId: string) => {
  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      students: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: {
            select: {
              email: true,
              isActive: true,
            },
          },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      testActivations: {
        select: {
          id: true,
          masterTest: {
            select: {
              title: true,
              testType: true,
            },
          },
          isActive: true,
          activationDate: true,
          expiryDate: true,
        },
        take: 10,
        orderBy: { activationDate: 'desc' },
      },
    },
  });

  if (!institute) {
    throw new Error('Institute not found');
  }

  return institute;
};

export const createInstitute = async (data: {
  email: string;
  password: string;
  instituteName: string;
  registrationNo?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  website?: string;
  establishedYear?: number;
  principalName?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}) => {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await hashPassword(data.password);

  const institute = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      role: Role.INSTITUTE,
      isActive: true,
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
          isVerified: false, // Default to not verified
        },
      },
    },
    include: {
      institute: true,
    },
  });

  return institute;
};

export const updateInstitute = async (
  instituteId: string,
  data: {
    instituteName?: string;
    registrationNo?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    website?: string;
    establishedYear?: number;
    principalName?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
  }
) => {
  const institute = await prisma.institute.update({
    where: { id: instituteId },
    data,
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
        },
      },
    },
  });

  return institute;
};

export const deleteInstitute = async (instituteId: string) => {
  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
  });

  if (!institute) {
    throw new Error('Institute not found');
  }

  // Delete User (cascade will delete institute)
  await prisma.user.delete({
    where: { id: institute.userId },
  });

  return { message: 'Institute deleted successfully' };
};

export const verifyInstitute = async (instituteId: string) => {
  const institute = await prisma.institute.update({
    where: { id: instituteId },
    data: { isVerified: true },
  });

  return { isVerified: institute.isVerified };
};

export const toggleInstituteStatus = async (instituteId: string) => {
  const institute = await prisma.institute.findUnique({
    where: { id: instituteId },
    include: { user: true },
  });

  if (!institute) {
    throw new Error('Institute not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: institute.userId },
    data: { isActive: !institute.user.isActive },
  });

  return { isActive: updatedUser.isActive };
};

// ==================== STUDENT CRUD ====================

export const getAllStudents = async (filters?: { instituteId?: string; search?: string }) => {
  const where: any = {};

  if (filters?.instituteId) {
    where.instituteId = filters.instituteId;
  }

  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
          createdAt: true,
        },
      },
      institute: {
        select: {
          instituteName: true,
        },
      },
      _count: {
        select: {
          testAttempts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate average score for each student
  const studentsWithScores = await Promise.all(
    students.map(async (student) => {
      const avgResult = await prisma.testAttempt.aggregate({
        where: {
          studentId: student.id,
          status: 'SUBMITTED',
        },
        _avg: { percentage: true },
      });

      return {
        id: student.id,
        userId: student.userId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.user.email,
        phone: student.phone,
        instituteName: student.institute.instituteName,
        instituteId: student.instituteId,
        testsAttempted: student._count.testAttempts,
        averageScore: avgResult._avg.percentage || 0,
        isActive: student.user.isActive,
        createdAt: student.createdAt,
      };
    })
  );

  return studentsWithScores;
};

export const getStudentById = async (studentId: string) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      institute: {
        select: {
          instituteName: true,
          city: true,
          state: true,
        },
      },
      testAttempts: {
        where: { status: 'SUBMITTED' },
        include: {
          testActivation: {
            include: {
              masterTest: {
                select: {
                  title: true,
                  testType: true,
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // Calculate performance stats
  const avgResult = await prisma.testAttempt.aggregate({
    where: {
      studentId: student.id,
      status: 'SUBMITTED',
    },
    _avg: { percentage: true, rank: true },
  });

  return {
    ...student,
    averageScore: avgResult._avg.percentage || 0,
    averageRank: avgResult._avg.rank || 0,
  };
};

export const updateStudent = async (
  studentId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: Date;
    gender?: Gender;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    guardianName?: string;
    guardianPhone?: string;
    emergencyContact?: string;
  }
) => {
  const student = await prisma.student.update({
    where: { id: studentId },
    data,
    include: {
      user: {
        select: {
          email: true,
          isActive: true,
        },
      },
      institute: {
        select: {
          instituteName: true,
        },
      },
    },
  });

  return student;
};

export const deleteStudent = async (studentId: string) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // Delete User (cascade will delete student)
  await prisma.user.delete({
    where: { id: student.userId },
  });

  return { message: 'Student deleted successfully' };
};

export const toggleStudentStatus = async (studentId: string) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: student.userId },
    data: { isActive: !student.user.isActive },
  });

  return { isActive: updatedUser.isActive };
};

// ==================== PERFORMANCE ANALYTICS ====================

export const getOverallPerformanceAnalytics = async () => {
  // Get all submitted test attempts with details
  const attempts = await prisma.testAttempt.findMany({
    where: { status: 'SUBMITTED' },
    include: {
      student: {
        include: {
          institute: {
            select: { instituteName: true },
          },
        },
      },
      testActivation: {
        include: {
          masterTest: {
            select: { testType: true },
          },
        },
      },
      answers: {
        include: {
          question: {
            select: { subject: true, difficulty: true },
          },
        },
      },
    },
  });

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      subjectPerformance: [],
      testTypeBreakdown: [],
      institutePerformance: [],
    };
  }

  // Calculate overall average score
  const totalScore = attempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0);
  const averageScore = totalScore / attempts.length;

  // Subject-wise performance
  const subjectStats: any = {};
  attempts.forEach((attempt) => {
    attempt.answers.forEach((answer) => {
      const subject = answer.question.subject;
      if (!subjectStats[subject]) {
        subjectStats[subject] = { correct: 0, total: 0 };
      }
      subjectStats[subject].total++;
      if (answer.isCorrect) {
        subjectStats[subject].correct++;
      }
    });
  });

  const subjectPerformance = Object.entries(subjectStats).map(([subject, stats]: any) => ({
    subject,
    accuracy: (stats.correct / stats.total) * 100,
    totalQuestions: stats.total,
  }));

  // Test type breakdown
  const testTypeStats: any = {};
  attempts.forEach((attempt) => {
    const testType = attempt.testActivation.masterTest.testType;
    if (!testTypeStats[testType]) {
      testTypeStats[testType] = { count: 0, totalScore: 0 };
    }
    testTypeStats[testType].count++;
    testTypeStats[testType].totalScore += attempt.percentage || 0;
  });

  const testTypeBreakdown = Object.entries(testTypeStats).map(([testType, stats]: any) => ({
    testType,
    averageScore: stats.totalScore / stats.count,
    attemptCount: stats.count,
  }));

  // Institute performance comparison
  const instituteStats: any = {};
  attempts.forEach((attempt) => {
    const instituteName = attempt.student.institute.instituteName;
    if (!instituteStats[instituteName]) {
      instituteStats[instituteName] = { count: 0, totalScore: 0 };
    }
    instituteStats[instituteName].count++;
    instituteStats[instituteName].totalScore += attempt.percentage || 0;
  });

  const institutePerformance = Object.entries(instituteStats).map(([instituteName, stats]: any) => ({
    instituteName,
    averageScore: stats.totalScore / stats.count,
    totalAttempts: stats.count,
  }));

  return {
    totalAttempts: attempts.length,
    averageScore,
    subjectPerformance,
    testTypeBreakdown,
    institutePerformance,
  };
};

export const getTopPerformers = async (limit: number = 10) => {
  // Get students with their average scores
  const students = await prisma.student.findMany({
    include: {
      user: {
        select: { email: true },
      },
      institute: {
        select: { instituteName: true },
      },
      testAttempts: {
        where: { status: 'SUBMITTED' },
        select: { percentage: true },
      },
    },
  });

  // Calculate average score for each student
  const studentsWithAvg = students
    .map((student) => {
      const attempts = student.testAttempts;
      if (attempts.length === 0) return null;

      const totalScore = attempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0);
      const avgScore = totalScore / attempts.length;

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.user.email,
        instituteName: student.institute.instituteName,
        averageScore: avgScore,
        totalAttempts: attempts.length,
      };
    })
    .filter((student) => student !== null)
    .sort((a: any, b: any) => b.averageScore - a.averageScore)
    .slice(0, limit);

  return studentsWithAvg;
};
