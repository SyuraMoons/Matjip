// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MemoryRegistry} from "../src/MemoryRegistry.sol";
import {MockKarma} from "../src/MockKarma.sol";

contract MemoryRegistryTest is Test {
    MemoryRegistry public registry;
    MockKarma public karma;

    address private poster = address(0xA11CE);
    string private metadataCid = "ipfs://bafy-memory";
    bytes32 private metadataHash = keccak256("metadata");

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

    function setUp() public {
        karma = new MockKarma();
        registry = new MemoryRegistry(karma);
        karma.setMinter(address(registry));
    }

    function testCreateMemoryStoresRecord() public {
        vm.warp(1_234);
        vm.prank(poster);

        uint256 memoryId = registry.createMemory(metadataCid, metadataHash, 37_566000, 126_978000);

        assertEq(memoryId, 0);
        assertEq(registry.memoryCount(), 1);

        MemoryRegistry.MemoryView memory stored = registry.getMemory(0);
        assertEq(stored.poster, poster);
        assertEq(stored.metadataCid, metadataCid);
        assertEq(stored.metadataHash, metadataHash);
        assertEq(stored.latE6, 37_566000);
        assertEq(stored.lngE6, 126_978000);
        assertEq(stored.createdAt, 1_234);
        assertEq(registry.isRewardClaimed(0), false);
    }

    function testCreateMemoryEmitsEvent() public {
        vm.warp(2_468);
        vm.prank(poster);
        vm.expectEmit(true, true, false, true);

        emit MemoryCreated(0, poster, metadataCid, metadataHash, 37_566000, 126_978000, 2_468);

        registry.createMemory(metadataCid, metadataHash, 37_566000, 126_978000);
    }

    function testCreateMemoryIncrementsMemoryIds() public {
        uint256 firstId = registry.createMemory(metadataCid, metadataHash, 1_000000, 2_000000);
        uint256 secondId = registry.createMemory("ipfs://bafy-second", keccak256("metadata-2"), 3_000000, 4_000000);

        assertEq(firstId, 0);
        assertEq(secondId, 1);
        assertEq(registry.memoryCount(), 2);
    }

    function testMultiplePostersCanCreateMemories() public {
        address secondPoster = address(0xB0B);

        vm.prank(poster);
        registry.createMemory(metadataCid, metadataHash, 1_000000, 2_000000);

        vm.prank(secondPoster);
        registry.createMemory("ipfs://bafy-second", keccak256("metadata-2"), 3_000000, 4_000000);

        MemoryRegistry.MemoryView memory first = registry.getMemory(0);
        MemoryRegistry.MemoryView memory second = registry.getMemory(1);

        assertEq(first.poster, poster);
        assertEq(second.poster, secondPoster);
        assertEq(registry.memoryCount(), 2);
    }

    function testRevertsForEmptyCid() public {
        vm.expectRevert(MemoryRegistry.EmptyMetadataCid.selector);
        registry.createMemory("", metadataHash, 0, 0);
    }

    function testRevertsForEmptyHash() public {
        vm.expectRevert(MemoryRegistry.EmptyMetadataHash.selector);
        registry.createMemory(metadataCid, bytes32(0), 0, 0);
    }

    function testRevertsForInvalidLatitude() public {
        vm.expectRevert(MemoryRegistry.InvalidLatitude.selector);
        registry.createMemory(metadataCid, metadataHash, 90_000001, 0);

        vm.expectRevert(MemoryRegistry.InvalidLatitude.selector);
        registry.createMemory(metadataCid, metadataHash, -90_000001, 0);
    }

    function testRevertsForInvalidLongitude() public {
        vm.expectRevert(MemoryRegistry.InvalidLongitude.selector);
        registry.createMemory(metadataCid, metadataHash, 0, 180_000001);

        vm.expectRevert(MemoryRegistry.InvalidLongitude.selector);
        registry.createMemory(metadataCid, metadataHash, 0, -180_000001);
    }

    function testKarmaIsSoulbound() public {
        vm.expectRevert(MockKarma.Soulbound.selector);
        karma.transfer(address(0xB0B), 1);

        vm.expectRevert(MockKarma.Soulbound.selector);
        karma.approve(address(0xB0B), 1);

        vm.expectRevert(MockKarma.Soulbound.selector);
        karma.transferFrom(address(this), address(0xB0B), 1);
    }

    function testOnlyRegistryCanMintKarma() public {
        vm.expectRevert(MockKarma.NotMinter.selector);
        karma.mint(poster, 3 ether);
    }

    function testNoKarmaRewardBeforeFiveConnectedMemories() public {
        vm.startPrank(poster);
        _createMemoryAt(0, 0);
        _createMemoryAt(0, 1_000);
        _createMemoryAt(0, 2_000);
        _createMemoryAt(0, 3_000);
        vm.stopPrank();

        assertEq(karma.balanceOf(poster), 0);
    }

    function testRewardsThreeKarmaAtFiveConnectedMemories() public {
        vm.startPrank(poster);
        _createMemoryAt(0, 0);
        _createMemoryAt(0, 1_000);
        _createMemoryAt(0, 2_000);
        _createMemoryAt(0, 3_000);

        vm.expectEmit(true, false, true, true);
        emit KarmaRewarded(poster, 3 ether, 4, 5);
        _createMemoryAt(0, 4_000);
        vm.stopPrank();

        assertEq(karma.balanceOf(poster), 3 ether);
        assertEq(karma.totalSupply(), 3 ether);

        for (uint256 i = 0; i < 5; i++) {
            assertEq(registry.isRewardClaimed(i), true);
        }
    }

    function testDoesNotRewardFiveDisconnectedMemories() public {
        vm.startPrank(poster);
        _createMemoryAt(0, 0);
        _createMemoryAt(0, 10_000);
        _createMemoryAt(0, 20_000);
        _createMemoryAt(0, 30_000);
        _createMemoryAt(0, 40_000);
        vm.stopPrank();

        assertEq(karma.balanceOf(poster), 0);
    }

    function testSixthConnectedMemoryDoesNotDoubleCountClaimedMemories() public {
        vm.startPrank(poster);
        for (int32 i = 0; i < 6; i++) {
            _createMemoryAt(0, i * 1_000);
        }
        vm.stopPrank();

        assertEq(karma.balanceOf(poster), 3 ether);

        assertEq(registry.isRewardClaimed(5), false);
    }

    function testTenthConnectedMemoryCanTriggerSecondReward() public {
        vm.startPrank(poster);
        for (int32 i = 0; i < 10; i++) {
            _createMemoryAt(0, i * 1_000);
        }
        vm.stopPrank();

        assertEq(karma.balanceOf(poster), 6 ether);
        assertEq(karma.totalSupply(), 6 ether);
    }

    function _createMemoryAt(int32 latE6, int32 lngE6) private returns (uint256) {
        return registry.createMemory(metadataCid, metadataHash, latE6, lngE6);
    }
}
