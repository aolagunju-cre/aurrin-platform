export type TestUserRole = 'admin' | 'judge' | 'founder' | 'mentor' | 'audience';

export interface TestUserFixture {
  id: string;
  email: string;
  name: string;
  role: TestUserRole;
  created_at: string;
  updated_at: string;
}

const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

const USER_BY_ROLE: Record<TestUserRole, TestUserFixture> = {
  admin: {
    id: 'user-admin-001',
    email: 'admin@test.aurrin.local',
    name: 'Test Admin',
    role: 'admin',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
  },
  judge: {
    id: 'user-judge-001',
    email: 'judge@test.aurrin.local',
    name: 'Test Judge',
    role: 'judge',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
  },
  founder: {
    id: 'user-founder-001',
    email: 'founder@test.aurrin.local',
    name: 'Test Founder',
    role: 'founder',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
  },
  mentor: {
    id: 'user-mentor-001',
    email: 'mentor@test.aurrin.local',
    name: 'Test Mentor',
    role: 'mentor',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
  },
  audience: {
    id: 'user-audience-001',
    email: 'audience@test.aurrin.local',
    name: 'Test Audience',
    role: 'audience',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
  },
};

export function buildTestUser(
  role: TestUserRole,
  overrides: Partial<TestUserFixture> = {}
): TestUserFixture {
  return {
    ...USER_BY_ROLE[role],
    ...overrides,
    role,
  };
}

export function createUserFixtures(
  overrides: Partial<Record<TestUserRole, Partial<TestUserFixture>>> = {}
): TestUserFixture[] {
  return (Object.keys(USER_BY_ROLE) as TestUserRole[]).map((role) =>
    buildTestUser(role, overrides[role])
  );
}

