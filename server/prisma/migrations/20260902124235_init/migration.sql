-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'RECRUITER', 'PANELIST');

-- CreateEnum
CREATE TYPE "public"."RequisitionStatus" AS ENUM ('OPEN', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."CandidateStatus" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER', 'HIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobRequisition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."RequisitionStatus" NOT NULL DEFAULT 'OPEN',
    "recruiterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "public"."CandidateStatus" NOT NULL DEFAULT 'APPLIED',
    "notes" TEXT,
    "requisitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CandidatePanelistAssignment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "panelistId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidatePanelistAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InterviewFeedback" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "panelistId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE INDEX "JobRequisition_recruiterId_idx" ON "public"."JobRequisition"("recruiterId");

-- CreateIndex
CREATE INDEX "Candidate_requisitionId_idx" ON "public"."Candidate"("requisitionId");

-- CreateIndex
CREATE INDEX "CandidatePanelistAssignment_panelistId_idx" ON "public"."CandidatePanelistAssignment"("panelistId");

-- CreateIndex
CREATE INDEX "CandidatePanelistAssignment_candidateId_idx" ON "public"."CandidatePanelistAssignment"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePanelistAssignment_candidateId_panelistId_key" ON "public"."CandidatePanelistAssignment"("candidateId", "panelistId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_candidateId_idx" ON "public"."InterviewFeedback"("candidateId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_panelistId_idx" ON "public"."InterviewFeedback"("panelistId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewFeedback_candidateId_panelistId_key" ON "public"."InterviewFeedback"("candidateId", "panelistId");

-- AddForeignKey
ALTER TABLE "public"."JobRequisition" ADD CONSTRAINT "JobRequisition_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "public"."JobRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidatePanelistAssignment" ADD CONSTRAINT "CandidatePanelistAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CandidatePanelistAssignment" ADD CONSTRAINT "CandidatePanelistAssignment_panelistId_fkey" FOREIGN KEY ("panelistId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_panelistId_fkey" FOREIGN KEY ("panelistId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
