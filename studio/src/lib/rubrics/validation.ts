import type { RubricDefinition } from './types';

export function totalCategoryWeight(definition: RubricDefinition): number {
  return definition.categories.reduce((sum, category) => sum + Number(category.weight || 0), 0);
}

export function questionCount(definition: RubricDefinition): number {
  return definition.categories.reduce((sum, category) => sum + category.questions.length, 0);
}

export function validateRubricDefinition(definition: RubricDefinition): { valid: boolean; message?: string } {
  if (!definition || !Array.isArray(definition.categories) || definition.categories.length === 0) {
    return { valid: false, message: 'Rubric must include at least one category.' };
  }

  for (const category of definition.categories) {
    if (!category.name?.trim()) {
      return { valid: false, message: 'Each category must have a name.' };
    }

    if (!Array.isArray(category.questions) || category.questions.length === 0) {
      return { valid: false, message: 'Each category must include at least one question.' };
    }

    for (const question of category.questions) {
      if (!question.text?.trim()) {
        return { valid: false, message: 'Each question must have text.' };
      }

      if (!Array.isArray(question.scale) || question.scale.length < 2) {
        return { valid: false, message: 'Each question scale must include at least two values.' };
      }
    }
  }

  if (Math.abs(totalCategoryWeight(definition) - 100) > 0.0001) {
    return { valid: false, message: 'Category weights must sum to 100%.' };
  }

  return { valid: true };
}
