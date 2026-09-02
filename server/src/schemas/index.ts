import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('A valid resource id is required.'),
});

export const candidateIdParamSchema = z.object({
  candidateId: z.string().uuid('A valid candidate id is required.'),
});

export const assignmentParamsSchema = z.object({
  candidateId: z.string().uuid('A valid candidate id is required.'),
  panelistId: z.string().uuid('A valid panelist id is required.'),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(200),
});

/**
 * Self-service registration deliberately has no ADMIN option: the role union
 * below is the whole allow-list, so `role: "ADMIN"` in a request body is a
 * validation error rather than a privilege escalation.
 */
export const registerSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters.')
    .max(200)
    .regex(/[a-z]/, 'Password must contain a lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
    .regex(/[0-9]/, 'Password must contain a number.'),
  role: z.enum(['RECRUITER', 'PANELIST']),
});

export const requisitionStatusEnum = z.enum(['OPEN', 'ON_HOLD', 'CLOSED']);
export const candidateStatusEnum = z.enum([
  'APPLIED',
  'SCREENING',
  'INTERVIEWING',
  'OFFER',
  'HIRED',
  'REJECTED',
]);

export const createRequisitionSchema = z.object({
  title: z.string().min(2).max(160).trim(),
  department: z.string().min(2).max(120).trim(),
  description: z.string().min(2).max(5000).trim(),
  status: requisitionStatusEnum.optional(),
  /** Honoured for ADMIN only; ignored for recruiters, who always own their own. */
  recruiterId: z.string().uuid().optional(),
});

export const updateRequisitionSchema = z
  .object({
    title: z.string().min(2).max(160).trim().optional(),
    department: z.string().min(2).max(120).trim().optional(),
    description: z.string().min(2).max(5000).trim().optional(),
    status: requisitionStatusEnum.optional(),
    recruiterId: z.string().uuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update.' });

export const createCandidateSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  phone: z.string().min(5).max(40).trim(),
  status: candidateStatusEnum.optional(),
  notes: z.string().max(5000).trim().optional(),
  requisitionId: z.string().uuid(),
});

export const updateCandidateSchema = z
  .object({
    name: z.string().min(2).max(120).trim().optional(),
    email: z.string().email().max(255).toLowerCase().trim().optional(),
    phone: z.string().min(5).max(40).trim().optional(),
    status: candidateStatusEnum.optional(),
    notes: z.string().max(5000).trim().optional(),
    requisitionId: z.string().uuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update.' });

export const assignPanelistSchema = z.object({
  panelistId: z.string().uuid(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().min(5).max(5000).trim(),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(['ADMIN', 'RECRUITER', 'PANELIST']).optional(),
});

export const listCandidatesQuerySchema = z.object({
  requisitionId: z.string().uuid().optional(),
  status: candidateStatusEnum.optional(),
  search: z.string().max(120).trim().optional(),
});
