export const KARMA_REWARD_PROGRESS_TARGET = 5;
export const KARMA_PROGRESS_CONNECTION_METERS = 400;

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

function areConnected(first: KarmaProgressMemory, second: KarmaProgressMemory) {
  const latMeters = 111_320;
  const meanLat = ((first.lat + second.lat) / 2) * (Math.PI / 180);
  const lngMeters = latMeters * Math.cos(meanLat);
  const latDiffMeters = (first.lat - second.lat) * latMeters;
  const lngDiffMeters = (first.lng - second.lng) * lngMeters;

  return (
    latDiffMeters * latDiffMeters + lngDiffMeters * lngDiffMeters <=
    KARMA_PROGRESS_CONNECTION_METERS * KARMA_PROGRESS_CONNECTION_METERS
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
