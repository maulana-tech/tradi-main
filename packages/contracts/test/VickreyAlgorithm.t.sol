// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";

/// @notice Pure-uint256 mirror of PrivateOTC._pickVickreyWinner's
///         price-tracking loop, used to verify the algorithm is correct.
///
/// The on-chain version replaces:
///   - uint256 → euint256
///   - `>` → Nox.gt
///   - ternary `cond ? a : b` → Nox.select(cond, a, b)
///
/// The encrypted version mirrors this loop line-by-line. Verifying the plain
/// version + visual code-review of the encrypted version proves correctness
/// without requiring proof signatures from the Nox gateway.
///
/// IMPORTANT: this mirror caught a Vickrey bug in the original contract —
/// the naive `second = isHigher ? highest : second` lost bids that fell
/// between current second and current highest. Both the contract and this
/// mirror now use the corrected three-case formula.
contract VickreyMirror {
    /// @dev Returns (highest, secondHighest) for an array of bids of length >= 2.
    function pickTopTwo(uint256[] memory bids)
        external
        pure
        returns (uint256 highest, uint256 second)
    {
        require(bids.length >= 2, "need >=2 bids");

        // Initial 2-bid state — same as `Nox.gt + Nox.select` pair on bids[0..1]
        bool initSwap = bids[1] > bids[0];
        highest = initSwap ? bids[1] : bids[0];
        second = initSwap ? bids[0] : bids[1];

        for (uint256 i = 2; i < bids.length; i++) {
            uint256 candidate = bids[i];
            bool isHigher = candidate > highest;
            bool isMiddle = candidate > second;

            uint256 newSecondIfNotHigher = isMiddle ? candidate : second;
            second = isHigher ? highest : newSecondIfNotHigher;
            highest = isHigher ? candidate : highest;
        }
    }
}

contract VickreyAlgorithmTest is Test {
    VickreyMirror lib;

    function setUp() public {
        lib = new VickreyMirror();
    }

    /* ─────────────────── pickTopTwo: positive cases ─────────────────── */

    function test_pickTopTwo_positive_twoBidsOrderedAscending() public view {
        uint256[] memory bids = new uint256[](2);
        bids[0] = 100;
        bids[1] = 200;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 200);
        assertEq(sec, 100);
    }

    function test_pickTopTwo_positive_twoBidsOrderedDescending() public view {
        uint256[] memory bids = new uint256[](2);
        bids[0] = 200;
        bids[1] = 100;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 200);
        assertEq(sec, 100);
    }

    function test_pickTopTwo_positive_threeBidsHighestLast() public view {
        uint256[] memory bids = new uint256[](3);
        bids[0] = 100;
        bids[1] = 200;
        bids[2] = 300;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 300);
        assertEq(sec, 200);
    }

    function test_pickTopTwo_positive_threeBidsHighestMiddle() public view {
        // Tests the middle-case fix: bid 200 should become second-highest
        // even though 300 was already established as highest.
        uint256[] memory bids = new uint256[](3);
        bids[0] = 100;
        bids[1] = 300;
        bids[2] = 200;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 300);
        assertEq(sec, 200);
    }

    function test_pickTopTwo_positive_threeBidsHighestFirst() public view {
        uint256[] memory bids = new uint256[](3);
        bids[0] = 300;
        bids[1] = 200;
        bids[2] = 100;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 300);
        assertEq(sec, 200);
    }

    function test_pickTopTwo_positive_tenBidsRandomOrder() public view {
        uint256[] memory bids = new uint256[](10);
        bids[0] = 50;
        bids[1] = 30;
        bids[2] = 90; // highest at index 2
        bids[3] = 10;
        bids[4] = 70;
        bids[5] = 20;
        bids[6] = 60;
        bids[7] = 40;
        bids[8] = 80; // 2nd highest at index 8
        bids[9] = 5;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 90);
        assertEq(sec, 80);
    }

    /* ─────────────────── pickTopTwo: edge cases ─────────────────── */

    function test_pickTopTwo_edge_tiedHighestKeepsBothInTopTwo() public view {
        // When two bidders tie for highest, second-highest equals the tied amount.
        uint256[] memory bids = new uint256[](3);
        bids[0] = 100;
        bids[1] = 100;
        bids[2] = 50;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 100);
        // Tie: bids[1] is not strictly > bids[0], so initSwap=false. Second
        // remains bids[1]=100 (the second slot). Documented behavior.
        assertEq(sec, 100);
    }

    function test_pickTopTwo_edge_allEqualBids() public view {
        uint256[] memory bids = new uint256[](5);
        bids[0] = 42;
        bids[1] = 42;
        bids[2] = 42;
        bids[3] = 42;
        bids[4] = 42;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 42);
        assertEq(sec, 42);
    }

    function test_pickTopTwo_edge_zeroBids() public view {
        uint256[] memory bids = new uint256[](2);
        bids[0] = 0;
        bids[1] = 0;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, 0);
        assertEq(sec, 0);
    }

    function test_pickTopTwo_edge_uint256MaxBoundary() public view {
        uint256[] memory bids = new uint256[](2);
        bids[0] = type(uint256).max;
        bids[1] = type(uint256).max - 1;
        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);
        assertEq(hi, type(uint256).max);
        assertEq(sec, type(uint256).max - 1);
    }

    /* ─────────────────── pickTopTwo: negative cases ─────────────────── */

    function test_pickTopTwo_negative_revertsOnZeroBids() public {
        uint256[] memory bids = new uint256[](0);
        vm.expectRevert("need >=2 bids");
        lib.pickTopTwo(bids);
    }

    function test_pickTopTwo_negative_revertsOnSingleBid() public {
        uint256[] memory bids = new uint256[](1);
        bids[0] = 100;
        vm.expectRevert("need >=2 bids");
        lib.pickTopTwo(bids);
    }

    /* ─────────────────── pickTopTwo: fuzz ─────────────────── */

    /// @dev Fuzz: highest and second are always within the bid set, and
    /// highest >= second always.
    function testFuzz_pickTopTwo_topTwoAreInSetAndOrdered(uint256[] memory bids) public view {
        vm.assume(bids.length >= 2 && bids.length <= 10);

        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);

        assertGe(hi, sec, "highest >= second");

        bool foundHi = false;
        bool foundSec = false;
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i] == hi) foundHi = true;
            if (bids[i] == sec) foundSec = true;
        }
        assertTrue(foundHi, "highest is in bid set");
        assertTrue(foundSec, "second is in bid set");
    }

    /// @dev Fuzz: highest matches the maximum of the bid set.
    function testFuzz_pickTopTwo_highestEqualsMax(uint256[] memory bids) public view {
        vm.assume(bids.length >= 2 && bids.length <= 10);

        (uint256 hi, ) = lib.pickTopTwo(bids);

        uint256 expectedMax = bids[0];
        for (uint256 i = 1; i < bids.length; i++) {
            if (bids[i] > expectedMax) expectedMax = bids[i];
        }
        assertEq(hi, expectedMax);
    }

    /// @dev Fuzz: when bids are unique, the second-highest is the
    /// strict second-largest value.
    function testFuzz_pickTopTwo_uniqueBidsYieldStrictSecondMax(uint256 a, uint256 b, uint256 c) public view {
        vm.assume(a != b && b != c && a != c);

        uint256[] memory bids = new uint256[](3);
        bids[0] = a;
        bids[1] = b;
        bids[2] = c;

        (uint256 hi, uint256 sec) = lib.pickTopTwo(bids);

        // Compute expected via sorted descent
        uint256 expectedHi = a > b ? (a > c ? a : c) : (b > c ? b : c);
        uint256 expectedSec;
        if (expectedHi == a) expectedSec = b > c ? b : c;
        else if (expectedHi == b) expectedSec = a > c ? a : c;
        else expectedSec = a > b ? a : b;

        assertEq(hi, expectedHi);
        assertEq(sec, expectedSec);
    }
}
