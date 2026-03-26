'use client';

import React, { useMemo, useState } from 'react';
import type { RubricDefinition, RubricTemplateRecord, RubricVersionRecord } from '../../lib/rubrics/types';
import { totalCategoryWeight } from '../../lib/rubrics/validation';
import { RubricForm } from './RubricForm';

interface RubricBuilderProps {
  rubric: RubricTemplateRecord;
  latestVersion: RubricVersionRecord;
  onSave: (payload: { name: string; description: string; definition: RubricDefinition }) => Promise<void>;
  onClone: () => Promise<void>;
}

function defaultQuestion() {
  return {
    text: '',
    scale: [1, 2, 3, 4, 5],
    response_type: 'score',
  };
}

export function RubricBuilder({ rubric, latestVersion, onSave, onClone }: RubricBuilderProps): React.ReactElement {
  const [name, setName] = useState(rubric.name);
  const [description, setDescription] = useState(rubric.description ?? '');
  const [definition, setDefinition] = useState<RubricDefinition>(latestVersion.definition);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const weightTotal = useMemo(() => totalCategoryWeight(definition), [definition]);

  function cloneDefinition(value: RubricDefinition): RubricDefinition {
    return JSON.parse(JSON.stringify(value)) as RubricDefinition;
  }

  function updateCategoryName(index: number, value: string): void {
    setDefinition((current) => {
      const next = cloneDefinition(current);
      next.categories[index].name = value;
      return next;
    });
  }

  function updateCategoryWeight(index: number, value: number): void {
    setDefinition((current) => {
      const next = cloneDefinition(current);
      next.categories[index].weight = value;
      return next;
    });
  }

  function updateQuestion(index: number, questionIndex: number, field: 'text' | 'response_type', value: string): void {
    setDefinition((current) => {
      const next = cloneDefinition(current);
      next.categories[index].questions[questionIndex][field] = value;
      return next;
    });
  }

  function updateQuestionScale(index: number, questionIndex: number, value: string): void {
    const parsedScale = value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry));

    setDefinition((current) => {
      const next = cloneDefinition(current);
      next.categories[index].questions[questionIndex].scale = parsedScale.length > 0 ? parsedScale : [1, 2, 3, 4, 5];
      return next;
    });
  }

  function addCategory(): void {
    setDefinition((current) => ({
      categories: [
        ...current.categories,
        {
          name: '',
          weight: 0,
          questions: [defaultQuestion()],
        },
      ],
    }));
  }

  function removeCategory(index: number): void {
    setDefinition((current) => ({
      categories: current.categories.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function addQuestion(index: number): void {
    setDefinition((current) => {
      const next = cloneDefinition(current);
      next.categories[index].questions.push(defaultQuestion());
      return next;
    });
  }

  function removeQuestion(index: number, questionIndex: number): void {
    setDefinition((current) => {
      const next = cloneDefinition(current);
      next.categories[index].questions = next.categories[index].questions.filter(
        (_, currentQuestionIndex) => currentQuestionIndex !== questionIndex
      );
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    if (Math.abs(weightTotal - 100) > 0.0001) {
      setError('Category weights must sum to 100%.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        definition,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save rubric.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClone(): Promise<void> {
    setIsCloning(true);
    setError(null);
    try {
      await onClone();
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : 'Failed to clone rubric.');
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h1>Rubric Builder</h1>
      <p>Current version: {latestVersion.version}</p>

      <RubricForm
        initialName={name}
        initialDescription={description}
        onSubmit={async ({ name: nextName, description: nextDescription }) => {
          setName(nextName);
          setDescription(nextDescription);
        }}
        submitLabel="Update Metadata"
      />

      <section aria-label="Rubric Categories" style={{ display: 'grid', gap: '1rem' }}>
        {definition.categories.map((category, categoryIndex) => (
          <article key={`category-${categoryIndex}`} style={{ border: '1px solid #ddd', padding: '0.75rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.5rem' }}>
              Category Name
              <input
                value={category.name}
                onChange={(event) => updateCategoryName(categoryIndex, event.target.value)}
                disabled={isSaving}
              />
            </label>

            <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem' }}>
              Weight %
              <input
                type="number"
                value={category.weight}
                onChange={(event) => updateCategoryWeight(categoryIndex, Number(event.target.value))}
                disabled={isSaving}
              />
            </label>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {category.questions.map((question, questionIndex) => (
                <div key={`question-${categoryIndex}-${questionIndex}`} style={{ border: '1px dashed #ddd', padding: '0.5rem' }}>
                  <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    Question Text
                    <input
                      value={question.text}
                      onChange={(event) => updateQuestion(categoryIndex, questionIndex, 'text', event.target.value)}
                      disabled={isSaving}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.25rem' }}>
                    Response Type
                    <input
                      value={question.response_type}
                      onChange={(event) => updateQuestion(categoryIndex, questionIndex, 'response_type', event.target.value)}
                      disabled={isSaving}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.25rem', marginTop: '0.5rem' }}>
                    Scale (comma separated)
                    <input
                      value={question.scale.join(',')}
                      onChange={(event) => updateQuestionScale(categoryIndex, questionIndex, event.target.value)}
                      disabled={isSaving}
                    />
                  </label>

                  <button type="button" onClick={() => removeQuestion(categoryIndex, questionIndex)} disabled={isSaving || category.questions.length === 1}>
                    Remove Question
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" onClick={() => addQuestion(categoryIndex)} disabled={isSaving}>
                Add Question
              </button>
              <button type="button" onClick={() => removeCategory(categoryIndex)} disabled={isSaving || definition.categories.length === 1}>
                Delete Category
              </button>
            </div>
          </article>
        ))}
      </section>

      <button type="button" onClick={addCategory} disabled={isSaving}>
        Add Category
      </button>

      <p>Weight Total: {weightTotal}%</p>
      {error ? (
        <p role="alert" style={{ color: '#b00', margin: 0 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save New Version'}
        </button>
        <button type="button" onClick={handleClone} disabled={isCloning}>
          {isCloning ? 'Cloning...' : 'Clone Rubric'}
        </button>
      </div>
    </div>
  );
}
