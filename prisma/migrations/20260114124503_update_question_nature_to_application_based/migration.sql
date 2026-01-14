/*
  Warnings:

  - The values [CALCULATION_BASED] on the enum `QuestionNature` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuestionNature_new" AS ENUM ('CONCEPTUAL', 'FORMULA_BASED', 'APPLICATION_BASED');
ALTER TABLE "questions" ALTER COLUMN "nature" DROP DEFAULT;
ALTER TABLE "questions" ALTER COLUMN "nature" TYPE "QuestionNature_new" USING ("nature"::text::"QuestionNature_new");
ALTER TYPE "QuestionNature" RENAME TO "QuestionNature_old";
ALTER TYPE "QuestionNature_new" RENAME TO "QuestionNature";
DROP TYPE "QuestionNature_old";
ALTER TABLE "questions" ALTER COLUMN "nature" SET DEFAULT 'CONCEPTUAL';
COMMIT;
