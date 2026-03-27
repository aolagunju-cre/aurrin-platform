import type { RubricDefinition } from '../../rubrics/types';

export interface TestRubricFixture {
  id: string;
  rubric_template_id: string;
  version: number;
  definition: RubricDefinition;
  created_at: string;
}

const DEFAULT_RUBRIC_DEFINITION: RubricDefinition = {
  categories: [
    {
      id: 'category-problem',
      name: 'Problem',
      weight: 40,
      questions: [
        { id: 'q-problem-clarity', text: 'Problem clarity', scale: [1, 2, 3, 4, 5], response_type: 'radio' },
        { id: 'q-problem-urgency', text: 'Problem urgency', scale: [1, 2, 3, 4, 5], response_type: 'radio' },
      ],
    },
    {
      id: 'category-solution',
      name: 'Solution',
      weight: 60,
      questions: [
        { id: 'q-solution-feasibility', text: 'Solution feasibility', scale: [1, 2, 3, 4, 5], response_type: 'radio' },
        { id: 'q-solution-market', text: 'Market readiness', scale: [1, 2, 3, 4, 5], response_type: 'radio' },
      ],
    },
  ],
};

const BASE_RUBRIC: TestRubricFixture = {
  id: 'rubric-version-001',
  rubric_template_id: 'rubric-template-001',
  version: 1,
  definition: DEFAULT_RUBRIC_DEFINITION,
  created_at: '2026-01-01T00:00:00.000Z',
};

export function buildTestRubric(overrides: Partial<TestRubricFixture> = {}): TestRubricFixture {
  return {
    ...BASE_RUBRIC,
    ...overrides,
    definition: overrides.definition ?? BASE_RUBRIC.definition,
  };
}

export function createRubricFixtures(overrides: Partial<TestRubricFixture>[] = []): TestRubricFixture[] {
  if (overrides.length === 0) {
    return [buildTestRubric()];
  }
  return overrides.map((rubricOverrides) => buildTestRubric(rubricOverrides));
}

