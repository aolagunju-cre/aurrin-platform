export interface RubricQuestion {
  id?: string;
  text: string;
  scale: number[];
  response_type: string;
}

export interface RubricCategory {
  id?: string;
  name: string;
  weight: number;
  questions: RubricQuestion[];
}

export interface RubricDefinition {
  categories: RubricCategory[];
}

export interface RubricTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricVersionRecord {
  id: string;
  rubric_template_id: string;
  event_id: string | null;
  version: number;
  definition: RubricDefinition;
  created_at: string;
}

export interface RubricSummary {
  id: string;
  name: string;
  description: string | null;
  version: number;
  question_count: number;
  last_updated: string;
}
