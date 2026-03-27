import { createEventFixtures, type TestEventFixture } from './fixtures/events';
import { createRubricFixtures, type TestRubricFixture } from './fixtures/rubrics';
import { createScoreFixtures, type TestScoreFixture } from './fixtures/scores';
import { createUserFixtures, type TestUserFixture } from './fixtures/users';

export interface SeededTestDatabase {
  users: TestUserFixture[];
  events: TestEventFixture[];
  rubrics: TestRubricFixture[];
  scores: TestScoreFixture[];
}

export interface SeedTestDatabaseOptions {
  users?: TestUserFixture[];
  events?: TestEventFixture[];
  rubrics?: TestRubricFixture[];
  scores?: TestScoreFixture[];
}

let seededTestState: SeededTestDatabase | null = null;

function cloneSeededState(state: SeededTestDatabase): SeededTestDatabase {
  return JSON.parse(JSON.stringify(state)) as SeededTestDatabase;
}

function buildDefaultSeedState(): SeededTestDatabase {
  const users = createUserFixtures();
  const events = createEventFixtures();
  const rubrics = createRubricFixtures();
  const scores = createScoreFixtures([], rubrics[0]);

  return {
    users,
    events,
    rubrics,
    scores,
  };
}

export async function seedTestDatabase(
  options: SeedTestDatabaseOptions = {}
): Promise<SeededTestDatabase> {
  const defaults = buildDefaultSeedState();
  seededTestState = {
    users: options.users ?? defaults.users,
    events: options.events ?? defaults.events,
    rubrics: options.rubrics ?? defaults.rubrics,
    scores: options.scores ?? defaults.scores,
  };
  return cloneSeededState(seededTestState);
}

export async function cleanupTestDatabase(): Promise<void> {
  seededTestState = null;
}

export function getSeededTestDatabase(): SeededTestDatabase | null {
  if (!seededTestState) {
    return null;
  }
  return cloneSeededState(seededTestState);
}

