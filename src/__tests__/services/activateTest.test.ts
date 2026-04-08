/**
 * activateTest.test.ts
 * Tests the institute test scheduling service method.
 *
 * Covers:
 *  - Creating a new activation when none exists
 *  - Re-scheduling (updating) an existing activation instead of throwing
 *  - Date validation (activationDate must be before expiryDate)
 *  - expiryDate is stored as end-of-day UTC so the whole day is valid
 *  - Optional startTime / endTime parsing from HH:MM strings
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    institute: { findUnique: jest.fn() },
    instituteTestActivation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// instituteService imports testExpiryQueue only in studentService, not here —
// but guard against any indirect import just in case.
jest.mock('../../lib/queue', () => ({
  testExpiryQueue: { add: jest.fn().mockResolvedValue(undefined) },
  connection: {},
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import prisma from '../../utils/prisma';
import { instituteService } from '../../services/instituteService';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockInstitute = { id: 'inst-1', userId: 'user-1' };

/** Build a minimal activation payload the frontend would send */
function makePayload(overrides: Record<string, any> = {}) {
  return {
    masterTestId: 'test-master-1',
    activationDate: '2025-06-01',
    expiryDate: '2025-06-30',
    maxAttempts: 1,
    startTime: '',
    endTime: '',
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('instituteService.activateTest', () => {
  beforeEach(() => {
    // Default: institute found, no existing activation
    (prisma.institute.findUnique as jest.Mock).mockResolvedValue(mockInstitute);
    (prisma.instituteTestActivation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.instituteTestActivation.create as jest.Mock).mockResolvedValue({ id: 'act-new' });
    (prisma.instituteTestActivation.update as jest.Mock).mockResolvedValue({ id: 'act-existing' });
  });

  // ── Happy path: first-time activation ──────────────────────────────────────

  it('calls create when no activation exists for this test', async () => {
    await instituteService.activateTest('user-1', makePayload());

    expect(prisma.instituteTestActivation.create).toHaveBeenCalledTimes(1);
    expect(prisma.instituteTestActivation.update).not.toHaveBeenCalled();
  });

  it('passes instituteId and masterTestId to create', async () => {
    await instituteService.activateTest('user-1', makePayload({ masterTestId: 'test-xyz' }));

    const createCall = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.instituteId).toBe('inst-1');
    expect(createCall.data.masterTestId).toBe('test-xyz');
  });

  it('sets isActive: true on new activations', async () => {
    await instituteService.activateTest('user-1', makePayload());

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    expect(data.isActive).toBe(true);
  });

  // ── Re-scheduling: existing activation ────────────────────────────────────

  it('calls update (not create) when an activation already exists', async () => {
    (prisma.instituteTestActivation.findUnique as jest.Mock).mockResolvedValue({
      id: 'act-existing',
      isActive: false,
    });

    await instituteService.activateTest('user-1', makePayload());

    expect(prisma.instituteTestActivation.update).toHaveBeenCalledTimes(1);
    expect(prisma.instituteTestActivation.create).not.toHaveBeenCalled();
  });

  it('re-activates a deactivated test by setting isActive: true on update', async () => {
    (prisma.instituteTestActivation.findUnique as jest.Mock).mockResolvedValue({
      id: 'act-existing',
      isActive: false,
    });

    await instituteService.activateTest('user-1', makePayload());

    const { data } = (prisma.instituteTestActivation.update as jest.Mock).mock.calls[0][0];
    expect(data.isActive).toBe(true);
  });

  it('uses the existing record id in the update where clause', async () => {
    (prisma.instituteTestActivation.findUnique as jest.Mock).mockResolvedValue({
      id: 'act-existing',
    });

    await instituteService.activateTest('user-1', makePayload());

    const { where } = (prisma.instituteTestActivation.update as jest.Mock).mock.calls[0][0];
    expect(where.id).toBe('act-existing');
  });

  // ── Date validation ────────────────────────────────────────────────────────

  it('allows same-day activation and expiry (activationDate midnight < expiryDate 23:59)', async () => {
    // Same calendar day is valid: midnight → 23:59:59 UTC is a full-day window
    await expect(
      instituteService.activateTest(
        'user-1',
        makePayload({ activationDate: '2025-06-01', expiryDate: '2025-06-01' }),
      ),
    ).resolves.toBeDefined();
  });

  it('throws when activationDate is after expiryDate', async () => {
    await expect(
      instituteService.activateTest(
        'user-1',
        makePayload({ activationDate: '2025-07-01', expiryDate: '2025-06-01' }),
      ),
    ).rejects.toThrow('Activation date must be before expiry date');
  });

  // ── expiryDate end-of-day fix ──────────────────────────────────────────────

  it('stores expiryDate as 23:59:59.999 UTC so the full expiry day is usable', async () => {
    await instituteService.activateTest(
      'user-1',
      makePayload({ expiryDate: '2025-06-30' }),
    );

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    const expiry: Date = data.expiryDate;

    expect(expiry.getUTCHours()).toBe(23);
    expect(expiry.getUTCMinutes()).toBe(59);
    expect(expiry.getUTCSeconds()).toBe(59);
    expect(expiry.getUTCMilliseconds()).toBe(999);
  });

  it('keeps activationDate as midnight UTC (start of that day)', async () => {
    await instituteService.activateTest(
      'user-1',
      makePayload({ activationDate: '2025-06-01' }),
    );

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    const activation: Date = data.activationDate;

    // new Date('2025-06-01') is midnight UTC — correct start-of-day
    expect(activation.getUTCHours()).toBe(0);
    expect(activation.getUTCMinutes()).toBe(0);
  });

  // ── startTime / endTime parsing ────────────────────────────────────────────

  it('stores null for startTime and endTime when not provided', async () => {
    await instituteService.activateTest(
      'user-1',
      makePayload({ startTime: '', endTime: '' }),
    );

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    expect(data.startTime).toBeNull();
    expect(data.endTime).toBeNull();
  });

  it('correctly combines activationDate + startTime into a DateTime', async () => {
    await instituteService.activateTest(
      'user-1',
      makePayload({ activationDate: '2025-06-01', startTime: '09:30' }),
    );

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    const st: Date = data.startTime;
    expect(st.getHours()).toBe(9);
    expect(st.getMinutes()).toBe(30);
  });

  it('correctly combines expiryDate + endTime into a DateTime', async () => {
    await instituteService.activateTest(
      'user-1',
      makePayload({ expiryDate: '2025-06-30', endTime: '18:00' }),
    );

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    const et: Date = data.endTime;
    expect(et.getHours()).toBe(18);
    expect(et.getMinutes()).toBe(0);
  });

  // ── maxAttempts default ────────────────────────────────────────────────────

  it('defaults maxAttempts to 1 when not provided in payload', async () => {
    const payload = makePayload();
    delete payload.maxAttempts;
    await instituteService.activateTest('user-1', payload);

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    expect(data.maxAttempts).toBe(1);
  });

  it('stores the provided maxAttempts value', async () => {
    await instituteService.activateTest('user-1', makePayload({ maxAttempts: 3 }));

    const { data } = (prisma.instituteTestActivation.create as jest.Mock).mock.calls[0][0];
    expect(data.maxAttempts).toBe(3);
  });

  // ── Error: institute not found ─────────────────────────────────────────────

  it('throws when the institute is not found for the userId', async () => {
    (prisma.institute.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      instituteService.activateTest('unknown-user', makePayload()),
    ).rejects.toThrow('Institute not found');
  });
});
