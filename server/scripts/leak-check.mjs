/**
 * Leak-detection proof.
 *
 * Temporarily rewrites the authorization code into the insecure form a
 * developer might plausibly ship, runs the security suite against it, and
 * restores the original. A mutation that leaves the suite green would mean the
 * tests are decorative — so this script fails loudly if that happens.
 *
 *   node scripts/leak-check.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTATIONS = [
  {
    name: 'Bug 1 — list endpoint drops the role filter (findMany with no where)',
    file: 'src/services/authorization.service.ts',
    find: `    case 'RECRUITER':
      return { requisition: { recruiterId: user.id } };
    case 'PANELIST':
      return { assignments: { some: { panelistId: user.id } } };`,
    replace: `    case 'RECRUITER':
      return {};
    case 'PANELIST':
      return {};`,
  },
  {
    name: 'Bug 2 — role is checked but resource ownership is not',
    file: 'src/services/authorization.service.ts',
    find: `    case 'RECRUITER': {
      // Ownership is derived from the authenticated identity, never from input.
      if (candidate.requisition.recruiterId !== user.id) throw forbidden();`,
    replace: `    case 'RECRUITER': {
      if (false) throw forbidden();`,
  },
  {
    name: 'Bug 3 — preview header trusted from any authenticated user',
    file: 'src/middleware/authenticate.ts',
    find: `  if (authenticatedUser.role !== 'ADMIN') {
    throw forbidden('Preview mode is restricted to administrators.');
  }`,
    replace: `  if (false) {
    throw forbidden('Preview mode is restricted to administrators.');
  }`,
  },
  {
    name: 'Bug 4 — panelist visibility inferred from the requisition, not the assignment',
    file: 'src/services/authorization.service.ts',
    find: `      const assigned = await verifyPanelistAssignment(user.id, candidateId);
      if (!assigned) throw forbidden();`,
    replace: `      const assigned = true;
      if (!assigned) throw forbidden();`,
  },
];

function runSuite() {
  const result = spawnSync('npx', ['vitest', 'run'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const failed = Number(/Tests\s+(\d+) failed/.exec(output)?.[1] ?? 0);
  const passed = Number(/Tests\s+(?:\d+ failed \| )?(\d+) passed/.exec(output)?.[1] ?? 0);
  const names = [
    ...new Set(
      [...output.matchAll(/^\s*(?:×|✗)\s+(.+?)(?:\s+\d+ms)?$/gm)].map((m) => m[1].trim()),
    ),
  ];
  return { failed, passed, names, ok: result.status === 0 };
}

console.log('→ Baseline (secure implementation)');
const baseline = runSuite();
console.log(`   ${baseline.passed} passed, ${baseline.failed} failed\n`);
if (!baseline.ok) {
  console.error('Baseline suite is not green; fix that before running the leak check.');
  process.exit(1);
}

let allDetected = true;

for (const mutation of MUTATIONS) {
  const original = readFileSync(mutation.file, 'utf8');
  if (!original.includes(mutation.find)) {
    console.error(`✗ Could not apply "${mutation.name}" — the source has moved on.`);
    allDetected = false;
    continue;
  }

  writeFileSync(mutation.file, original.replace(mutation.find, mutation.replace));
  console.log(`→ ${mutation.name}`);

  try {
    const mutated = runSuite();
    if (mutated.failed > 0) {
      console.log(`   DETECTED: ${mutated.failed} test(s) failed`);
      for (const name of mutated.names.slice(0, 8)) console.log(`     · ${name}`);
    } else {
      console.log('   NOT DETECTED — the suite stayed green against insecure code.');
      allDetected = false;
    }
  } finally {
    writeFileSync(mutation.file, original);
  }
  console.log('');
}

console.log('→ Restored (secure implementation)');
const restored = runSuite();
console.log(`   ${restored.passed} passed, ${restored.failed} failed\n`);

if (!allDetected || !restored.ok) {
  console.error('Leak check FAILED: a mutation went undetected, or the restore is not green.');
  process.exit(1);
}
console.log('Leak check PASSED: every simulated authorization bug was caught, and the secure code is green.');
