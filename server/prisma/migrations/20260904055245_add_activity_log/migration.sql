-- CreateEnum
CREATE TYPE "public"."ActivityAction" AS ENUM ('CANDIDATE_CREATED', 'CANDIDATE_UPDATED', 'CANDIDATE_STATUS_CHANGED', 'CANDIDATE_DELETED', 'PANELIST_ASSIGNED', 'PANELIST_UNASSIGNED', 'FEEDBACK_SUBMITTED', 'REQUISITION_CREATED', 'REQUISITION_UPDATED', 'REQUISITION_STATUS_CHANGED', 'REQUISITION_DELETED', 'USER_ACTIVATED', 'USER_DEACTIVATED');

-- CreateTable
CREATE TABLE "public"."ActivityEvent" (
    "id" TEXT NOT NULL,
    "action" "public"."ActivityAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "onBehalfOfId" TEXT,
    "onBehalfOfName" TEXT,
    "recruiterId" TEXT,
    "requisitionId" TEXT,
    "requisitionTitle" TEXT,
    "candidateId" TEXT,
    "candidateName" TEXT,
    "targetUserId" TEXT,
    "targetUserName" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationState" (
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "public"."ActivityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_recruiterId_createdAt_idx" ON "public"."ActivityEvent"("recruiterId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_candidateId_createdAt_idx" ON "public"."ActivityEvent"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorId_createdAt_idx" ON "public"."ActivityEvent"("actorId", "createdAt");
