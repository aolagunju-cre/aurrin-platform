import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RubricRenderer } from '../src/components/judge/RubricRenderer';

describe('RubricRenderer', () => {
  const rubricVersion = {
    definition: {
      categories: [
        {
          name: 'Fit',
          weight: 100,
          questions: [
            { id: 'q-text', text: 'Narrative', response_type: 'text', required: true },
            { id: 'q-radio', text: 'Score 1-5', response_type: 'radio', scale: [1, 2, 3, 4, 5], required: true },
            { id: 'q-num', text: 'Numeric 0-100', response_type: 'numeric', required: true },
            {
              id: 'q-select',
              text: 'Selection',
              response_type: 'selection',
              options: [
                { label: 'Low', value: '1' },
                { label: 'High', value: '5' },
              ],
              required: true,
            },
          ],
        },
      ],
    },
  };

  it('renders all required question input types', () => {
    render(
      <RubricRenderer
        rubricVersion={rubricVersion}
        responses={{}}
        onResponseChange={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Narrative')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Score 1-5' })).toBeInTheDocument();
    expect(screen.getByLabelText('Numeric 0-100')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Selection' })).toBeInTheDocument();
  });

  it('emits response changes for dynamic rubric questions', () => {
    const onResponseChange = jest.fn();

    render(
      <RubricRenderer
        rubricVersion={rubricVersion}
        responses={{}}
        onResponseChange={onResponseChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Narrative'), { target: { value: 'Strong founder story' } });
    fireEvent.click(screen.getByRole('radio', { name: '5' }));
    fireEvent.change(screen.getByLabelText('Numeric 0-100'), { target: { value: '88' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Selection' }), { target: { value: '5' } });

    expect(onResponseChange).toHaveBeenCalledWith('q-text', 'Strong founder story');
    expect(onResponseChange).toHaveBeenCalledWith('q-radio', '5');
    expect(onResponseChange).toHaveBeenCalledWith('q-num', '88');
    expect(onResponseChange).toHaveBeenCalledWith('q-select', '5');
  });
});
