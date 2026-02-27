import { Difficulty, QuestionNature, Subject } from '@prisma/client';
import prisma from '../utils/prisma';

export class TeacherService {
  // Resolve teacher's subject from their profile ID
  async getTeacherSubject(teacherId: string): Promise<Subject> {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { subject: true },
    });
    if (!teacher) throw new Error('Teacher profile not found');
    return teacher.subject;
  }

  // Get all master tests (draft + published) — teachers can see everything
  async getMasterTests() {
    const tests = await prisma.masterTest.findMany({
      where: { isActive: true },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tests.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      testType: t.testType,
      duration: t.duration,
      totalMarks: t.totalMarks,
      status: t.status,
      createdBy: `${t.createdBy.firstName} ${t.createdBy.lastName}`,
      questionCount: t._count.questions,
      createdAt: t.createdAt,
    }));
  }

  // Get a single test with questions filtered to the teacher's subject
  async getTestQuestions(testId: string, teacherId: string) {
    const subject = await this.getTeacherSubject(teacherId);

    const test = await prisma.masterTest.findUnique({
      where: { id: testId },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!test) throw new Error('Test not found');

    const questions = await prisma.question.findMany({
      where: {
        masterTestId: testId,
        subject,
        parentQuestionId: null, // top-level only
      },
      include: {
        options: {
          select: {
            id: true,
            optionLabel: true,
            optionText: true,
            optionImageUrl: true,
            isCorrect: true,
          },
          orderBy: { optionLabel: 'asc' },
        },
        subQuestions: {
          include: {
            options: {
              select: {
                id: true,
                optionLabel: true,
                optionText: true,
                optionImageUrl: true,
                isCorrect: true,
              },
              orderBy: { optionLabel: 'asc' },
            },
          },
          orderBy: { questionOrder: 'asc' },
        },
      },
      orderBy: { questionOrder: 'asc' },
    });

    const totalSubjectQuestions = await prisma.question.count({
      where: { masterTestId: testId, subject },
    });

    return {
      test: {
        id: test.id,
        title: test.title,
        testType: test.testType,
        duration: test.duration,
        totalMarks: test.totalMarks,
        status: test.status,
        createdBy: `${test.createdBy.firstName} ${test.createdBy.lastName}`,
      },
      subject,
      totalSubjectQuestions,
      questions,
    };
  }

  // Update difficulty and/or nature label on a single question
  async updateQuestionLabel(
    questionId: string,
    teacherId: string,
    data: { difficulty?: Difficulty; nature?: QuestionNature }
  ) {
    const subject = await this.getTeacherSubject(teacherId);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, subject: true },
    });

    if (!question) throw new Error('Question not found');

    if (question.subject !== subject) {
      throw new Error('You can only label questions for your own subject');
    }

    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.nature !== undefined && { nature: data.nature }),
      },
      select: {
        id: true,
        difficulty: true,
        nature: true,
        subject: true,
        questionText: true,
        questionOrder: true,
      },
    });

    return updated;
  }

  // Bulk update labels for multiple questions in one request
  async bulkUpdateLabels(
    teacherId: string,
    updates: { questionId: string; difficulty?: Difficulty; nature?: QuestionNature }[]
  ) {
    const results = await Promise.all(
      updates.map((u) =>
        this.updateQuestionLabel(u.questionId, teacherId, {
          difficulty: u.difficulty,
          nature: u.nature,
        })
      )
    );
    return results;
  }
}
