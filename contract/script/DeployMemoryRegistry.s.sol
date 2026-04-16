// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {MemoryRegistry} from "../src/MemoryRegistry.sol";

contract DeployMemoryRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        MemoryRegistry registry = new MemoryRegistry();
        vm.stopBroadcast();

        console2.log("MemoryRegistry deployed to:", address(registry));
    }
}
