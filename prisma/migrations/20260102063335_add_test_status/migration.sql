-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "master_tests" ADD COLUMN     "status" "TestStatus" NOT NULL DEFAULT 'DRAFT';
