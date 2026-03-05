import prisma from '../utils/prisma';
import Papa from 'papaparse';
import { QuestionType, Subject, Difficulty, TestType, QuestionNature } from '@prisma/client';

interface CSVQuestion {
  questionOrder: string;
  questionText: string;
  questionType: string;
  subject: string;
  difficulty: string;
  nature?: string;  // Question nature: CONCEPTUAL, FORMULA_BASED, APPLICATION_BASED
  marks: string;
  correctAnswer?: string;
  explanation?: string;
  questionImageUrl?: string;
  optionA_text?: string;
  optionA_imageUrl?: string;
  optionA_isCorrect?: string;
  optionB_text?: string;
  optionB_imageUrl?: string;
  optionB_isCorrect?: string;
  optionC_text?: string;
  optionC_imageUrl?: string;
  optionC_isCorrect?: string;
  optionD_text?: string;
  optionD_imageUrl?: string;
  optionD_isCorrect?: string;
}

interface CreateMasterTestDTO {
  title: string;
  description?: string;
  testType: TestType;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  instructions?: string;
}

export const operatorService = {
  // Get operator dashboard
  getDashboard: async (userId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    // Get total tests created
    const totalTests = await prisma.masterTest.count({
      where: { createdById: operator.id },
    });

    // Get active tests
    const activeTests = await prisma.masterTest.count({
      where: {
        createdById: operator.id,
        isActive: true,
      },
    });

    // Get total questions created
    const totalQuestions = await prisma.question.count({
      where: {
        masterTest: {
          createdById: operator.id,
        },
      },
    });

    // Get total activations (how many institutes activated tests)
    const totalActivations = await prisma.instituteTestActivation.count({
      where: {
        masterTest: {
          createdById: operator.id,
        },
      },
    });

    // Get total attempts across all tests
    const totalAttempts = await prisma.testAttempt.count({
      where: {
        testActivation: {
          masterTest: {
            createdById: operator.id,
          },
        },
        status: 'SUBMITTED',
      },
    });

    // Get recent tests
    const recentTests = await prisma.masterTest.findMany({
      where: { createdById: operator.id },
      include: {
        questions: {
          select: { id: true },
        },
        activations: {
          select: {
            id: true,
            institute: {
              select: {
                instituteName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const formattedTests = recentTests.map(test => ({
      id: test.id,
      title: test.title,
      testType: test.testType,
      totalMarks: test.totalMarks,
      totalQuestions: test.questions.length,
      activationsCount: test.activations.length,
      isActive: test.isActive,
      status: test.status,
      createdAt: test.createdAt.toISOString(),
    }));

    return {
      operator: {
        firstName: operator.firstName,
        lastName: operator.lastName,
        email: operator.user.email,
        department: operator.department,
        designation: operator.designation,
      },
      stats: {
        totalTests,
        activeTests,
        totalQuestions,
        totalActivations,
        totalAttempts,
      },
      recentTests: formattedTests,
    };
  },

  // Create master test (without questions)
  createMasterTest: async (userId: string, testData: CreateMasterTestDTO) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const masterTest = await prisma.masterTest.create({
      data: {
        title: testData.title,
        description: testData.description,
        testType: testData.testType,
        duration: testData.duration,
        totalMarks: testData.totalMarks,
        passingMarks: testData.passingMarks,
        instructions: testData.instructions,
        createdById: operator.id,
        isActive: true,
      },
    });

    return masterTest;
  },

  // Parse and validate CSV
  parseCSV: async (csvContent: string): Promise<{ questions: CSVQuestion[]; errors: string[] }> => {
    return new Promise((resolve) => {
      Papa.parse<CSVQuestion>(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const errors: string[] = [];
          const questions: CSVQuestion[] = [];

          results.data.forEach((row, index) => {
            const rowNum = index + 2; // +2 because of header and 0-index

            // Validate required fields
            if (!row.questionOrder) {
              errors.push(`Row ${rowNum}: questionOrder is required`);
            }
            if (!row.questionText) {
              errors.push(`Row ${rowNum}: questionText is required`);
            }
            if (!row.questionType) {
              errors.push(`Row ${rowNum}: questionType is required`);
            }
            if (!row.subject) {
              errors.push(`Row ${rowNum}: subject is required`);
            }
            if (!row.difficulty) {
              errors.push(`Row ${rowNum}: difficulty is required`);
            }
            if (!row.marks) {
              errors.push(`Row ${rowNum}: marks is required`);
            }

            // Validate question type
            const validQuestionTypes = ['MCQ', 'NUMERICAL', 'TRUE_FALSE'];
            if (row.questionType && !validQuestionTypes.includes(row.questionType)) {
              errors.push(`Row ${rowNum}: questionType must be MCQ, NUMERICAL, or TRUE_FALSE`);
            }

            // Validate subject
            const validSubjects = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'GENERAL_KNOWLEDGE'];
            if (row.subject && !validSubjects.includes(row.subject)) {
              errors.push(`Row ${rowNum}: subject must be PHYSICS, CHEMISTRY, MATHEMATICS, or GENERAL_KNOWLEDGE`);
            }

            // Validate difficulty
            const validDifficulties = ['EASY', 'MEDIUM', 'HARD'];
            if (row.difficulty && !validDifficulties.includes(row.difficulty)) {
              errors.push(`Row ${rowNum}: difficulty must be EASY, MEDIUM, or HARD`);
            }

            // Validate nature (optional, defaults to CONCEPTUAL)
            const validNatures = ['CONCEPTUAL', 'FORMULA_BASED', 'APPLICATION_BASED'];
            if (row.nature && !validNatures.includes(row.nature)) {
              errors.push(`Row ${rowNum}: nature must be CONCEPTUAL, FORMULA_BASED, or APPLICATION_BASED`);
            }

            // Validate marks
            if (row.marks && (isNaN(Number(row.marks)) || Number(row.marks) <= 0)) {
              errors.push(`Row ${rowNum}: marks must be a positive number`);
            }

            // Type-specific validation
            if (row.questionType === 'MCQ') {
              // Check if all options are provided
              if (!row.optionA_text || !row.optionB_text || !row.optionC_text || !row.optionD_text) {
                errors.push(`Row ${rowNum}: All 4 options (A, B, C, D) are required for MCQ`);
              }

              // Check if exactly one option is correct
              const correctOptions = [
                row.optionA_isCorrect?.toLowerCase() === 'true',
                row.optionB_isCorrect?.toLowerCase() === 'true',
                row.optionC_isCorrect?.toLowerCase() === 'true',
                row.optionD_isCorrect?.toLowerCase() === 'true',
              ].filter(Boolean).length;

              if (correctOptions !== 1) {
                errors.push(`Row ${rowNum}: Exactly ONE option must be marked as correct for MCQ`);
              }

              // correctAnswer should be empty for MCQ
              if (row.correctAnswer && row.correctAnswer.trim() !== '') {
                errors.push(`Row ${rowNum}: correctAnswer field should be empty for MCQ questions`);
              }
            }

            if (row.questionType === 'NUMERICAL') {
              // correctAnswer must be a number
              if (!row.correctAnswer || isNaN(Number(row.correctAnswer))) {
                errors.push(`Row ${rowNum}: correctAnswer must be a valid number for NUMERICAL questions`);
              }

              // Options should be empty
              if (row.optionA_text || row.optionB_text || row.optionC_text || row.optionD_text) {
                errors.push(`Row ${rowNum}: Options should not be provided for NUMERICAL questions`);
              }
            }

            if (row.questionType === 'TRUE_FALSE') {
              // correctAnswer must be TRUE or FALSE
              if (!row.correctAnswer || !['TRUE', 'FALSE'].includes(row.correctAnswer.toUpperCase())) {
                errors.push(`Row ${rowNum}: correctAnswer must be TRUE or FALSE for TRUE_FALSE questions`);
              }

              // Options should be empty
              if (row.optionA_text || row.optionB_text || row.optionC_text || row.optionD_text) {
                errors.push(`Row ${rowNum}: Options should not be provided for TRUE_FALSE questions`);
              }
            }

            if (errors.length === 0 || !errors.some(e => e.startsWith(`Row ${rowNum}`))) {
              questions.push(row);
            }
          });

          resolve({ questions, errors });
        },
        error: (error: Error) => {
          resolve({ questions: [], errors: [error.message] });
        },
      });
    });
  },

  // Create master test with CSV questions
  createTestFromCSV: async (
    userId: string,
    testData: CreateMasterTestDTO,
    csvContent: string
  ) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    // Parse CSV
    const { questions: csvQuestions, errors } = await operatorService.parseCSV(csvContent);

    if (errors.length > 0) {
      throw new Error(`CSV validation failed:\n${errors.join('\n')}`);
    }

    if (csvQuestions.length === 0) {
      throw new Error('No valid questions found in CSV');
    }

    // Create master test with questions in a transaction
    const masterTest = await prisma.$transaction(async (tx) => {
      // Create the test
      const test = await tx.masterTest.create({
        data: {
          title: testData.title,
          description: testData.description,
          testType: testData.testType,
          duration: testData.duration,
          totalMarks: testData.totalMarks,
          passingMarks: testData.passingMarks,
          instructions: testData.instructions,
          createdById: operator.id,
          isActive: true,
        },
      });

      // Create questions
      for (const csvQ of csvQuestions) {
        const question = await tx.question.create({
          data: {
            masterTestId: test.id,
            questionOrder: parseInt(csvQ.questionOrder),
            questionText: csvQ.questionText,
            questionType: csvQ.questionType as QuestionType,
            subject: csvQ.subject as Subject,
            difficulty: csvQ.difficulty as Difficulty,
            nature: (csvQ.nature as QuestionNature) || 'CONCEPTUAL',
            marks: parseInt(csvQ.marks),
            correctAnswer: csvQ.correctAnswer || null,
            explanation: csvQ.explanation || null,
            imageUrl: csvQ.questionImageUrl || null,
          },
        });

        // Create options for MCQ
        if (csvQ.questionType === 'MCQ') {
          await tx.option.createMany({
            data: [
              {
                questionId: question.id,
                optionLabel: 'A',
                optionText: csvQ.optionA_text || '',
                optionImageUrl: csvQ.optionA_imageUrl || null,
                isCorrect: csvQ.optionA_isCorrect?.toLowerCase() === 'true',
              },
              {
                questionId: question.id,
                optionLabel: 'B',
                optionText: csvQ.optionB_text || '',
                optionImageUrl: csvQ.optionB_imageUrl || null,
                isCorrect: csvQ.optionB_isCorrect?.toLowerCase() === 'true',
              },
              {
                questionId: question.id,
                optionLabel: 'C',
                optionText: csvQ.optionC_text || '',
                optionImageUrl: csvQ.optionC_imageUrl || null,
                isCorrect: csvQ.optionC_isCorrect?.toLowerCase() === 'true',
              },
              {
                questionId: question.id,
                optionLabel: 'D',
                optionText: csvQ.optionD_text || '',
                optionImageUrl: csvQ.optionD_imageUrl || null,
                isCorrect: csvQ.optionD_isCorrect?.toLowerCase() === 'true',
              },
            ],
          });
        }
      }

      return test;
    });

    // Fetch the created test with questions
    const fullTest = await prisma.masterTest.findUnique({
      where: { id: masterTest.id },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: {
            questionOrder: 'asc',
          },
        },
      },
    });

    return fullTest;
  },

  // Get all master tests created by operator
  getMasterTests: async (userId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const tests = await prisma.masterTest.findMany({
      where: { createdById: operator.id },
      include: {
        questions: {
          select: { id: true },
        },
        activations: {
          select: {
            id: true,
            institute: {
              select: {
                instituteName: true,
              },
            },
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
      activationsCount: test.activations.length,
      isActive: test.isActive,
      status: test.status,  // Include status for draft/published indicator
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
    }));
  },

  // Get test details with questions
  getTestDetails: async (userId: string, testId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: {
            questionOrder: 'asc',
          },
        },
        activations: {
          include: {
            institute: {
              select: {
                instituteName: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to view this test');
    }

    return test;
  },

  // Deactivate test
  deactivateTest: async (userId: string, testId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to modify this test');
    }

    const updated = await prisma.masterTest.update({
      where: { id: testId },
      data: { isActive: false },
    });

    return updated;
  },

  // Update test metadata
  updateTest: async (userId: string, testId: string, updateData: Partial<CreateMasterTestDTO>) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to modify this test');
    }

    const updated = await prisma.masterTest.update({
      where: { id: testId },
      data: updateData,
    });

    return updated;
  },

  // Get test statistics
  getTestStatistics: async (userId: string, testId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: {
        activations: {
          include: {
            attempts: {
              where: { status: 'SUBMITTED' },
            },
          },
        },
        questions: true,
      },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to view this test');
    }

    const totalActivations = test.activations.length;
    const allAttempts = test.activations.flatMap(a => a.attempts);
    const totalAttempts = allAttempts.length;

    const avgScore = totalAttempts > 0
      ? allAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / totalAttempts
      : 0;

    return {
      totalQuestions: test.questions.length,
      totalActivations,
      totalAttempts,
      averageScore: avgScore,
    };
  },

  // Create test with questions (from rich text editor)
  createTestWithQuestions: async (userId: string, testData: any, questions: any[]) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    // Create master test with questions in a transaction
    const masterTest = await prisma.$transaction(async (tx) => {
      // Create the master test
      const test = await tx.masterTest.create({
        data: {
          title: testData.title,
          description: testData.description,
          testType: testData.testType as TestType,
          duration: testData.duration,
          totalMarks: testData.totalMarks,
          passingMarks: testData.passingMarks,
          instructions: testData.instructions,
          createdById: operator.id,
          isActive: true,
        },
      });

      // Create all questions
      const createdQuestions = await Promise.all(
        questions.map(async (q, index) => {
          const questionData: any = {
            masterTestId: test.id,
            questionText: q.questionText,
            questionType: q.questionType as QuestionType,
            subject: q.subject as Subject,
            difficulty: q.difficulty as Difficulty,
            nature: (q.nature as QuestionNature) || 'CONCEPTUAL',
            correctAnswer: q.correctAnswer,
            marks: q.marks,
            questionOrder: q.orderIndex || index + 1,
            explanation: q.explanation,
            imageUrl: q.questionImageUrl,
            partialMarking: q.partialMarking || false,
            passageText: q.passageText,
            // Only set parentQuestionId if it's a valid value (for COMPREHENSION_SUB questions)
            ...(q.parentQuestionId && { parentQuestionId: q.parentQuestionId }),
            columnIItems: q.columnIItems,
            columnIIItems: q.columnIIItems,
            correctMatches: q.correctMatches,
            matchRows: q.matchRows,
          };

          // Create the question first
          const createdQuestion = await tx.question.create({
            data: questionData,
          });

          // Create MCQ options for all question types that use A, B, C, D options
          if (q.questionType === 'MCQ' ||
            q.questionType === 'MCQ_MULTIPLE' ||
            q.questionType === 'MATCH_FOLLOWING' ||
            q.questionType === 'COMPREHENSION_SUB') {
            const correctAnswers = q.questionType === 'MCQ_MULTIPLE' && q.correctAnswers
              ? q.correctAnswers // Array of correct options like ['A', 'C']
              : [q.correctAnswer]; // Single correct answer

            await Promise.all([
              tx.option.create({
                data: {
                  questionId: createdQuestion.id,
                  optionLabel: 'A',
                  optionText: q.optionA || '',
                  optionImageUrl: q.optionAImageUrl,
                  isCorrect: correctAnswers.includes('A'),
                },
              }),
              tx.option.create({
                data: {
                  questionId: createdQuestion.id,
                  optionLabel: 'B',
                  optionText: q.optionB || '',
                  optionImageUrl: q.optionBImageUrl,
                  isCorrect: correctAnswers.includes('B'),
                },
              }),
              tx.option.create({
                data: {
                  questionId: createdQuestion.id,
                  optionLabel: 'C',
                  optionText: q.optionC || '',
                  optionImageUrl: q.optionCImageUrl,
                  isCorrect: correctAnswers.includes('C'),
                },
              }),
              tx.option.create({
                data: {
                  questionId: createdQuestion.id,
                  optionLabel: 'D',
                  optionText: q.optionD || '',
                  optionImageUrl: q.optionDImageUrl,
                  isCorrect: correctAnswers.includes('D'),
                },
              }),
            ]);
          }

          return createdQuestion;
        })
      );

      return {
        ...test,
        questions: createdQuestions,
      };
    });

    return masterTest;
  },

  // Create draft test (metadata only, no questions yet)
  createDraftTest: async (userId: string, testData: CreateMasterTestDTO) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const draftTest = await prisma.masterTest.create({
      data: {
        title: testData.title,
        description: testData.description,
        testType: testData.testType,
        duration: testData.duration,
        totalMarks: testData.totalMarks,
        passingMarks: testData.passingMarks,
        instructions: testData.instructions,
        createdById: operator.id,
        isActive: true,
        status: 'DRAFT',
      },
    });

    return draftTest;
  },

  // Get draft test with questions for editing
  getDraftTest: async (userId: string, testId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: true,
          },
          orderBy: { questionOrder: 'asc' },
        },
      },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to access this test');
    }

    return test;
  },

  // Add a single question to an existing test
  addQuestionToTest: async (userId: string, testId: string, questionData: any) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: { questions: { select: { id: true } } },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to modify this test');
    }

    if (test.status === 'PUBLISHED') {
      throw new Error('Cannot add questions to a published test');
    }

    const questionOrder = test.questions.length + 1;

    // Create question with options in a transaction
    const createdQuestion = await prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          masterTestId: testId,
          questionText: questionData.questionText,
          questionType: questionData.questionType as QuestionType,
          subject: questionData.subject as Subject,
          difficulty: questionData.difficulty as Difficulty,
          nature: (questionData.nature as QuestionNature) || 'CONCEPTUAL',
          topic: questionData.topic || null,
          subtopic: questionData.subtopic || null,
          correctAnswer: questionData.correctAnswer,
          marks: questionData.marks,
          questionOrder: questionData.orderIndex || questionOrder,
          explanation: questionData.explanation,
          imageUrl: questionData.questionImageUrl,
          partialMarking: questionData.partialMarking || false,
          passageText: questionData.passageText,
          columnIItems: questionData.columnIItems,
          columnIIItems: questionData.columnIIItems,
          correctMatches: questionData.correctMatches,
          matchRows: questionData.matchRows,
        },
      });

      // Create MCQ options
      if (['MCQ', 'MCQ_MULTIPLE', 'MATCH_FOLLOWING', 'COMPREHENSION_SUB'].includes(questionData.questionType)) {
        const correctAnswers = questionData.questionType === 'MCQ_MULTIPLE' && questionData.correctAnswers
          ? questionData.correctAnswers
          : [questionData.correctAnswer];

        await tx.option.createMany({
          data: [
            {
              questionId: question.id,
              optionLabel: 'A',
              optionText: questionData.optionA || '',
              optionImageUrl: questionData.optionAImageUrl,
              isCorrect: correctAnswers.includes('A'),
            },
            {
              questionId: question.id,
              optionLabel: 'B',
              optionText: questionData.optionB || '',
              optionImageUrl: questionData.optionBImageUrl,
              isCorrect: correctAnswers.includes('B'),
            },
            {
              questionId: question.id,
              optionLabel: 'C',
              optionText: questionData.optionC || '',
              optionImageUrl: questionData.optionCImageUrl,
              isCorrect: correctAnswers.includes('C'),
            },
            {
              questionId: question.id,
              optionLabel: 'D',
              optionText: questionData.optionD || '',
              optionImageUrl: questionData.optionDImageUrl,
              isCorrect: correctAnswers.includes('D'),
            },
          ],
        });
      }

      // Fetch question with options
      return tx.question.findUnique({
        where: { id: question.id },
        include: { options: true },
      });
    });

    return createdQuestion;
  },

  // Update an existing question
  updateQuestion: async (userId: string, testId: string, questionId: string, questionData: any) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to modify this test');
    }

    if (test.status === 'PUBLISHED') {
      throw new Error('Cannot modify questions in a published test');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question || question.masterTestId !== testId) {
      throw new Error('Question not found');
    }

    // Update question with options in a transaction
    const updatedQuestion = await prisma.$transaction(async (tx) => {
      // Update the question
      const updated = await tx.question.update({
        where: { id: questionId },
        data: {
          questionText: questionData.questionText,
          questionType: questionData.questionType as QuestionType,
          subject: questionData.subject as Subject,
          difficulty: questionData.difficulty as Difficulty,
          nature: (questionData.nature as QuestionNature) || 'CONCEPTUAL',
          topic: questionData.topic || null,
          subtopic: questionData.subtopic || null,
          correctAnswer: questionData.correctAnswer,
          marks: questionData.marks,
          explanation: questionData.explanation,
          imageUrl: questionData.questionImageUrl,
          partialMarking: questionData.partialMarking || false,
          passageText: questionData.passageText,
          columnIItems: questionData.columnIItems,
          columnIIItems: questionData.columnIIItems,
          correctMatches: questionData.correctMatches,
          matchRows: questionData.matchRows,
        },
      });

      // Delete existing options and recreate
      await tx.option.deleteMany({
        where: { questionId },
      });

      // Create new options if applicable
      if (['MCQ', 'MCQ_MULTIPLE', 'MATCH_FOLLOWING', 'COMPREHENSION_SUB'].includes(questionData.questionType)) {
        const correctAnswers = questionData.questionType === 'MCQ_MULTIPLE' && questionData.correctAnswers
          ? questionData.correctAnswers
          : [questionData.correctAnswer];

        await tx.option.createMany({
          data: [
            {
              questionId: updated.id,
              optionLabel: 'A',
              optionText: questionData.optionA || '',
              optionImageUrl: questionData.optionAImageUrl,
              isCorrect: correctAnswers.includes('A'),
            },
            {
              questionId: updated.id,
              optionLabel: 'B',
              optionText: questionData.optionB || '',
              optionImageUrl: questionData.optionBImageUrl,
              isCorrect: correctAnswers.includes('B'),
            },
            {
              questionId: updated.id,
              optionLabel: 'C',
              optionText: questionData.optionC || '',
              optionImageUrl: questionData.optionCImageUrl,
              isCorrect: correctAnswers.includes('C'),
            },
            {
              questionId: updated.id,
              optionLabel: 'D',
              optionText: questionData.optionD || '',
              optionImageUrl: questionData.optionDImageUrl,
              isCorrect: correctAnswers.includes('D'),
            },
          ],
        });
      }

      // Fetch updated question with options
      return tx.question.findUnique({
        where: { id: questionId },
        include: { options: true },
      });
    });

    return updatedQuestion;
  },

  // Delete a question from a test
  deleteQuestion: async (userId: string, testId: string, questionId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to modify this test');
    }

    if (test.status === 'PUBLISHED') {
      throw new Error('Cannot delete questions from a published test');
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question || question.masterTestId !== testId) {
      throw new Error('Question not found');
    }

    // Delete question (options will be cascade deleted)
    await prisma.question.delete({
      where: { id: questionId },
    });

    return { success: true };
  },

  // Publish a draft test (makes it visible to institutes)
  publishTest: async (userId: string, testId: string) => {
    const operator = await prisma.operator.findUnique({
      where: { userId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: { questions: { select: { id: true } } },
    });

    if (!test) {
      throw new Error('Test not found');
    }

    if (test.createdById !== operator.id) {
      throw new Error('You do not have permission to publish this test');
    }

    if (test.status === 'PUBLISHED') {
      throw new Error('Test is already published');
    }

    if (test.questions.length === 0) {
      throw new Error('Cannot publish a test without questions');
    }

    const publishedTest = await prisma.masterTest.update({
      where: { id: testId },
      data: { status: 'PUBLISHED' },
    });

    return publishedTest;
  },
};
