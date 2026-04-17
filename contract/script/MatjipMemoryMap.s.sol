// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MemoryRegistry} from "../src/MemoryRegistry.sol";
import {MockKarma} from "../src/MockKarma.sol";

contract MatjipMemoryMapScript is Script {
    function run() external {
        vm.startBroadcast();
        MockKarma karma = new MockKarma();
        MemoryRegistry registry = new MemoryRegistry(karma);
        karma.setMinter(address(registry));
        vm.stopBroadcast();

        console2.log("MockKarma deployed to:", address(karma));
        console2.log("MemoryRegistry deployed to:", address(registry));
    }
}
