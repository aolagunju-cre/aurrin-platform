/** @jest-environment node */

import {
  cleanupTestDatabase,
  createResendMock,
  createStorageBoundaryMock,
  createStripeMock,
  createSupabaseMock,
  getSeededTestDatabase,
  seedTestDatabase,
} from '../src/lib/test';

describe('test foundation', () => {
  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('seeds deterministic fixtures and exposes expected roles/domains', async () => {
    const seeded = await seedTestDatabase();

    expect(seeded.users).toHaveLength(5);
    expect(seeded.events).toHaveLength(1);
    expect(seeded.rubrics).toHaveLength(1);
    expect(seeded.scores).toHaveLength(1);
    expect(seeded.users.map((user) => user.role).sort()).toEqual([
      'admin',
      'audience',
      'founder',
      'judge',
      'mentor',
    ]);
  });

  it('cleanupTestDatabase removes seeded fixtures', async () => {
    await seedTestDatabase();
    expect(getSeededTestDatabase()).not.toBeNull();

    await cleanupTestDatabase();
    expect(getSeededTestDatabase()).toBeNull();
  });

  it('seed/cleanup helpers do not perform network calls', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as never);

    await seedTestDatabase();
    await cleanupTestDatabase();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('provides reusable service mocks for supabase, stripe, resend, and storage boundaries', async () => {
    const supabaseMock = createSupabaseMock();
    const stripeMock = createStripeMock();
    const resendMock = createResendMock();
    const storageMock = createStorageBoundaryMock();

    const uploadResult = await supabaseMock.storage.upload('pitch-decks', 'path/test.pdf', Buffer.from('x'));
    const checkout = await stripeMock.checkout.sessions.create();
    const sendResult = await resendMock.emails.send({ to: 'user@example.com' });
    const storageResult = await storageMock.uploadFile(Buffer.from('file'), 'social-assets', 'user-1');

    expect(uploadResult.error).toBeNull();
    expect(checkout.id).toBe('cs_test_mock');
    expect(sendResult.id).toBe('re_test_mock');
    expect(storageResult.path).toContain('social-assets/user-1');
  });
});

