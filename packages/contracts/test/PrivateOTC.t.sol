// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {PrivateOTC} from "../src/PrivateOTC.sol";
import {IERC7984} from "../src/interfaces/IERC7984.sol";
import {externalEuint256} from "encrypted-types/EncryptedTypes.sol";

/// @notice Local-only PrivateOTC tests (no Nox dependency)
/// @dev Naming convention: test_<method>_<positive|negative|edge>_<scenario>
///      Mirrors describe(method) → describe(positive/negative/edge) → test().
///      TradiNoxCToken + Nox-using flows live in PrivateOTC.fork.t.sol — those
///      need `--fork-url $ARBITRUM_SEPOLIA_RPC_URL` since NoxCompute proxy
///      only exists on chains 421614/42161.
contract PrivateOTCTest is Test {
    PrivateOTC otc;

    address maker = makeAddr("maker");
    address taker1 = makeAddr("taker1");
    address attacker = makeAddr("attacker");

    // Dummy token addresses — never invoked locally because reverts fire
    // before any token interaction or Nox.fromExternal call.
    IERC7984 sellTok = IERC7984(makeAddr("sellTok"));
    IERC7984 buyTok = IERC7984(makeAddr("buyTok"));

    externalEuint256 constant ZERO_HANDLE = externalEuint256.wrap(bytes32(0));

    function setUp() public {
        otc = new PrivateOTC();
        // Anchor block.timestamp so deadline arithmetic is deterministic.
        vm.warp(1_700_000_000);
    }

    /* ───────────────── constructor / initial state ───────────────── */

    function test_constructor_positive_nextIntentIdStartsAtZero() public view {
        assertEq(otc.nextIntentId(), 0);
    }

    function test_constructor_positive_maxBidsConstantIsTen() public view {
        assertEq(otc.MAX_BIDS_PER_RFQ(), 10);
    }

    /* ───────────────── createIntent ───────────────── */

    function test_createIntent_negative_revertsIfDeadlineInPast() public {
        uint64 pastDeadline = uint64(block.timestamp - 1);
        vm.prank(maker);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        otc.createIntent(sellTok, buyTok, ZERO_HANDLE, "", ZERO_HANDLE, "", pastDeadline, address(0));
    }

    function test_createIntent_edge_revertsAtExactDeadlineBoundary() public {
        // deadline == block.timestamp must revert (strictly-less guard).
        uint64 nowDeadline = uint64(block.timestamp);
        vm.prank(maker);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        otc.createIntent(sellTok, buyTok, ZERO_HANDLE, "", ZERO_HANDLE, "", nowDeadline, address(0));
    }

    function test_createIntent_negative_revertsAtZeroDeadline() public {
        // deadline=0 is the trivial-past case; covers default-storage trap.
        vm.prank(maker);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        otc.createIntent(sellTok, buyTok, ZERO_HANDLE, "", ZERO_HANDLE, "", 0, address(0));
    }

    /* ───────────────── createRFQ ───────────────── */

    function test_createRFQ_negative_revertsIfDeadlineInPast() public {
        uint64 pastDeadline = uint64(block.timestamp - 1);
        vm.prank(maker);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        otc.createRFQ(sellTok, buyTok, ZERO_HANDLE, "", pastDeadline);
    }

    function test_createRFQ_edge_revertsAtExactDeadlineBoundary() public {
        uint64 nowDeadline = uint64(block.timestamp);
        vm.prank(maker);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        otc.createRFQ(sellTok, buyTok, ZERO_HANDLE, "", nowDeadline);
    }

    /* ───────────────── acceptIntent ───────────────── */

    function test_acceptIntent_negative_revertsIfIntentNonexistent() public {
        // Default-storage intent[0]: status=Open, mode=Direct, deadline=0.
        // First failing-state check is deadline → DeadlinePassed.
        vm.prank(taker1);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        otc.acceptIntent(0, ZERO_HANDLE, "");
    }

    /* ───────────────── submitBid ───────────────── */

    function test_submitBid_negative_revertsIfIntentNotRFQMode() public {
        // Default-storage intent[0]: status=Open, mode=Direct → IntentNotOpen
        // (mode mismatch reverts with same selector by design).
        vm.prank(taker1);
        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        otc.submitBid(0, ZERO_HANDLE, "");
    }

    /* ───────────────── cancelIntent ───────────────── */

    function test_cancelIntent_negative_revertsIfNotMaker() public {
        // Default-storage intent[0]: maker=address(0). Any non-zero caller
        // triggers NotMaker before the status check.
        vm.prank(attacker);
        vm.expectRevert(PrivateOTC.NotMaker.selector);
        otc.cancelIntent(0);
    }

    function test_cancelIntent_edge_revertsForArbitraryHighIntentId() public {
        // Exotic id (storage default at any slot) still rejects on NotMaker.
        vm.prank(attacker);
        vm.expectRevert(PrivateOTC.NotMaker.selector);
        otc.cancelIntent(type(uint256).max);
    }

    /* ───────────────── finalizeRFQ ───────────────── */

    function test_finalizeRFQ_negative_revertsIfNotRFQMode() public {
        // Default-storage intent[0] has Mode.Direct → IntentNotOpen.
        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        otc.finalizeRFQ(0);
    }
}
