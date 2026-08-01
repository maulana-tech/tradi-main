// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {TradiNoxCToken} from "../src/tokens/TradiNoxCToken.sol";
import {IERC7984Receiver} from "../src/interfaces/IERC7984Receiver.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";

/// @notice ERC-7984 receiver callback tests for TradiNoxCToken's
///         confidentialTransferAndCall variants.
///
/// Run: forge test --fork-url $ARBITRUM_SEPOLIA_RPC_URL --match-contract TradiNoxCTokenReceiverForkTest
///
/// Per the ERC-7984 spec, contracts receiving a confidentialTransfer*AndCall
/// MUST implement IERC7984Receiver and return the function selector
/// (left-padded to bytes32) to acknowledge receipt. The spec requires *all*
/// 4 transfer-and-call variants to enforce this. These tests verify:
///   - Correct magic-value return → success
///   - Wrong magic-value return → revert "TradiNoxCToken: receiver rejected"
///   - Reverting receiver → propagates revert
///   - EOA recipient (no code) → callback skipped, transfer succeeds
contract TradiNoxCTokenReceiverForkTest is Test {
    TradiNoxCToken token;

    address sender = makeAddr("sender");
    address eoaRecipient = makeAddr("eoa-recipient");
    GoodReceiver goodReceiver;
    BadReceiver badReceiver;
    RevertingReceiver revertingReceiver;

    function setUp() public {
        if (block.chainid != 421614) vm.skip(true);

        token = new TradiNoxCToken("Confidential USDC", "cUSDC", 6);

        goodReceiver = new GoodReceiver();
        badReceiver = new BadReceiver();
        revertingReceiver = new RevertingReceiver();

        // Mock validateInputProof for faucet calls.
        vm.mockCall(
            Nox.noxComputeContract(),
            abi.encodeWithSelector(INoxCompute.validateInputProof.selector),
            abi.encode()
        );

        // Stock sender with balance to transfer.
        externalEuint256 stockH = _makeHandle(1_000_000e6);
        vm.prank(sender);
        token.faucet(stockH, "");
    }

    /* ─────────────── confidentialTransferAndCall (3-arg) ─────────────── */

    function test_transferAndCall_positive_acceptedByGoodReceiver() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        // The spec doesn't require the transfer amount to be the full balance;
        // we use the existing handle so the call succeeds.

        vm.prank(sender);
        token.confidentialTransferAndCall(address(goodReceiver), amount, "");

        // Receiver's lastReceived should record the call.
        assertEq(goodReceiver.lastFrom(), sender);
        assertEq(goodReceiver.lastOperator(), sender);
        assertEq(goodReceiver.lastAmount(), amount);
    }

    function test_transferAndCall_negative_revertsOnWrongMagicValue() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        vm.prank(sender);
        vm.expectRevert(bytes("TradiNoxCToken: receiver rejected"));
        token.confidentialTransferAndCall(address(badReceiver), amount, "");
    }

    function test_transferAndCall_negative_propagatesReceiverRevert() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        vm.prank(sender);
        vm.expectRevert(bytes("receiver intentional revert"));
        token.confidentialTransferAndCall(address(revertingReceiver), amount, "");
    }

    function test_transferAndCall_edge_skipsCallbackForEOARecipient() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        // EOA has no code; receiver check should short-circuit.
        vm.prank(sender);
        token.confidentialTransferAndCall(eoaRecipient, amount, "");
        // No revert means callback was skipped successfully.
    }

    function test_transferAndCall_positive_passesCallDataToReceiver() public {
        bytes memory payload = hex"deadbeef";
        bytes32 amount = token.confidentialBalanceOf(sender);
        vm.prank(sender);
        token.confidentialTransferAndCall(address(goodReceiver), amount, payload);
        assertEq(goodReceiver.lastData(), payload);
    }

    /* ─────── confidentialTransferAndCall (4-arg with proof bytes) ─────── */

    function test_transferAndCall4Arg_positive_acceptedByGoodReceiver() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        vm.prank(sender);
        token.confidentialTransferAndCall(
            address(goodReceiver),
            amount,
            hex"00", // unused proof bytes
            "callData"
        );
        assertEq(goodReceiver.lastFrom(), sender);
    }

    function test_transferAndCall4Arg_negative_revertsOnWrongMagicValue() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        vm.prank(sender);
        vm.expectRevert(bytes("TradiNoxCToken: receiver rejected"));
        token.confidentialTransferAndCall(
            address(badReceiver),
            amount,
            hex"00",
            ""
        );
    }

    /* ─────── confidentialTransferFromAndCall (4-arg) ─────── */

    function test_transferFromAndCall_positive_requiresOperator() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        // sender authorizes the test contract as operator
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(sender);
        token.setOperator(address(this), until);

        // Now this contract pulls from sender → goodReceiver
        token.confidentialTransferFromAndCall(
            sender,
            address(goodReceiver),
            amount,
            ""
        );
        assertEq(goodReceiver.lastFrom(), sender);
        assertEq(goodReceiver.lastOperator(), address(this));
    }

    function test_transferFromAndCall_negative_revertsOnWrongMagicValue() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(sender);
        token.setOperator(address(this), until);

        vm.expectRevert(bytes("TradiNoxCToken: receiver rejected"));
        token.confidentialTransferFromAndCall(
            sender,
            address(badReceiver),
            amount,
            ""
        );
    }

    function test_transferFromAndCall_negative_revertsWithoutOperator() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        // No setOperator call — should revert at the operator check before
        // ever reaching the receiver callback.
        vm.expectRevert(bytes("TradiNoxCToken: not operator"));
        token.confidentialTransferFromAndCall(
            sender,
            address(goodReceiver),
            amount,
            ""
        );
    }

    /* ─────── confidentialTransferFromAndCall (5-arg with proof bytes) ─────── */

    function test_transferFromAndCall5Arg_positive_acceptedByGoodReceiver() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(sender);
        token.setOperator(address(this), until);

        token.confidentialTransferFromAndCall(
            sender,
            address(goodReceiver),
            amount,
            hex"00",
            ""
        );
        assertEq(goodReceiver.lastFrom(), sender);
    }

    function test_transferFromAndCall5Arg_negative_revertsOnWrongMagicValue() public {
        bytes32 amount = token.confidentialBalanceOf(sender);
        uint48 until = uint48(block.timestamp + 1 hours);
        vm.prank(sender);
        token.setOperator(address(this), until);

        vm.expectRevert(bytes("TradiNoxCToken: receiver rejected"));
        token.confidentialTransferFromAndCall(
            sender,
            address(badReceiver),
            amount,
            hex"00",
            ""
        );
    }

    /* ─────────────────────── helpers ─────────────────────── */

    function _makeHandle(uint256 value) internal returns (externalEuint256) {
        euint256 e = Nox.toEuint256(value);
        return externalEuint256.wrap(euint256.unwrap(e));
    }
}

/* ─────────────────────── test fixtures ─────────────────────── */

contract GoodReceiver is IERC7984Receiver {
    address public lastOperator;
    address public lastFrom;
    bytes32 public lastAmount;
    bytes public lastData;

    function onConfidentialTransferReceived(
        address operator,
        address from,
        bytes32 amount,
        bytes calldata data
    ) external override returns (bytes32) {
        lastOperator = operator;
        lastFrom = from;
        lastAmount = amount;
        lastData = data;
        return bytes32(this.onConfidentialTransferReceived.selector);
    }
}

contract BadReceiver is IERC7984Receiver {
    function onConfidentialTransferReceived(
        address,
        address,
        bytes32,
        bytes calldata
    ) external pure override returns (bytes32) {
        // Wrong magic — caller should reject.
        return bytes32(uint256(0xDEADBEEF));
    }
}

contract RevertingReceiver is IERC7984Receiver {
    function onConfidentialTransferReceived(
        address,
        address,
        bytes32,
        bytes calldata
    ) external pure override returns (bytes32) {
        revert("receiver intentional revert");
    }
}
