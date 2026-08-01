// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/// @title IERC7984Receiver — Confidential Fungible Token receiver hook
/// @notice Contracts receiving cToken transfers via confidentialTransferAndCall
///         must implement this and return the function selector (left-padded
///         to bytes32) to acknowledge receipt.
/// @dev Spec: https://eips.ethereum.org/EIPS/eip-7984
interface IERC7984Receiver {
    /// @notice Called by an ERC-7984 token after a confidentialTransfer*AndCall.
    /// @param operator Address that initiated the transfer
    /// @param from     Source of the funds
    /// @param amount   Encrypted bytes32 handle for the amount
    /// @param data     Optional caller-supplied payload
    /// @return success Must equal bytes32(this.onConfidentialTransferReceived.selector)
    ///                 (i.e. left-padded function selector) to accept the transfer.
    function onConfidentialTransferReceived(
        address operator,
        address from,
        bytes32 amount,
        bytes calldata data
    ) external returns (bytes32 success);
}
