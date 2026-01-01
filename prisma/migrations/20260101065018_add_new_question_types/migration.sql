-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'MCQ_MULTIPLE';
ALTER TYPE "QuestionType" ADD VALUE 'MATCH_FOLLOWING';
ALTER TYPE "QuestionType" ADD VALUE 'COMPREHENSION';
ALTER TYPE "QuestionType" ADD VALUE 'COMPREHENSION_SUB';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "columnIIItems" JSONB,
ADD COLUMN     "columnIItems" JSONB,
ADD COLUMN     "correctMatches" JSONB,
ADD COLUMN     "parentQuestionId" TEXT,
ADD COLUMN     "partialMarking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passageText" TEXT;

-- AlterTable
ALTER TABLE "student_answers" ADD COLUMN     "selectedAnswers" JSONB;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
