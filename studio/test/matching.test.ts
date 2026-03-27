import { buildMentorMatches } from '../src/lib/mentoring/matching';

describe('buildMentorMatches', () => {
  it('builds unique mentor/founder pairs and does not repeat mentors when capacity allows', () => {
    const mentorIds = ['m1', 'm2', 'm3'];
    const founderIds = ['f1', 'f2', 'f3'];

    const result = buildMentorMatches(mentorIds, founderIds, 1, () => false, () => 0);

    expect(result.conflicts).toBe(0);
    expect(result.matches).toHaveLength(3);

    const mentorsInRound = result.matches.map((pair) => pair.mentor_id);
    expect(new Set(mentorsInRound).size).toBe(mentorsInRound.length);
  });

  it('skips excluded historical pairs and counts repeat-prevention conflicts', () => {
    const result = buildMentorMatches(
      ['m1', 'm2'],
      ['f1'],
      2,
      (mentorId, founderId) => mentorId === 'm1' && founderId === 'f1',
      () => 0
    );

    expect(result.conflicts).toBe(1);
    expect(result.matches).toEqual([{ mentor_id: 'm2', founder_id: 'f1' }]);
  });

  it('returns no matches for empty inputs or non-positive requested mentors', () => {
    expect(buildMentorMatches([], ['f1'], 1, () => false).matches).toHaveLength(0);
    expect(buildMentorMatches(['m1'], [], 1, () => false).matches).toHaveLength(0);
    expect(buildMentorMatches(['m1'], ['f1'], 0, () => false).matches).toHaveLength(0);
  });
});
