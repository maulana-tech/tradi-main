// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {IERC7984} from "../interfaces/IERC7984.sol";
import {IERC7984Receiver} from "../interfaces/IERC7984Receiver.sol";

/// @title TradiNoxCToken — Tradi-Nox's ERC-7984 confidential fungible token
/// @notice Full ERC-7984 spec implementation: 8 transfer variants (4 plain +
///         4 transfer-and-call with IERC7984Receiver callback verification).
///         Used as cUSDC / cETH within Tradi-Nox's confidential OTC desk.
/// @dev Open faucet for testnet — production should add access control.
///      Internally uses Nox.transfer / Nox.mint primitives for encrypted
///      balance accounting via iExec NoxCompute (TEE).
contract TradiNoxCToken is IERC7984 {
    string public override name;
    string public override symbol;
    uint8 public immutable override decimals;
    string public override contractURI;

    mapping(address => euint256) private _balances;
    euint256 private _totalSupply;
    mapping(address => mapping(address => uint48)) private _operators;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _totalSupply = Nox.toEuint256(0);
        Nox.allowThis(_totalSupply);
    }

    /// @notice Open faucet — mint encrypted amount to msg.sender. Testnet only.
    function faucet(externalEuint256 amountHandle, bytes calldata amountProof) external {
        euint256 amount = Nox.fromExternal(amountHandle, amountProof);

        (, euint256 newBalance, euint256 newSupply) = Nox.mint(_balances[msg.sender], amount, _totalSupply);

        _balances[msg.sender] = newBalance;
        _totalSupply = newSupply;

        Nox.allowThis(newBalance);
        Nox.allow(newBalance, msg.sender);
        Nox.allowThis(newSupply);
    }

    /* ─────────── ERC-7984 view ─────────── */

    function confidentialTotalSupply() external view override returns (bytes32) {
        return euint256.unwrap(_totalSupply);
    }

    function confidentialBalanceOf(address account) external view override returns (bytes32) {
        return euint256.unwrap(_balances[account]);
    }

    function isOperator(address holder, address spender) external view override returns (bool) {
        return _operators[holder][spender] > block.timestamp;
    }

    function setOperator(address operator, uint48 until) external override {
        _operators[msg.sender][operator] = until;
        emit OperatorSet(msg.sender, operator, until);
    }

    /* ─────────── Plain transfers (4 variants) ─────────── */

    function confidentialTransfer(address to, bytes32 amount) external override returns (bytes32) {
        return _doTransfer(msg.sender, to, amount);
    }

    function confidentialTransfer(address to, bytes32 amount, bytes calldata)
        external
        override
        returns (bytes32)
    {
        return _doTransfer(msg.sender, to, amount);
    }

    function confidentialTransferFrom(address from, address to, bytes32 amount) external override returns (bytes32) {
        _checkOperator(from);
        return _doTransfer(from, to, amount);
    }

    function confidentialTransferFrom(address from, address to, bytes32 amount, bytes calldata)
        external
        override
        returns (bytes32)
    {
        _checkOperator(from);
        return _doTransfer(from, to, amount);
    }

    /* ─────────── Transfer-and-call variants (4 variants) ─────────── */

    function confidentialTransferAndCall(address to, bytes32 amount, bytes calldata callData)
        external
        override
        returns (bytes32)
    {
        bytes32 result = _doTransfer(msg.sender, to, amount);
        _checkReceiver(msg.sender, msg.sender, to, amount, callData);
        return result;
    }

    function confidentialTransferAndCall(
        address to,
        bytes32 amount,
        bytes calldata,
        bytes calldata callData
    ) external override returns (bytes32) {
        bytes32 result = _doTransfer(msg.sender, to, amount);
        _checkReceiver(msg.sender, msg.sender, to, amount, callData);
        return result;
    }

    function confidentialTransferFromAndCall(address from, address to, bytes32 amount, bytes calldata callData)
        external
        override
        returns (bytes32)
    {
        _checkOperator(from);
        bytes32 result = _doTransfer(from, to, amount);
        _checkReceiver(msg.sender, from, to, amount, callData);
        return result;
    }

    function confidentialTransferFromAndCall(
        address from,
        address to,
        bytes32 amount,
        bytes calldata,
        bytes calldata callData
    ) external override returns (bytes32) {
        _checkOperator(from);
        bytes32 result = _doTransfer(from, to, amount);
        _checkReceiver(msg.sender, from, to, amount, callData);
        return result;
    }

    /* ─────────── Internal ─────────── */

    function _checkOperator(address from) internal view {
        require(
            from == msg.sender || _operators[from][msg.sender] > block.timestamp, "TradiNoxCToken: not operator"
        );
    }

    function _doTransfer(address from, address to, bytes32 amount) internal returns (bytes32) {
        euint256 amt = euint256.wrap(amount);

        (, euint256 newFrom, euint256 newTo) = Nox.transfer(_balances[from], _balances[to], amt);

        _balances[from] = newFrom;
        _balances[to] = newTo;

        Nox.allowThis(newFrom);
        Nox.allow(newFrom, from);
        Nox.allowThis(newTo);
        Nox.allow(newTo, to);

        emit ConfidentialTransfer(from, to, amount);
        return amount;
    }

    /// @dev Per ERC-7984 spec, receiver contracts must return the function
    ///      selector (left-padded to bytes32) to acknowledge receipt. EOAs are
    ///      skipped (no callback).
    function _checkReceiver(
        address operator,
        address from,
        address to,
        bytes32 amount,
        bytes calldata callData
    ) internal {
        if (to.code.length == 0) return;

        bytes32 retval = IERC7984Receiver(to).onConfidentialTransferReceived(operator, from, amount, callData);
        bytes32 expected = bytes32(IERC7984Receiver.onConfidentialTransferReceived.selector);
        require(retval == expected, "TradiNoxCToken: receiver rejected");
    }
}
