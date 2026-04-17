export const KARMA_REWARD_PROGRESS_TARGET = 5;

const CONNECTION_DISTANCE_E6 = 2_245;

export type KarmaProgressMemory = {
  id: number;
  lat: number;
  lng: number;
  rewardClaimed: boolean;
};

export type KarmaRewardProgress = {
  count: number;
  target: number;
};

function toE6(value: number) {
  return Math.round(value * 1_000_000);
}

function areConnected(first: KarmaProgressMemory, second: KarmaProgressMemory) {
  const latDiff = toE6(first.lat) - toE6(second.lat);
  const lngDiff = toE6(first.lng) - toE6(second.lng);

  return (
    latDiff * latDiff + lngDiff * lngDiff <=
    CONNECTION_DISTANCE_E6 * CONNECTION_DISTANCE_E6
  );
}

export function calculateKarmaRewardProgress(
  memories: KarmaProgressMemory[]
): KarmaRewardProgress {
  const visited = new Set<number>();
  let bestUnclaimedCount = 0;

  for (const memory of memories) {
    if (visited.has(memory.id)) continue;

    const queue = [memory];
    let cursor = 0;
    let unclaimedCount = 0;
    visited.add(memory.id);

    while (cursor < queue.length) {
      const current = queue[cursor];
      cursor++;

      if (!current.rewardClaimed) {
        unclaimedCount++;
      }

      for (const candidate of memories) {
        if (visited.has(candidate.id)) continue;

        if (areConnected(current, candidate)) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }

    bestUnclaimedCount = Math.max(bestUnclaimedCount, unclaimedCount);
  }

  return {
    count: Math.min(bestUnclaimedCount, KARMA_REWARD_PROGRESS_TARGET),
    target: KARMA_REWARD_PROGRESS_TARGET,
  };
}
