// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/// @title IERC7984 — Confidential Fungible Token
/// @notice Full ERC-7984 interface — all 8 transfer variants (4 plain + 4 with-call).
/// @dev Spec: https://eips.ethereum.org/EIPS/eip-7984
interface IERC7984 {
    event ConfidentialTransfer(address indexed from, address indexed to, bytes32 indexed amount);
    event OperatorSet(address indexed holder, address indexed operator, uint48 until);
    event AmountDisclosed(bytes32 indexed handle, uint256 amount);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function contractURI() external view returns (string memory);

    function confidentialTotalSupply() external view returns (bytes32);
    function confidentialBalanceOf(address account) external view returns (bytes32);
    function isOperator(address holder, address spender) external view returns (bool);

    function setOperator(address operator, uint48 until) external;

    /* ─────────── Plain transfers (4 variants) ─────────── */

    function confidentialTransfer(address to, bytes32 amount) external returns (bytes32);

    function confidentialTransfer(address to, bytes32 amount, bytes calldata data) external returns (bytes32);

    function confidentialTransferFrom(address from, address to, bytes32 amount) external returns (bytes32);

    function confidentialTransferFrom(address from, address to, bytes32 amount, bytes calldata data)
        external
        returns (bytes32);

    /* ─────────── Transfer-and-call variants (4 variants) ─────────── */

    function confidentialTransferAndCall(address to, bytes32 amount, bytes calldata callData)
        external
        returns (bytes32);

    function confidentialTransferAndCall(
        address to,
        bytes32 amount,
        bytes calldata data,
        bytes calldata callData
    ) external returns (bytes32);

    function confidentialTransferFromAndCall(address from, address to, bytes32 amount, bytes calldata callData)
        external
        returns (bytes32);

    function confidentialTransferFromAndCall(
        address from,
        address to,
        bytes32 amount,
        bytes calldata data,
        bytes calldata callData
    ) external returns (bytes32);
}
