import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

/**
 * Deterministic ids keep the README, the UI walkthrough and the authorization
 * tests all pointing at the same rows.
 */
export const SEED_IDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  recruiterA: '22222222-2222-4222-8222-222222222222',
  recruiterB: '33333333-3333-4333-8333-333333333333',
  panelistA: '44444444-4444-4444-8444-444444444444',
  panelistB: '55555555-5555-4555-8555-555555555555',
  requisitionA: '66666666-6666-4666-8666-666666666666',
  requisitionB: '77777777-7777-4777-8777-777777777777',
  candidateA1: '88888888-8888-4888-8888-888888888888',
  candidateA2: '99999999-9999-4999-8999-999999999999',
  candidateB1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  candidateB2: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
} as const;

/**
 * The dataset is deliberately shaped around isolated access boundaries:
 *   Requisition A -> Recruiter A, Requisition B -> Recruiter B
 *   Panelist A is assigned to Candidate A1 only
 *   Panelist B is assigned to Candidate B1 only
 * Candidates A2 and B2 are assigned to nobody, which is what makes the
 * "unassigned candidate" leak test meaningful.
 */
export async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(env.seedPassword, 12);

  // Wipe in dependency order so re-seeding is idempotent. The activity log has
  // no relations, so it is cleared explicitly rather than by cascade.
  await prisma.activityEvent.deleteMany();
  await prisma.notificationState.deleteMany();
  await prisma.interviewFeedback.deleteMany();
  await prisma.candidatePanelistAssignment.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobRequisition.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { id: SEED_IDS.admin, name: 'Admin John', email: 'admin@example.com', passwordHash, role: 'ADMIN' },
      { id: SEED_IDS.recruiterA, name: 'Recruiter Alice', email: 'recruiter.a@example.com', passwordHash, role: 'RECRUITER' },
      { id: SEED_IDS.recruiterB, name: 'Recruiter Rahul', email: 'recruiter.b@example.com', passwordHash, role: 'RECRUITER' },
      { id: SEED_IDS.panelistA, name: 'Panelist Bob', email: 'panelist.a@example.com', passwordHash, role: 'PANELIST' },
      { id: SEED_IDS.panelistB, name: 'Panelist Priya', email: 'panelist.b@example.com', passwordHash, role: 'PANELIST' },
    ],
  });

  await prisma.jobRequisition.createMany({
    data: [
      {
        id: SEED_IDS.requisitionA,
        title: 'Senior Frontend Engineer',
        department: 'Engineering',
        description: 'React and TypeScript specialist for the design systems team.',
        status: 'OPEN',
        recruiterId: SEED_IDS.recruiterA,
      },
      {
        id: SEED_IDS.requisitionB,
        title: 'Platform Security Engineer',
        department: 'Security',
        description: 'Owns authorization architecture and threat modelling.',
        status: 'OPEN',
        recruiterId: SEED_IDS.recruiterB,
      },
    ],
  });

  await prisma.candidate.createMany({
    data: [
      {
        id: SEED_IDS.candidateA1,
        name: 'Ananya Rao',
        email: 'ananya.rao@example.com',
        phone: '+91 90000 10001',
        status: 'INTERVIEWING',
        notes: 'Strong systems design round. Panel scheduled.',
        requisitionId: SEED_IDS.requisitionA,
      },
      {
        id: SEED_IDS.candidateA2,
        name: 'Arjun Mehta',
        email: 'arjun.mehta@example.com',
        phone: '+91 90000 10002',
        status: 'SCREENING',
        notes: 'Awaiting portfolio review.',
        requisitionId: SEED_IDS.requisitionA,
      },
      {
        id: SEED_IDS.candidateB1,
        name: 'Brian Osei',
        email: 'brian.osei@example.com',
        phone: '+1 415 555 0101',
        status: 'INTERVIEWING',
        notes: 'Previously ran an internal red team.',
        requisitionId: SEED_IDS.requisitionB,
      },
      {
        id: SEED_IDS.candidateB2,
        name: 'Bianca Costa',
        email: 'bianca.costa@example.com',
        phone: '+55 11 95555 0102',
        status: 'APPLIED',
        notes: 'Referred by the platform team.',
        requisitionId: SEED_IDS.requisitionB,
      },
    ],
  });

  await prisma.candidatePanelistAssignment.createMany({
    data: [
      { candidateId: SEED_IDS.candidateA1, panelistId: SEED_IDS.panelistA },
      { candidateId: SEED_IDS.candidateB1, panelistId: SEED_IDS.panelistB },
    ],
  });
}

const invokedDirectly = process.argv[1]?.includes('seed');

if (invokedDirectly) {
  seed()
    .then(() => {
      console.log('Seed complete.');
      console.log(`Development password for every seeded account: ${env.seedPassword}`);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
