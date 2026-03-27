'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@heroui/button';
import type { RubricDefinition, RubricTemplateRecord, RubricVersionRecord } from '../../lib/rubrics/types';
import { totalCategoryWeight } from '../../lib/rubrics/validation';
import { RubricForm } from './RubricForm';

interface RubricBuilderProps {
  rubric: RubricTemplateRecord;
  latestVersion: RubricVersionRecord;
  onSave: (payload: { name: string; description: string; definition: RubricDefinition }) => Promise<void>;
  onClone: () => Promise<void>;
}

const inputClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

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
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rubric Builder</h1>
        <p className="mt-1 text-sm text-default-500">Current version: {latestVersion.version}</p>
      </div>

      <div className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Metadata</h2>
        <RubricForm
          initialName={name}
          initialDescription={description}
          onSubmit={async ({ name: nextName, description: nextDescription }) => {
            setName(nextName);
            setDescription(nextDescription);
          }}
          submitLabel="Update Metadata"
        />
      </div>

      <section aria-label="Rubric Categories" className="grid gap-4">
        {definition.categories.map((category, categoryIndex) => (
          <article
            key={`category-${categoryIndex}`}
            className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium text-default-600">Category Name</label>
                <input
                  value={category.name}
                  onChange={(event) => updateCategoryName(categoryIndex, event.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium text-default-600">Weight %</label>
                <input
                  type="number"
                  value={category.weight}
                  onChange={(event) => updateCategoryWeight(categoryIndex, Number(event.target.value))}
                  disabled={isSaving}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-3">
              {category.questions.map((question, questionIndex) => (
                <div
                  key={`question-${categoryIndex}-${questionIndex}`}
                  className="rounded-xl border border-dashed border-default-200 bg-default-100/50 p-4"
                >
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium text-default-600">Question Text</label>
                      <input
                        value={question.text}
                        onChange={(event) => updateQuestion(categoryIndex, questionIndex, 'text', event.target.value)}
                        disabled={isSaving}
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium text-default-600">Response Type</label>
                        <input
                          value={question.response_type}
                          onChange={(event) =>
                            updateQuestion(categoryIndex, questionIndex, 'response_type', event.target.value)
                          }
                          disabled={isSaving}
                          className={inputClass}
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium text-default-600">Scale (comma separated)</label>
                        <input
                          value={question.scale.join(',')}
                          onChange={(event) => updateQuestionScale(categoryIndex, questionIndex, event.target.value)}
                          disabled={isSaving}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      color="danger"
                      variant="light"
                      size="sm"
                      onPress={() => removeQuestion(categoryIndex, questionIndex)}
                      isDisabled={isSaving || category.questions.length === 1}
                    >
                      Remove Question
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                color="default"
                variant="flat"
                size="sm"
                onPress={() => addQuestion(categoryIndex)}
                isDisabled={isSaving}
              >
                Add Question
              </Button>
              <Button
                type="button"
                color="danger"
                variant="flat"
                size="sm"
                onPress={() => removeCategory(categoryIndex)}
                isDisabled={isSaving || definition.categories.length === 1}
              >
                Delete Category
              </Button>
            </div>
          </article>
        ))}
      </section>

      <div>
        <Button type="button" color="default" variant="bordered" onPress={addCategory} isDisabled={isSaving}>
          Add Category
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-default-500">
          Weight Total:{' '}
          <span
            className={`font-semibold ${
              Math.abs(weightTotal - 100) < 0.0001 ? 'text-success' : 'text-danger'
            }`}
          >
            {weightTotal}%
          </span>
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="button" color="primary" onPress={() => void handleSave()} isDisabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save New Version'}
        </Button>
        <Button type="button" color="default" variant="flat" onPress={() => void handleClone()} isDisabled={isCloning}>
          {isCloning ? 'Cloning...' : 'Clone Rubric'}
        </Button>
      </div>
    </div>
  );
}
