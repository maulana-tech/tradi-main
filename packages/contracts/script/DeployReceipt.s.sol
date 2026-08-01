// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Script, console} from "forge-std/Script.sol";
import {TradiNoxReceipt} from "../src/TradiNoxReceipt.sol";

/// @notice Standalone deploy for TradiNoxReceipt — keeps the existing
/// PrivateOTC + cToken deployment untouched.
contract DeployReceipt is Script {
    function run() external returns (TradiNoxReceipt receipt) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        receipt = new TradiNoxReceipt();
        vm.stopBroadcast();

        console.log("TradiNoxReceipt :", address(receipt));
        console.log("");
        console.log("Add to .env:");
        console.log("  NEXT_PUBLIC_TRADI_NOX_RECEIPT_ADDRESS=", address(receipt));
    }
}
