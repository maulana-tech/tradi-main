// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {PrivateOTC} from "../src/PrivateOTC.sol";
import {TradiNoxCToken} from "../src/tokens/TradiNoxCToken.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";

/// @notice Stateful invariant tests for PrivateOTC against actual state changes.
///
/// Run: forge test --fork-url $ARBITRUM_SEPOLIA_RPC_URL --match-contract PrivateOTCInvariantForkTest
///
/// Foundry randomly drives a Handler that creates intents/RFQs/bids/cancels,
/// then checks invariants after each step. Critically, this version actually
/// MUTATES state (vs the local-only version which only saw nextIntentId=0
/// throughout because every random call reverted).
///
/// Naming: invariant_<property> (Foundry convention).
contract PrivateOTCInvariantForkTest is Test {
    PrivateOTC otc;
    TradiNoxCToken cusdc;
    TradiNoxCToken ceth;
    Handler handler;

    function setUp() public {
        if (block.chainid != 421614) vm.skip(true);

        otc = new PrivateOTC();
        cusdc = new TradiNoxCToken("Confidential USDC", "cUSDC", 6);
        ceth = new TradiNoxCToken("Confidential ETH", "cETH", 18);

        // Mock validateInputProof so handles built via Nox.toEuint256 pass.
        vm.mockCall(
            Nox.noxComputeContract(),
            abi.encodeWithSelector(INoxCompute.validateInputProof.selector),
            abi.encode()
        );

        handler = new Handler(otc, cusdc, ceth);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = Handler.tryCreateIntent.selector;
        selectors[1] = Handler.tryCreateRFQ.selector;
        selectors[2] = Handler.tryCancelIntent.selector;
        selectors[3] = Handler.trySubmitBid.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @dev nextIntentId must equal the count of successful create operations.
    /// Catches bugs where the counter increments without persisting state, or
    /// vice versa.
    function invariant_nextIntentIdMatchesCreates() public view {
        uint256 expected = handler.totalCreatedIntents() + handler.totalCreatedRFQs();
        assertEq(otc.nextIntentId(), expected);
    }

    /// @dev Cancelled intents stay Cancelled forever — the state machine has
    /// no recovery path. Tests every cancellation we've recorded.
    function invariant_cancelledIntentsStayCancelled() public view {
        uint256 n = handler.cancelledCount();
        for (uint256 i = 0; i < n; i++) {
            uint256 id = handler.cancelledIds(i);
            (,,,,,, PrivateOTC.IntentStatus status,,,) = otc.intents(id);
            assertTrue(
                status == PrivateOTC.IntentStatus.Cancelled,
                "cancelled intent must remain cancelled"
            );
        }
    }

    /// @dev No RFQ ever exceeds MAX_BIDS_PER_RFQ — the contract guard must
    /// hold across every random call sequence.
    function invariant_bidCountNeverExceedsMax() public view {
        uint256 n = handler.totalCreatedRFQs();
        uint256 max = otc.MAX_BIDS_PER_RFQ();
        for (uint256 i = 0; i < n; i++) {
            uint256 rfqId = handler.rfqIds(i);
            uint256 bidCount = handler.bidCountForRfq(rfqId);
            assertLe(bidCount, max, "bid count exceeded MAX_BIDS_PER_RFQ");
        }
    }

    /// @dev MAX_BIDS_PER_RFQ is a `constant` — must remain 10 across every
    /// state transition.
    function invariant_maxBidsConstantStable() public view {
        assertEq(otc.MAX_BIDS_PER_RFQ(), 10);
    }
}

/// @dev Handler exposes mutating actions to Foundry's fuzzer. Each action
///      tries to perform the operation and records outcomes for invariants
///      to inspect.
contract Handler is Test {
    PrivateOTC public immutable otc;
    TradiNoxCToken public immutable cusdc;
    TradiNoxCToken public immutable ceth;

    uint256[] public intentIds;
    uint256[] public rfqIds;
    uint256[] public cancelledIds;
    mapping(uint256 => uint256) public bidCountForRfq;

    constructor(PrivateOTC _otc, TradiNoxCToken _cusdc, TradiNoxCToken _ceth) {
        otc = _otc;
        cusdc = _cusdc;
        ceth = _ceth;
    }

    function totalCreatedIntents() external view returns (uint256) {
        return intentIds.length;
    }

    function totalCreatedRFQs() external view returns (uint256) {
        return rfqIds.length;
    }

    function cancelledCount() external view returns (uint256) {
        return cancelledIds.length;
    }

    function tryCreateIntent(uint256 ttlSeed) external {
        externalEuint256 sellH = _makeHandle(1e18);
        externalEuint256 buyH = _makeHandle(3500e6);
        uint64 deadline = uint64(block.timestamp + (ttlSeed % 7200) + 1);
        try otc.createIntent(ceth, cusdc, sellH, "", buyH, "", deadline, address(0))
            returns (uint256 id) {
            intentIds.push(id);
        } catch { /* ignored */ }
    }

    function tryCreateRFQ(uint256 ttlSeed) external {
        externalEuint256 sellH = _makeHandle(1e18);
        uint64 deadline = uint64(block.timestamp + (ttlSeed % 7200) + 1);
        try otc.createRFQ(ceth, cusdc, sellH, "", deadline) returns (uint256 id) {
            rfqIds.push(id);
        } catch { /* ignored */ }
    }

    function tryCancelIntent(uint256 idSeed) external {
        if (intentIds.length == 0) return;
        uint256 id = intentIds[idSeed % intentIds.length];
        try otc.cancelIntent(id) {
            cancelledIds.push(id);
        } catch { /* ignored — already cancelled or wrong maker */ }
    }

    function trySubmitBid(uint256 idSeed, uint256 amountSeed) external {
        if (rfqIds.length == 0) return;
        uint256 rfqId = rfqIds[idSeed % rfqIds.length];
        externalEuint256 bidH = _makeHandle((amountSeed % 1e10) + 1);
        try otc.submitBid(rfqId, bidH, "") {
            bidCountForRfq[rfqId]++;
        } catch { /* ignored — at MAX_BIDS, deadline passed, etc. */ }
    }

    function _makeHandle(uint256 value) internal returns (externalEuint256) {
        euint256 e = Nox.toEuint256(value);
        return externalEuint256.wrap(euint256.unwrap(e));
    }
}
