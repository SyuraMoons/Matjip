// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MemoryRegistry {
    error EmptyMetadataCid();
    error EmptyMetadataHash();
    error InvalidLatitude();
    error InvalidLongitude();

    struct Memory {
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

    int32 private constant MIN_LAT_E6 = -90_000000;
    int32 private constant MAX_LAT_E6 = 90_000000;
    int32 private constant MIN_LNG_E6 = -180_000000;
    int32 private constant MAX_LNG_E6 = 180_000000;

    Memory[] private memories;

    function createMemory(
        string calldata metadataCid,
        bytes32 metadataHash,
        int32 latE6,
        int32 lngE6
    ) external returns (uint256 memoryId) {
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
                createdAt: createdAt
            })
        );

        emit MemoryCreated(
            memoryId,
            msg.sender,
            metadataCid,
            metadataHash,
            latE6,
            lngE6,
            createdAt
        );
    }

    function memoryCount() external view returns (uint256) {
        return memories.length;
    }

    function getMemory(uint256 memoryId) external view returns (Memory memory) {
        return memories[memoryId];
    }
}
