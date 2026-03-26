export interface ScoringQuestion {
  id?: string;
  text: string;
  response_type: 'text' | 'radio' | 'numeric' | 'selection' | string;
  scale?: number[];
  options?: Array<{ label: string; value: string | number }>;
  required?: boolean;
  description?: string;
}

export interface ScoringCategory {
  id?: string;
  name: string;
  weight: number;
  questions: ScoringQuestion[];
}

export interface ScoringRubricVersion {
  id?: string;
  definition: {
    categories: ScoringCategory[];
  };
}

export type ScoringResponses = Record<string, unknown>;

export interface CategoryBreakdown {
  category: string;
  weight: number;
  raw_average: number;
  weighted: number;
  question_count: number;
  questions: Array<{
    question_id: string;
    label: string;
    raw: unknown;
    normalized: number;
    missing: boolean;
    required: boolean;
  }>;
}

export interface ScoreTotals {
  by_category: Record<string, number>;
  total: number;
  breakdown: {
    categories: CategoryBreakdown[];
    missing_required: string[];
    mode: 'zero_on_missing';
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeScaleValue(raw: number, scale: number[]): number {
  if (scale.length < 2) {
    return clamp(raw, 0, 100);
  }

  const min = Math.min(...scale);
  const max = Math.max(...scale);
  if (max <= min) {
    return clamp(raw, 0, 100);
  }

  const normalized = ((raw - min) / (max - min)) * 100;
  return clamp(normalized, 0, 100);
}

function normalizeResponse(question: ScoringQuestion, value: unknown): number | null {
  const numeric = toNumeric(value);

  if (question.response_type === 'numeric') {
    if (numeric === null) {
      return null;
    }
    return clamp(numeric, 0, 100);
  }

  if (question.response_type === 'radio' || question.response_type === 'selection') {
    if (numeric === null) {
      return null;
    }
    const scale = question.scale ?? [1, 2, 3, 4, 5];
    return normalizeScaleValue(numeric, scale);
  }

  if (question.response_type === 'text') {
    if (numeric === null) {
      return 0;
    }
    return clamp(numeric, 0, 100);
  }

  if (numeric === null) {
    return null;
  }

  return clamp(numeric, 0, 100);
}

export function resolveQuestionId(question: ScoringQuestion, categoryIndex: number, questionIndex: number): string {
  return question.id ?? `${categoryIndex}:${questionIndex}`;
}

export function calculateTotals(responses: ScoringResponses, rubric_version: ScoringRubricVersion): ScoreTotals {
  const by_category: Record<string, number> = {};
  const breakdown: CategoryBreakdown[] = [];
  const missingRequired: string[] = [];

  const categories = rubric_version?.definition?.categories ?? [];

  for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
    const category = categories[categoryIndex];
    const weight = Number.isFinite(Number(category.weight)) ? Number(category.weight) : 0;
    let categorySum = 0;

    const questionBreakdown = category.questions.map((question, questionIndex) => {
      const questionId = resolveQuestionId(question, categoryIndex, questionIndex);
      const rawValue = responses[questionId];
      const missing = rawValue === undefined || rawValue === null || rawValue === '';
      const required = Boolean(question.required);

      if (missing && required) {
        missingRequired.push(questionId);
      }

      const normalizedMaybe = normalizeResponse(question, rawValue);
      const normalized = missing || normalizedMaybe === null ? 0 : normalizedMaybe;
      categorySum += normalized;

      return {
        question_id: questionId,
        label: question.text,
        raw: rawValue,
        normalized: round2(normalized),
        missing,
        required,
      };
    });

    const questionCount = category.questions.length;
    const rawAverage = questionCount > 0 ? categorySum / questionCount : 0;
    const weighted = rawAverage * (weight / 100);

    by_category[category.name] = round2(weighted);
    breakdown.push({
      category: category.name,
      weight,
      raw_average: round2(rawAverage),
      weighted: round2(weighted),
      question_count: questionCount,
      questions: questionBreakdown,
    });
  }

  const total = round2(Object.values(by_category).reduce((sum, value) => sum + value, 0));

  return {
    by_category,
    total,
    breakdown: {
      categories: breakdown,
      missing_required: missingRequired,
      mode: 'zero_on_missing',
    },
  };
}
