import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RubricBuilder } from '../src/components/admin/RubricBuilder';

describe('RubricBuilder', () => {
  const rubric = {
    id: 'template-1',
    name: 'Startup Rubric',
    description: 'Initial rubric',
    created_at: '2026-03-25T00:00:00.000Z',
    updated_at: '2026-03-25T00:00:00.000Z',
  };

  const latestVersion = {
    id: 'version-1',
    rubric_template_id: 'template-1',
    event_id: null,
    version: 1,
    created_at: '2026-03-25T00:00:00.000Z',
    definition: {
      categories: [
        {
          name: 'Problem',
          weight: 100,
          questions: [{ text: 'How painful is the problem?', response_type: 'score', scale: [1, 2, 3, 4, 5] }],
        },
      ],
    },
  };

  it('renders metadata, categories, and actions', () => {
    render(
      <RubricBuilder
        rubric={rubric}
        latestVersion={latestVersion}
        onSave={jest.fn().mockResolvedValue(undefined)}
        onClone={jest.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Rubric Builder')).toBeInTheDocument();
    expect(screen.getByText('Current version: 1')).toBeInTheDocument();
    expect(screen.getByText('Save New Version')).toBeInTheDocument();
    expect(screen.getByText('Clone Rubric')).toBeInTheDocument();
  });

  it('blocks save when weight total is not 100%', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <RubricBuilder
        rubric={rubric}
        latestVersion={latestVersion}
        onSave={onSave}
        onClone={jest.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '90' } });
    fireEvent.click(screen.getByText('Save New Version'));

    expect(screen.getByRole('alert')).toHaveTextContent('Category weights must sum to 100%.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sends save payload when weights are valid', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <RubricBuilder
        rubric={rubric}
        latestVersion={latestVersion}
        onSave={onSave}
        onClone={jest.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByText('Save New Version'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Startup Rubric',
        description: 'Initial rubric',
        definition: latestVersion.definition,
      });
    });
  });

  it('allows editing question scale values', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <RubricBuilder
        rubric={rubric}
        latestVersion={latestVersion}
        onSave={onSave}
        onClone={jest.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.change(screen.getByDisplayValue('1,2,3,4,5'), { target: { value: '0,2,4,6' } });
    fireEvent.click(screen.getByText('Save New Version'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Startup Rubric',
        description: 'Initial rubric',
        definition: {
          categories: [
            {
              name: 'Problem',
              weight: 100,
              questions: [{ text: 'How painful is the problem?', response_type: 'score', scale: [0, 2, 4, 6] }],
            },
          ],
        },
      });
    });
  });
});
