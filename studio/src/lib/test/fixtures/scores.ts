import { calculateTotals } from '../../scoring/calculate';
import { buildTestRubric, type TestRubricFixture } from './rubrics';

export type TestJudgeScoreState = 'draft' | 'submitted' | 'locked';

export interface TestScoreFixture {
  id: string;
  judge_id: string;
  founder_pitch_id: string;
  rubric_version_id: string;
  responses: Record<string, unknown>;
  comments: string;
  total_score: number;
  category_scores: Record<string, number>;
  state: TestJudgeScoreState;
  created_at: string;
  updated_at: string;
}

const BASE_RESPONSES: Record<string, unknown> = {
  'q-problem-clarity': 4,
  'q-problem-urgency': 5,
  'q-solution-feasibility': 4,
  'q-solution-market': 3,
};

export function buildTestScore(
  overrides: Partial<TestScoreFixture> = {},
  rubric: TestRubricFixture = buildTestRubric()
): TestScoreFixture {
  const responses = overrides.responses ?? BASE_RESPONSES;
  const totals = calculateTotals(
    responses,
    {
      id: rubric.id,
      definition: rubric.definition,
    }
  );

  return {
    id: 'judge-score-001',
    judge_id: 'user-judge-001',
    founder_pitch_id: 'founder-pitch-001',
    responses,
    comments: 'Strong pitch with clear market demand.',
    total_score: totals.total,
    category_scores: totals.by_category,
    state: 'submitted',
    created_at: '2026-01-10T11:00:00.000Z',
    updated_at: '2026-01-10T11:30:00.000Z',
    ...overrides,
    rubric_version_id: overrides.rubric_version_id ?? rubric.id,
  };
}

export function createScoreFixtures(
  overrides: Partial<TestScoreFixture>[] = [],
  rubric: TestRubricFixture = buildTestRubric()
): TestScoreFixture[] {
  if (overrides.length === 0) {
    return [buildTestScore({}, rubric)];
  }
  return overrides.map((scoreOverrides) => buildTestScore(scoreOverrides, rubric));
}
