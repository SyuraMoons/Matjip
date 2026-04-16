// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MemoryRegistry} from "../src/MemoryRegistry.sol";

contract MatjipMemoryMapScript is Script {
    function run() external {
        vm.startBroadcast();
        MemoryRegistry registry = new MemoryRegistry();
        vm.stopBroadcast();

        console2.log("MemoryRegistry deployed to:", address(registry));
    }
}
