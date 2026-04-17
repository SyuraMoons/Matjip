import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateKarmaRewardProgress,
  type KarmaProgressMemory,
} from "./karmaProgress.ts";

function memory(
  id: number,
  lng: number,
  rewardClaimed = false
): KarmaProgressMemory {
  return {
    id,
    lat: 0,
    lng,
    rewardClaimed,
  };
}

test("returns progress for one connected region", () => {
  assert.deepEqual(
    calculateKarmaRewardProgress([
      memory(1, 0),
      memory(2, 0.001),
      memory(3, 0.002),
    ]),
    {
      count: 3,
      target: 5,
      regionCount: 1,
      bestRegionSize: 3,
    }
  );
});

test("shows the best disconnected region instead of summing regions", () => {
  assert.deepEqual(
    calculateKarmaRewardProgress([
      memory(1, 0),
      memory(2, 0.001),
      memory(3, 0.02),
      memory(4, 0.021),
      memory(5, 0.022),
    ]),
    {
      count: 3,
      target: 5,
      regionCount: 2,
      bestRegionSize: 3,
    }
  );
});

test("does not combine disconnected regions into a completed reward", () => {
  assert.deepEqual(
    calculateKarmaRewardProgress([
      memory(1, 0),
      memory(2, 0.001),
      memory(3, 0.002),
      memory(4, 0.003),
      memory(5, 0.02),
    ]),
    {
      count: 4,
      target: 5,
      regionCount: 2,
      bestRegionSize: 4,
    }
  );
});

test("claimed memories connect regions but do not count toward progress", () => {
  assert.deepEqual(
    calculateKarmaRewardProgress([
      memory(1, 0),
      memory(2, 0.001, true),
      memory(3, 0.002),
    ]),
    {
      count: 2,
      target: 5,
      regionCount: 1,
      bestRegionSize: 2,
    }
  );
});

test("caps completed regions at the reward target", () => {
  assert.deepEqual(
    calculateKarmaRewardProgress([
      memory(1, 0),
      memory(2, 0.001),
      memory(3, 0.002),
      memory(4, 0.003),
      memory(5, 0.004),
      memory(6, 0.005),
    ]),
    {
      count: 5,
      target: 5,
      regionCount: 1,
      bestRegionSize: 6,
    }
  );
});
