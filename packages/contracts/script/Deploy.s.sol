// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Script, console} from "forge-std/Script.sol";
import {PrivateOTC} from "../src/PrivateOTC.sol";
import {TradiNoxCToken} from "../src/tokens/TradiNoxCToken.sol";

/// @notice Deploy PrivateOTC + TradiNoxCTokens (cUSDC, cETH) to Arbitrum Sepolia.
contract Deploy is Script {
    function run() external returns (PrivateOTC otc, TradiNoxCToken cusdc, TradiNoxCToken ceth) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        otc = new PrivateOTC();
        cusdc = new TradiNoxCToken("Confidential USDC", "cUSDC", 6);
        ceth = new TradiNoxCToken("Confidential ETH", "cETH", 18);

        vm.stopBroadcast();

        console.log("PrivateOTC :", address(otc));
        console.log("cUSDC      :", address(cusdc));
        console.log("cETH       :", address(ceth));
        console.log("");
        console.log("Add to .env:");
        console.log("  NEXT_PUBLIC_PRIVATE_OTC_ADDRESS=", address(otc));
        console.log("  NEXT_PUBLIC_CUSDC_ADDRESS=", address(cusdc));
        console.log("  NEXT_PUBLIC_CETH_ADDRESS=", address(ceth));
    }
}
