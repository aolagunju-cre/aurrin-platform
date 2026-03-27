import type { EventStatus } from '../../db/client';

export interface TestEventFixture {
  id: string;
  name: string;
  description: string;
  status: EventStatus;
  start_date: string;
  end_date: string;
  scoring_start: string;
  scoring_end: string;
  publishing_start: string;
  publishing_end: string;
  created_at: string;
  updated_at: string;
}

const BASE_EVENT: TestEventFixture = {
  id: 'event-live-001',
  name: 'Aurrin Demo Day',
  description: 'Deterministic test event fixture',
  status: 'live',
  start_date: '2026-01-10T09:00:00.000Z',
  end_date: '2026-01-10T18:00:00.000Z',
  scoring_start: '2026-01-10T09:00:00.000Z',
  scoring_end: '2026-01-11T18:00:00.000Z',
  publishing_start: '2026-01-12T09:00:00.000Z',
  publishing_end: '2026-01-20T18:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export function buildTestEvent(overrides: Partial<TestEventFixture> = {}): TestEventFixture {
  return {
    ...BASE_EVENT,
    ...overrides,
  };
}

export function createEventFixtures(overrides: Partial<TestEventFixture>[] = []): TestEventFixture[] {
  if (overrides.length === 0) {
    return [buildTestEvent()];
  }
  return overrides.map((eventOverrides) => buildTestEvent(eventOverrides));
}

