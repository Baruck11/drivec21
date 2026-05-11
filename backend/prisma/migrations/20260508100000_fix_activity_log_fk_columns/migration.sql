-- Replace shared entityId with separate FK columns in activity_logs
-- Drop old FK constraints that all pointed to entityId
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_series_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_movie_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_program_fkey";

-- Add separate FK columns
ALTER TABLE "activity_logs" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "movieId" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "programId" TEXT;

-- Drop the old entityId column
ALTER TABLE "activity_logs" DROP COLUMN "entityId";

-- Add proper FK constraints
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
