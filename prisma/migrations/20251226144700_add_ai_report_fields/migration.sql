-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "test_attempts" ADD COLUMN     "aiAnalysisReport" TEXT,
ADD COLUMN     "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING';
