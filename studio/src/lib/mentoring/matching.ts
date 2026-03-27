export interface MatchPair {
  mentor_id: string;
  founder_id: string;
}

export interface MatchBuildResult {
  matches: MatchPair[];
  conflicts: number;
}

type RandomFn = () => number;

type IsExcludedFn = (mentorId: string, founderId: string) => boolean;

function shuffleIds(ids: string[], random: RandomFn): string[] {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

export function buildMentorMatches(
  mentorIds: string[],
  founderIds: string[],
  numMentorsPerFounder: number,
  isExcluded: IsExcludedFn,
  random: RandomFn = Math.random
): MatchBuildResult {
  if (mentorIds.length === 0 || founderIds.length === 0 || numMentorsPerFounder <= 0) {
    return { matches: [], conflicts: 0 };
  }

  let conflicts = 0;
  const matches: MatchPair[] = [];

  for (const founderId of founderIds) {
    const selectedForFounder = new Set<string>();
    const shuffledMentors = shuffleIds(mentorIds, random);

    for (const mentorId of shuffledMentors) {
      if (selectedForFounder.size >= numMentorsPerFounder) {
        break;
      }
      if (selectedForFounder.has(mentorId)) {
        continue;
      }

      if (isExcluded(mentorId, founderId)) {
        conflicts += 1;
        continue;
      }

      selectedForFounder.add(mentorId);
      matches.push({ mentor_id: mentorId, founder_id: founderId });
    }
  }

  return { matches, conflicts };
}
