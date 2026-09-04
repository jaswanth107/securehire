import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serializeUser } from '../lib/presenters.js';
import { recordEvent, recordEvents, type ActivityInput } from '../lib/activity.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import {
  authorizeRequisitionAccess,
  isAdmin,
  requisitionScopeWhere,
} from '../services/authorization.service.js';

const REQUISITION_INCLUDE = {
  recruiter: { select: { id: true, name: true, email: true, role: true } },
  _count: { select: { candidates: true } },
} satisfies Prisma.JobRequisitionInclude;

function serialize(requisition: Prisma.JobRequisitionGetPayload<{ include: typeof REQUISITION_INCLUDE }>) {
  return {
    id: requisition.id,
    title: requisition.title,
    department: requisition.department,
    description: requisition.description,
    status: requisition.status,
    recruiterId: requisition.recruiterId,
    recruiter: serializeUser(requisition.recruiter),
    candidateCount: requisition._count.candidates,
    createdAt: requisition.createdAt,
    updatedAt: requisition.updatedAt,
  };
}

/**
 * GET /api/requisitions
 *
 * Recruiters get `WHERE recruiterId = <authenticated id>` applied in the query.
 * Panelists have no requisition surface at all.
 */
export const listRequisitions = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'PANELIST') throw forbidden();

  const requisitions = await prisma.jobRequisition.findMany({
    where: requisitionScopeWhere(user),
    include: REQUISITION_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: requisitions.map(serialize) });
});

/** GET /api/requisitions/:id */
export const getRequisition = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  await authorizeRequisitionAccess(user, req.params.id!, 'read');

  const requisition = await prisma.jobRequisition.findUnique({
    where: { id: req.params.id! },
    include: REQUISITION_INCLUDE,
  });
  if (!requisition) throw notFound('Requisition not found.');

  res.json({ success: true, data: serialize(requisition) });
});

/** POST /api/requisitions */
export const createRequisition = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'PANELIST') throw forbidden();

  const body = req.body as {
    title: string;
    department: string;
    description: string;
    status?: Prisma.JobRequisitionCreateInput['status'];
    recruiterId?: string;
  };

  // A recruiter always owns what they create. `recruiterId` from the body is
  // honoured for admins only — for anyone else it is ignored outright, so it
  // cannot be used to plant a requisition under another recruiter.
  let recruiterId = user.id;
  if (isAdmin(user)) {
    if (!body.recruiterId) throw badRequest('recruiterId is required when an admin creates a requisition.');
    const recruiter = await prisma.user.findUnique({
      where: { id: body.recruiterId },
      select: { id: true, role: true, isActive: true },
    });
    if (!recruiter || recruiter.role !== 'RECRUITER' || !recruiter.isActive) {
      throw badRequest('recruiterId must reference an active recruiter.');
    }
    recruiterId = recruiter.id;
  }

  const requisition = await prisma.$transaction(async (tx) => {
    const created = await tx.jobRequisition.create({
      data: {
        title: body.title,
        department: body.department,
        description: body.description,
        status: body.status ?? 'OPEN',
        recruiterId,
      },
      include: REQUISITION_INCLUDE,
    });

    await recordEvent(tx, req, {
      action: 'REQUISITION_CREATED',
      recruiterId: created.recruiterId,
      requisitionId: created.id,
      requisitionTitle: created.title,
      detail: { status: created.status },
    });

    return created;
  });

  res.status(201).json({ success: true, data: serialize(requisition) });
});

/** PATCH /api/requisitions/:id */
export const updateRequisition = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const existing = await authorizeRequisitionAccess(user, req.params.id!, 'update');
  const body = req.body as Partial<{
    title: string;
    department: string;
    description: string;
    status: Prisma.JobRequisitionUpdateInput['status'];
    recruiterId: string;
  }>;

  // Reassigning ownership is an admin-only operation.
  if (body.recruiterId && body.recruiterId !== existing.recruiterId) {
    if (!isAdmin(user)) throw forbidden();
    const recruiter = await prisma.user.findUnique({
      where: { id: body.recruiterId },
      select: { id: true, role: true, isActive: true },
    });
    if (!recruiter || recruiter.role !== 'RECRUITER' || !recruiter.isActive) {
      throw badRequest('recruiterId must reference an active recruiter.');
    }
  }

  const requisition = await prisma.$transaction(async (tx) => {
    const updated = await tx.jobRequisition.update({
      where: { id: existing.id },
      data: {
        ...(body.title === undefined ? {} : { title: body.title }),
        ...(body.department === undefined ? {} : { department: body.department }),
        ...(body.description === undefined ? {} : { description: body.description }),
        ...(body.status === undefined ? {} : { status: body.status }),
        ...(body.recruiterId === undefined || !isAdmin(user) ? {} : { recruiterId: body.recruiterId }),
      },
      include: REQUISITION_INCLUDE,
    });

    const events: ActivityInput[] = [];
    const context = {
      // Tagged with the *new* owner: a reassigned requisition moves into the
      // receiving recruiter's feed, and the old owner stops seeing it.
      recruiterId: updated.recruiterId,
      requisitionId: updated.id,
      requisitionTitle: updated.title,
    };

    if (updated.status !== existing.status) {
      events.push({
        action: 'REQUISITION_STATUS_CHANGED',
        ...context,
        detail: { from: existing.status, to: updated.status },
      });
    }

    const changed = (['title', 'department', 'description', 'recruiterId'] as const).filter(
      (field) => body[field] !== undefined && body[field] !== existing[field],
    );
    if (changed.length > 0) {
      events.push({ action: 'REQUISITION_UPDATED', ...context, detail: { fields: changed } });
    }

    await recordEvents(tx, req, events);
    return updated;
  });

  res.json({ success: true, data: serialize(requisition) });
});

/** DELETE /api/requisitions/:id — admins only; deletion cascades to candidates. */
export const deleteRequisition = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const requisition = await authorizeRequisitionAccess(user, req.params.id!, 'delete');

  await prisma.$transaction(async (tx) => {
    await tx.jobRequisition.delete({ where: { id: requisition.id } });
    // Survives its own cascade — see the ActivityEvent model.
    await recordEvent(tx, req, {
      action: 'REQUISITION_DELETED',
      recruiterId: requisition.recruiterId,
      requisitionId: requisition.id,
      requisitionTitle: requisition.title,
    });
  });
  res.json({ success: true, data: { id: requisition.id } });
});
