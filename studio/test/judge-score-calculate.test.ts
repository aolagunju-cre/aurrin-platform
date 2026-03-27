import { calculateTotals } from '../src/lib/scoring/calculate';

describe('calculateTotals', () => {
  const rubricVersion = {
    id: 'rubric-v1',
    definition: {
      categories: [
        {
          id: 'cat-a',
          name: 'Category A',
          weight: 40,
          questions: [
            { id: 'a1', text: 'Problem severity', response_type: 'radio', scale: [1, 2, 3, 4, 5], required: true },
            { id: 'a2', text: 'Traction', response_type: 'numeric', required: true },
          ],
        },
        {
          id: 'cat-b',
          name: 'Category B',
          weight: 60,
          questions: [
            { id: 'b1', text: 'Differentiation', response_type: 'selection', scale: [1, 2, 3, 4, 5], required: true },
            { id: 'b2', text: 'Notes', response_type: 'text', required: false },
          ],
        },
      ],
    },
  };

  it('applies weighted totals with uneven category weights', () => {
    const totals = calculateTotals(
      {
        a1: '5',
        a2: 80,
        b1: '4',
        b2: 'comment without numeric score',
      },
      rubricVersion
    );

    expect(totals.by_category['Category A']).toBe(36);
    expect(totals.by_category['Category B']).toBe(22.5);
    expect(totals.total).toBe(58.5);
  });

  it('handles missing required responses deterministically as zero with tracked missing ids', () => {
    const totals = calculateTotals(
      {
        a1: '3',
      },
      rubricVersion
    );

    expect(totals.breakdown.mode).toBe('zero_on_missing');
    expect(totals.breakdown.missing_required).toEqual(expect.arrayContaining(['a2', 'b1']));
    expect(totals.total).toBeGreaterThanOrEqual(0);
  });

  it('keeps boundary values 0 and 100 within expected weighted totals', () => {
    const totals = calculateTotals(
      {
        a1: 5,
        a2: 0,
        b1: 1,
      },
      rubricVersion
    );

    expect(totals.by_category['Category A']).toBe(20);
    expect(totals.by_category['Category B']).toBe(0);
    expect(totals.total).toBe(20);
  });
});
