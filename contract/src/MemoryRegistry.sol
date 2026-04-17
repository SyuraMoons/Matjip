// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockKarma} from "./MockKarma.sol";

contract MemoryRegistry {
    error EmptyMetadataCid();
    error EmptyMetadataHash();
    error InvalidLatitude();
    error InvalidLongitude();
    error ZeroKarmaAddress();

    struct Memory {
        address poster;
        string metadataCid;
        bytes32 metadataHash;
        int32 latE6;
        int32 lngE6;
        uint64 createdAt;
        bool rewardClaimed;
    }

    struct MemoryView {
        address poster;
        string metadataCid;
        bytes32 metadataHash;
        int32 latE6;
        int32 lngE6;
        uint64 createdAt;
    }

    event MemoryCreated(
        uint256 indexed memoryId,
        address indexed poster,
        string metadataCid,
        bytes32 metadataHash,
        int32 latE6,
        int32 lngE6,
        uint64 createdAt
    );

    event KarmaRewarded(
        address indexed user, uint256 amount, uint256 indexed triggerMemoryId, uint256 claimedMemoryCount
    );

    int32 private constant MIN_LAT_E6 = -90_000000;
    int32 private constant MAX_LAT_E6 = 90_000000;
    int32 private constant MIN_LNG_E6 = -180_000000;
    int32 private constant MAX_LNG_E6 = 180_000000;
    uint256 private constant CONNECTION_DISTANCE_E6 = 4_500;
    uint256 private constant KARMA_GROUP_SIZE = 5;
    uint256 private constant KARMA_REWARD = 3 ether;

    MockKarma public immutable karma;

    Memory[] private memories;

    constructor(MockKarma karma_) {
        if (address(karma_) == address(0)) revert ZeroKarmaAddress();
        karma = karma_;
    }

    function createMemory(string calldata metadataCid, bytes32 metadataHash, int32 latE6, int32 lngE6)
        external
        returns (uint256 memoryId)
    {
        if (bytes(metadataCid).length == 0) revert EmptyMetadataCid();
        if (metadataHash == bytes32(0)) revert EmptyMetadataHash();
        if (latE6 < MIN_LAT_E6 || latE6 > MAX_LAT_E6) revert InvalidLatitude();
        if (lngE6 < MIN_LNG_E6 || lngE6 > MAX_LNG_E6) revert InvalidLongitude();

        memoryId = memories.length;
        uint64 createdAt = uint64(block.timestamp);

        memories.push(
            Memory({
                poster: msg.sender,
                metadataCid: metadataCid,
                metadataHash: metadataHash,
                latE6: latE6,
                lngE6: lngE6,
                createdAt: createdAt,
                rewardClaimed: false
            })
        );

        emit MemoryCreated(memoryId, msg.sender, metadataCid, metadataHash, latE6, lngE6, createdAt);
        _rewardIfClusterCompleted(memoryId);
    }

    function memoryCount() external view returns (uint256) {
        return memories.length;
    }

    function getMemory(uint256 memoryId) external view returns (MemoryView memory) {
        Memory storage stored = memories[memoryId];
        return MemoryView({
            poster: stored.poster,
            metadataCid: stored.metadataCid,
            metadataHash: stored.metadataHash,
            latE6: stored.latE6,
            lngE6: stored.lngE6,
            createdAt: stored.createdAt
        });
    }

    function isRewardClaimed(uint256 memoryId) external view returns (bool) {
        return memories[memoryId].rewardClaimed;
    }

    function _rewardIfClusterCompleted(uint256 triggerMemoryId) private {
        uint256 length = memories.length;
        bool[] memory visited = new bool[](length);
        uint256[] memory queue = new uint256[](length);
        uint256[] memory component = new uint256[](length);
        uint256 head = 0;
        uint256 tail = 1;
        uint256 componentCount = 0;
        uint256 unclaimedCount = 0;

        visited[triggerMemoryId] = true;
        queue[0] = triggerMemoryId;

        while (head < tail) {
            uint256 currentId = queue[head++];
            component[componentCount++] = currentId;

            if (!memories[currentId].rewardClaimed) {
                unclaimedCount++;
            }

            for (uint256 candidateId = 0; candidateId < length; candidateId++) {
                if (visited[candidateId]) continue;

                if (_areConnected(memories[currentId], memories[candidateId])) {
                    visited[candidateId] = true;
                    queue[tail++] = candidateId;
                }
            }
        }

        if (unclaimedCount < KARMA_GROUP_SIZE) return;

        uint256 claimed = 0;
        for (uint256 i = 0; i < componentCount && claimed < KARMA_GROUP_SIZE; i++) {
            uint256 memoryId = component[i];
            if (memories[memoryId].rewardClaimed) continue;

            memories[memoryId].rewardClaimed = true;
            claimed++;
        }

        karma.mint(msg.sender, KARMA_REWARD);
        emit KarmaRewarded(msg.sender, KARMA_REWARD, triggerMemoryId, claimed);
    }

    function _areConnected(Memory storage first, Memory storage second) private view returns (bool) {
        uint256 latDiff = _absDiff(first.latE6, second.latE6);
        uint256 lngDiff = _absDiff(first.lngE6, second.lngE6);
        uint256 maxDistanceSquared = CONNECTION_DISTANCE_E6 * CONNECTION_DISTANCE_E6;

        return latDiff * latDiff + lngDiff * lngDiff <= maxDistanceSquared;
    }

    function _absDiff(int32 first, int32 second) private pure returns (uint256) {
        int256 diff = int256(first) - int256(second);
        return uint256(diff < 0 ? -diff : diff);
    }
}
