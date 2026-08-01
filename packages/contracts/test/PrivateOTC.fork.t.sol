// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {PrivateOTC} from "../src/PrivateOTC.sol";
import {TradiNoxCToken} from "../src/tokens/TradiNoxCToken.sol";
import {IERC7984} from "../src/interfaces/IERC7984.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";

/// @notice Fork tests against Arbitrum Sepolia where NoxCompute is deployed.
/// @dev Run: forge test --fork-url $ARBITRUM_SEPOLIA_RPC_URL --match-contract Fork
///      Naming convention: test_<method>_<positive|negative|edge>_<scenario>.
///      The validateInputProof call from Nox.fromExternal is mocked because
///      legitimate proofs require off-chain Nox attestation signing — this is
///      the only signature gate we stub. Every other encrypted op (transfer,
///      mint, select, safeSub) hits the real precompile.
contract PrivateOTCForkTest is Test {
    PrivateOTC otc;
    TradiNoxCToken cusdc;
    TradiNoxCToken ceth;

    /// Resolved at runtime via Nox library — survives Nox redeploys.
    /// Cached after setUp() since tests re-mock against this address.
    address noxProxy;

    address maker = makeAddr("maker");
    address taker1 = makeAddr("taker1");
    address taker2 = makeAddr("taker2");
    address attacker = makeAddr("attacker");

    function setUp() public {
        // Skip if not running on Arbitrum Sepolia fork
        if (block.chainid != 421614) {
            vm.skip(true);
        }

        noxProxy = Nox.noxComputeContract();

        otc = new PrivateOTC();
        cusdc = new TradiNoxCToken("Confidential USDC", "cUSDC", 6);
        ceth = new TradiNoxCToken("Confidential ETH", "cETH", 18);

        // Mock the input-proof validator so any (handle, sender, proof, type)
        // tuple succeeds. This is the ONLY signature gate we stub.
        vm.mockCall(
            noxProxy,
            abi.encodeWithSelector(INoxCompute.validateInputProof.selector),
            abi.encode()
        );
    }

    /* ─────────────────────── TradiNoxCToken ─────────────────────── */

    function test_TradiNoxCTokenConstructor_positive_metadataMatchesArguments() public view {
        assertEq(cusdc.symbol(), "cUSDC");
        assertEq(cusdc.name(), "Confidential USDC");
        assertEq(cusdc.decimals(), 6);
        assertEq(ceth.symbol(), "cETH");
        assertEq(ceth.name(), "Confidential ETH");
        assertEq(ceth.decimals(), 18);
    }

    function test_TradiNoxCTokenConstructor_positive_initialBalanceIsUndefined() public view {
        // Uninitialized euint256 unwraps to bytes32(0) — handle is "undefined"
        // until first mint/transfer creates a real Nox handle.
        assertEq(cusdc.confidentialBalanceOf(maker), bytes32(0));
    }

    function test_setOperator_positive_authorizesUntilDeadline() public {
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(maker);
        cusdc.setOperator(address(otc), until);

        assertTrue(cusdc.isOperator(maker, address(otc)));
    }

    function test_setOperator_positive_emitsEvent() public {
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(maker);
        vm.expectEmit(true, true, false, true);
        emit IERC7984.OperatorSet(maker, address(otc), until);
        cusdc.setOperator(address(otc), until);
    }

    function test_setOperator_edge_expiresPastDeadline() public {
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(maker);
        cusdc.setOperator(address(otc), until);

        // Just before deadline → still authorized
        vm.warp(uint256(until) - 1);
        assertTrue(cusdc.isOperator(maker, address(otc)));

        // At deadline → expired (strict-greater check in isOperator)
        vm.warp(uint256(until));
        assertFalse(cusdc.isOperator(maker, address(otc)));

        // Past deadline → expired
        vm.warp(uint256(until) + 1);
        assertFalse(cusdc.isOperator(maker, address(otc)));
    }

    function test_setOperator_edge_zeroDeadlineNeverAuthorizes() public {
        // until=0 means "expired immediately" — useful for revoke pattern.
        vm.prank(maker);
        cusdc.setOperator(address(otc), 0);
        assertFalse(cusdc.isOperator(maker, address(otc)));
    }

    function test_faucet_positive_increasesBalanceHandle() public {
        bytes32 before_ = cusdc.confidentialBalanceOf(maker);
        assertEq(before_, bytes32(0)); // undefined initially

        // Hoist BEFORE prank: _makeExternalHandle calls NoxCompute and would
        // otherwise consume the prank, making faucet's msg.sender the test
        // contract instead of `maker`.
        externalEuint256 amountH = _makeExternalHandle(1000e6);
        vm.prank(maker);
        cusdc.faucet(amountH, "");

        bytes32 after_ = cusdc.confidentialBalanceOf(maker);
        // After mint, handle is no longer bytes32(0). It's a real Nox handle.
        assertTrue(after_ != bytes32(0));
    }

    function test_confidentialTransferFrom_negative_revertsWithoutOperator() public {
        // Mint maker's balance first
        vm.prank(maker);
        cusdc.faucet(_makeExternalHandle(1000e6), "");

        // Attacker tries to pull without operator authorization
        vm.prank(attacker);
        vm.expectRevert(bytes("TradiNoxCToken: not operator"));
        cusdc.confidentialTransferFrom(maker, taker1, bytes32(0));
    }

    function test_confidentialTransferFrom_negative_revertsAfterOperatorExpires() public {
        vm.prank(maker);
        cusdc.faucet(_makeExternalHandle(1000e6), "");

        uint48 until = uint48(block.timestamp + 100);
        vm.prank(maker);
        cusdc.setOperator(address(otc), until);

        // Warp past expiry
        vm.warp(uint256(until) + 1);

        vm.prank(address(otc));
        vm.expectRevert(bytes("TradiNoxCToken: not operator"));
        cusdc.confidentialTransferFrom(maker, taker1, bytes32(0));
    }

    /* ─────────────────────── PrivateOTC: createIntent ─────────────────────── */

    function test_createIntent_positive_emitsIntentCreatedAndIncrementsId() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);

        // Build handles before vm.expectEmit so Nox precompile events emit
        // first, then expectEmit matches only PrivateOTC's IntentCreated.
        externalEuint256 sellH = _makeExternalHandle(1e18);
        externalEuint256 buyH = _makeExternalHandle(3500e6);

        vm.expectEmit(true, true, false, true, address(otc));
        emit PrivateOTC.IntentCreated(
            0, maker, address(ceth), address(cusdc), PrivateOTC.Mode.Direct, deadline
        );

        vm.prank(maker);
        uint256 id = otc.createIntent(ceth, cusdc, sellH, "", buyH, "", deadline, address(0));

        assertEq(id, 0);
        assertEq(otc.nextIntentId(), 1);

        assertEq(_intentMaker(id), maker);
        assertEq(address(_intentSellToken(id)), address(ceth));
        assertEq(address(_intentBuyToken(id)), address(cusdc));
        assertEq(_intentDeadline(id), deadline);
        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.Open);
        assertTrue(_intentMode(id) == PrivateOTC.Mode.Direct);
        assertEq(_intentAllowedTaker(id), address(0));
    }

    function test_createIntent_positive_locksToAllowedTaker() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createIntent(
            ceth, cusdc,
            _makeExternalHandle(1e18), "",
            _makeExternalHandle(3500e6), "",
            deadline,
            taker1
        );
        assertEq(_intentAllowedTaker(id), taker1);
    }

    /* ─────────────────────── PrivateOTC: cancelIntent ─────────────────────── */

    function test_cancelIntent_positive_marksCancelledAndEmits() public {
        uint256 id = _createDirectIntentAsMaker(1 hours);

        vm.expectEmit(true, false, false, true, address(otc));
        emit PrivateOTC.Cancelled(id);
        vm.prank(maker);
        otc.cancelIntent(id);

        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.Cancelled);
    }

    function test_cancelIntent_negative_revertsIfAlreadyCancelled() public {
        uint256 id = _createDirectIntentAsMaker(1 hours);
        vm.prank(maker);
        otc.cancelIntent(id);

        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        vm.prank(maker);
        otc.cancelIntent(id);
    }

    /* ─────────────────────── PrivateOTC: acceptIntent ─────────────────────── */

    function test_acceptIntent_negative_revertsIfDeadlinePassed() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createIntent(
            ceth, cusdc,
            _makeExternalHandle(1e18), "",
            _makeExternalHandle(3500e6), "",
            deadline,
            address(0)
        );

        // Hoist the buy handle BEFORE expectRevert — _makeExternalHandle calls
        // Nox.toEuint256 (an external precompile call) which would otherwise
        // consume the expectRevert assertion.
        externalEuint256 buyH = _makeExternalHandle(3500e6);
        vm.warp(uint256(deadline) + 1);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        vm.prank(taker1);
        otc.acceptIntent(id, buyH, "");
    }

    function test_acceptIntent_negative_revertsIfNotAllowedTaker() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createIntent(
            ceth, cusdc,
            _makeExternalHandle(1e18), "",
            _makeExternalHandle(3500e6), "",
            deadline,
            taker1 // restrict
        );

        externalEuint256 buyH = _makeExternalHandle(3500e6);
        vm.expectRevert(PrivateOTC.NotAllowedTaker.selector);
        vm.prank(attacker);
        otc.acceptIntent(id, buyH, "");
    }

    function test_acceptIntent_negative_revertsIfRFQModeIntent() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createRFQ(
            ceth, cusdc,
            _makeExternalHandle(1e18), "",
            deadline
        );

        externalEuint256 buyH = _makeExternalHandle(3500e6);
        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        vm.prank(taker1);
        otc.acceptIntent(id, buyH, "");
    }

    /* ─────────────────────── PrivateOTC: createRFQ ─────────────────────── */

    function test_createRFQ_positive_marksRFQModeAndEmits() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);

        externalEuint256 sellH = _makeExternalHandle(1e18);

        vm.expectEmit(true, true, false, true, address(otc));
        emit PrivateOTC.IntentCreated(
            0, maker, address(ceth), address(cusdc), PrivateOTC.Mode.RFQ, deadline
        );

        vm.prank(maker);
        uint256 id = otc.createRFQ(ceth, cusdc, sellH, "", deadline);

        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.Open);
        assertTrue(_intentMode(id) == PrivateOTC.Mode.RFQ);
        assertEq(_intentAllowedTaker(id), address(0));
    }

    /* ─────────────────────── PrivateOTC: submitBid ─────────────────────── */

    function test_submitBid_positive_emitsAndAppendsBid() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createRFQ(ceth, cusdc, _makeExternalHandle(1e18), "", deadline);

        externalEuint256 bidH = _makeExternalHandle(3500e6);

        vm.expectEmit(true, true, false, true, address(otc));
        emit PrivateOTC.BidSubmitted(id, taker1);

        vm.prank(taker1);
        otc.submitBid(id, bidH, "");

        (address bidTaker,, bool active) = otc.bids(id, 0);
        assertEq(bidTaker, taker1);
        assertTrue(active);
    }

    function test_submitBid_negative_revertsIfDeadlinePassed() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createRFQ(ceth, cusdc, _makeExternalHandle(1e18), "", deadline);

        externalEuint256 bidH = _makeExternalHandle(3500e6);
        vm.warp(uint256(deadline) + 1);
        vm.expectRevert(PrivateOTC.DeadlinePassed.selector);
        vm.prank(taker1);
        otc.submitBid(id, bidH, "");
    }

    function test_submitBid_negative_revertsIfDirectModeIntent() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createIntent(
            ceth, cusdc,
            _makeExternalHandle(1e18), "",
            _makeExternalHandle(3500e6), "",
            deadline,
            address(0)
        );

        externalEuint256 bidH = _makeExternalHandle(3500e6);
        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        vm.prank(taker1);
        otc.submitBid(id, bidH, "");
    }

    function test_submitBid_edge_revertsAtMaxBidsBoundary() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createRFQ(ceth, cusdc, _makeExternalHandle(1e18), "", deadline);

        uint256 maxBids = otc.MAX_BIDS_PER_RFQ();
        for (uint256 i = 0; i < maxBids; i++) {
            address bidder = makeAddr(string.concat("bidder", vm.toString(i)));
            vm.prank(bidder);
            otc.submitBid(id, _makeExternalHandle(3500e6 + i * 1e6), "");
        }

        // The (maxBids+1)th submission must revert.
        externalEuint256 overflowH = _makeExternalHandle(9999e6);
        vm.expectRevert(PrivateOTC.MaxBidsReached.selector);
        vm.prank(makeAddr("bidder-overflow"));
        otc.submitBid(id, overflowH, "");
    }

    /* ─────────────────────── PrivateOTC: finalizeRFQ ─────────────────────── */

    function test_finalizeRFQ_negative_revertsIfDeadlineNotPassed() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createRFQ(ceth, cusdc, _makeExternalHandle(1e18), "", deadline);

        // Deadline still in the future
        vm.expectRevert(PrivateOTC.DeadlineNotPassed.selector);
        otc.finalizeRFQ(id);
    }

    function test_finalizeRFQ_negative_revertsOnInsufficientBids() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createRFQ(ceth, cusdc, _makeExternalHandle(1e18), "", deadline);

        vm.prank(taker1);
        otc.submitBid(id, _makeExternalHandle(3500e6), "");

        vm.warp(uint256(deadline) + 1);
        vm.expectRevert(PrivateOTC.InsufficientBids.selector);
        otc.finalizeRFQ(id);
    }

    function test_finalizeRFQ_negative_revertsIfDirectModeIntent() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        vm.prank(maker);
        uint256 id = otc.createIntent(
            ceth, cusdc,
            _makeExternalHandle(1e18), "",
            _makeExternalHandle(3500e6), "",
            deadline,
            address(0)
        );

        vm.warp(uint256(deadline) + 1);
        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        otc.finalizeRFQ(id);
    }

    /* ─────────────── Strategy B: end-to-end settlement ─────────────── */

    /// @dev Mint balances for both parties + grant operator so settlement can run.
    function _stockBalancesAndOperators() internal {
        externalEuint256 makerSellH = _makeExternalHandle(10e18);
        externalEuint256 takerBuyH = _makeExternalHandle(50_000e6);

        // Maker mints sellToken (cETH) to themselves
        vm.prank(maker);
        ceth.faucet(makerSellH, "");
        // Taker mints buyToken (cUSDC) to themselves
        vm.prank(taker1);
        cusdc.faucet(takerBuyH, "");

        // Both grant OTC operator so confidentialTransferFrom works.
        uint48 until = uint48(block.timestamp + 2 hours);
        vm.prank(maker);
        ceth.setOperator(address(otc), until);
        vm.prank(taker1);
        cusdc.setOperator(address(otc), until);
    }

    function test_acceptIntent_strategyB_positive_sufficientBidEmitsSettledAndMarksFilled() public {
        _stockBalancesAndOperators();

        uint256 id = _createDirectIntentAsMaker(1 hours);

        // Bid >= minBuy (3500e6) → real settle.
        externalEuint256 buyH = _makeExternalHandle(4000e6);

        vm.expectEmit(true, true, false, true, address(otc));
        emit PrivateOTC.Settled(id, taker1);

        vm.prank(taker1);
        otc.acceptIntent(id, buyH, "");

        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.Filled);

        // Both parties' balance handles must be non-zero (real handles after settle).
        assertTrue(ceth.confidentialBalanceOf(taker1) != bytes32(0));
        assertTrue(cusdc.confidentialBalanceOf(maker) != bytes32(0));
    }

    function test_acceptIntent_strategyB_edge_insufficientBidStillEmitsSettledAndMarksFilled() public {
        // PRIVACY GUARANTEE: from the outside, a sub-min bid is INDISTINGUISHABLE
        // from a successful one — same Settled event, same Filled status. The
        // contract uses Nox.safeSub + Nox.select to route real amounts on success
        // and zeros on failure, so the rejection never leaks via revert.
        _stockBalancesAndOperators();

        uint256 id = _createDirectIntentAsMaker(1 hours);

        // Bid = 0 << minBuy (3500e6) → encrypted no-op via select.
        externalEuint256 zeroBuyH = _makeExternalHandle(0);

        vm.expectEmit(true, true, false, true, address(otc));
        emit PrivateOTC.Settled(id, taker1);

        vm.prank(taker1);
        otc.acceptIntent(id, zeroBuyH, "");

        // Status must be Filled — the on-chain audit trail is identical.
        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.Filled);
    }

    function test_acceptIntent_strategyB_negative_doubleAcceptReverts() public {
        _stockBalancesAndOperators();
        uint256 id = _createDirectIntentAsMaker(1 hours);

        externalEuint256 buyH1 = _makeExternalHandle(4000e6);
        vm.prank(taker1);
        otc.acceptIntent(id, buyH1, "");

        // Second accept: status is now Filled.
        externalEuint256 buyH2 = _makeExternalHandle(5000e6);
        vm.expectRevert(PrivateOTC.IntentNotOpen.selector);
        vm.prank(taker2);
        otc.acceptIntent(id, buyH2, "");
    }

    /* ─────────────── Vickrey: fuzz tests for _pickVickreyWinner ─────────────── */

    /// @dev Fuzz: finalizeRFQ must succeed for any valid bid count [2..MAX].
    /// Now transitions to PendingReveal (not Filled — that's revealRFQWinner's job).
    function testFuzz_finalizeRFQ_neverCrashesForValidBidCounts(uint8 bidCount) public {
        bidCount = uint8(bound(uint256(bidCount), 2, otc.MAX_BIDS_PER_RFQ()));

        _stockBalancesAndOperators();
        (uint256 id, uint64 deadline) = _createRFQAsMaker(1 hours);

        for (uint256 i = 0; i < bidCount; i++) {
            address bidder = makeAddr(string.concat("bidder", vm.toString(i)));
            externalEuint256 stockH = _makeExternalHandle(100_000e6);
            vm.prank(bidder);
            cusdc.faucet(stockH, "");
            vm.prank(bidder);
            cusdc.setOperator(address(otc), uint48(block.timestamp + 2 hours));

            externalEuint256 bidH = _makeExternalHandle(1000e6 + i * 100e6);
            vm.prank(bidder);
            otc.submitBid(id, bidH, "");
        }

        vm.warp(uint256(deadline) + 1);
        otc.finalizeRFQ(id);

        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.PendingReveal);
    }

    /// @dev Fuzz: revealRFQWinner settles correctly for any valid winner index.
    /// Maker picks any bidder index — the encrypted price is unchanged.
    function testFuzz_revealRFQWinner_settlesToPickedBidder(uint256 seed) public {
        _stockBalancesAndOperators();
        (uint256 id, uint64 deadline) = _createRFQAsMaker(1 hours);

        uint256 bidCount = (seed % 9) + 2; // 2..10
        address[] memory bidders = new address[](bidCount);

        for (uint256 i = 0; i < bidCount; i++) {
            address bidder = makeAddr(string.concat("seedBidder", vm.toString(i)));
            bidders[i] = bidder;

            externalEuint256 stockH = _makeExternalHandle(100_000e6);
            vm.prank(bidder);
            cusdc.faucet(stockH, "");
            vm.prank(bidder);
            cusdc.setOperator(address(otc), uint48(block.timestamp + 2 hours));

            externalEuint256 bidH = _makeExternalHandle(1e9 + (uint256(keccak256(abi.encode(seed, i))) % 1e10));
            vm.prank(bidder);
            otc.submitBid(id, bidH, "");
        }

        vm.warp(uint256(deadline) + 1);
        otc.finalizeRFQ(id);
        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.PendingReveal);

        uint256 chosenIdx = seed % bidCount;
        address expectedWinner = bidders[chosenIdx];

        vm.recordLogs();
        vm.prank(maker);
        otc.revealRFQWinner(id, chosenIdx);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 settledTopic = keccak256("Settled(uint256,address)");
        address loggedWinner = address(0);
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == settledTopic
                && logs[i].emitter == address(otc)) {
                loggedWinner = address(uint160(uint256(logs[i].topics[2])));
                break;
            }
        }
        assertEq(loggedWinner, expectedWinner, "Settled event has wrong winner");
        assertTrue(_intentStatus(id) == PrivateOTC.IntentStatus.Filled);
    }

    function test_revealRFQWinner_negative_revertsForNonMaker() public {
        _stockBalancesAndOperators();
        (uint256 id, uint64 deadline) = _createRFQAsMaker(1 hours);

        for (uint256 i = 0; i < 3; i++) {
            address bidder = makeAddr(string.concat("bidder", vm.toString(i)));
            externalEuint256 stockH = _makeExternalHandle(100_000e6);
            vm.prank(bidder);
            cusdc.faucet(stockH, "");
            vm.prank(bidder);
            cusdc.setOperator(address(otc), uint48(block.timestamp + 2 hours));
            externalEuint256 bidH = _makeExternalHandle(1000e6 + i * 100e6);
            vm.prank(bidder);
            otc.submitBid(id, bidH, "");
        }

        vm.warp(uint256(deadline) + 1);
        otc.finalizeRFQ(id);

        vm.expectRevert(PrivateOTC.NotMaker.selector);
        vm.prank(attacker);
        otc.revealRFQWinner(id, 0);
    }

    function test_revealRFQWinner_negative_revertsOnInvalidIndex() public {
        _stockBalancesAndOperators();
        (uint256 id, uint64 deadline) = _createRFQAsMaker(1 hours);

        for (uint256 i = 0; i < 3; i++) {
            address bidder = makeAddr(string.concat("bidder", vm.toString(i)));
            externalEuint256 stockH = _makeExternalHandle(100_000e6);
            vm.prank(bidder);
            cusdc.faucet(stockH, "");
            vm.prank(bidder);
            cusdc.setOperator(address(otc), uint48(block.timestamp + 2 hours));
            externalEuint256 bidH = _makeExternalHandle(1000e6 + i * 100e6);
            vm.prank(bidder);
            otc.submitBid(id, bidH, "");
        }

        vm.warp(uint256(deadline) + 1);
        otc.finalizeRFQ(id);

        vm.expectRevert(PrivateOTC.InvalidWinnerIndex.selector);
        vm.prank(maker);
        otc.revealRFQWinner(id, 99);
    }

    function test_revealRFQWinner_negative_revertsBeforeFinalize() public {
        _stockBalancesAndOperators();
        (uint256 id,) = _createRFQAsMaker(1 hours);

        // Status is still Open — not yet finalized.
        vm.expectRevert(PrivateOTC.NotPendingReveal.selector);
        vm.prank(maker);
        otc.revealRFQWinner(id, 0);
    }

    /* ─────────────── Real Nox proof: rejection path (no mock) ─────────────── */

    function test_fromExternal_negative_revertsOnInvalidProofWithoutMock() public {
        // Clear the validateInputProof mock — let real Nox precompile run.
        vm.clearMockedCalls();

        externalEuint256 fakeHandle = externalEuint256.wrap(bytes32(uint256(0xDEADBEEF)));
        bytes memory fakeProof = hex"00010203";

        // Real Nox should reject this. Don't pin the exact selector — Nox can
        // revert with any of: InvalidProof, UnauthorizedSender, NotAllowed,
        // and the message can change between releases.
        vm.expectRevert();
        vm.prank(maker);
        otc.createIntent(
            ceth, cusdc,
            fakeHandle, fakeProof,
            fakeHandle, fakeProof,
            uint64(block.timestamp + 1 hours),
            address(0)
        );
    }

    /* ─────────────────────── helpers ─────────────────────── */

    /// @dev Build a real Nox public handle (via toEuint256), then cast to
    /// externalEuint256 so it can be passed to fromExternal. The mocked
    /// validateInputProof accepts any handle/proof tuple.
    function _makeExternalHandle(uint256 value) internal returns (externalEuint256) {
        euint256 e = Nox.toEuint256(value);
        return externalEuint256.wrap(euint256.unwrap(e));
    }

    /// @dev Helper that creates a Direct intent properly pranked as `maker`.
    /// Critical: handles MUST be built before vm.prank, otherwise the inner
    /// NoxCompute call from toEuint256 consumes the prank and createIntent
    /// runs with the test contract as msg.sender.
    function _createDirectIntentAsMaker(uint64 ttl) internal returns (uint256 id) {
        externalEuint256 sellH = _makeExternalHandle(1e18);
        externalEuint256 buyH = _makeExternalHandle(3500e6);
        uint64 deadline = uint64(block.timestamp + ttl);
        vm.prank(maker);
        id = otc.createIntent(ceth, cusdc, sellH, "", buyH, "", deadline, address(0));
    }

    function _createRFQAsMaker(uint64 ttl) internal returns (uint256 id, uint64 deadline) {
        externalEuint256 sellH = _makeExternalHandle(1e18);
        deadline = uint64(block.timestamp + ttl);
        vm.prank(maker);
        id = otc.createRFQ(ceth, cusdc, sellH, "", deadline);
    }

    // Field extractors — Solidity's auto-getter returns 9 components in struct
    // declaration order. Counting empty-slot commas was error-prone, so each
    // field gets its own typed accessor.

    // Intent struct now has 10 fields (priceToPay added for 2-step RFQ).
    function _intentMaker(uint256 id) internal view returns (address mk) {
        (mk,,,,,,,,,) = otc.intents(id);
    }

    function _intentSellToken(uint256 id) internal view returns (IERC7984 t) {
        (, t,,,,,,,,) = otc.intents(id);
    }

    function _intentBuyToken(uint256 id) internal view returns (IERC7984 t) {
        (,, t,,,,,,,) = otc.intents(id);
    }

    function _intentDeadline(uint256 id) internal view returns (uint64 d) {
        (,,,,, d,,,,) = otc.intents(id);
    }

    function _intentStatus(uint256 id) internal view returns (PrivateOTC.IntentStatus s) {
        (,,,,,, s,,,) = otc.intents(id);
    }

    function _intentMode(uint256 id) internal view returns (PrivateOTC.Mode m) {
        (,,,,,,, m,,) = otc.intents(id);
    }

    function _intentAllowedTaker(uint256 id) internal view returns (address a) {
        (,,,,,,,, a,) = otc.intents(id);
    }
}
