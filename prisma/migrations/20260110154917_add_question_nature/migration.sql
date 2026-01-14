-- CreateEnum
CREATE TYPE "QuestionNature" AS ENUM ('CONCEPTUAL', 'FORMULA_BASED', 'CALCULATION_BASED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "nature" "QuestionNature" NOT NULL DEFAULT 'CONCEPTUAL';
