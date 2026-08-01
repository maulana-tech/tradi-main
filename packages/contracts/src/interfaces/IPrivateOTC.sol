// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984} from "./IERC7984.sol";

/// @title IPrivateOTC — On-chain confidential OTC desk interface
interface IPrivateOTC {
    enum IntentStatus {
        Open,
        Filled,
        Cancelled,
        Expired,
        PendingReveal
    }

    enum Mode {
        Direct,
        RFQ
    }

    event IntentCreated(
        uint256 indexed id, address indexed maker, address sellToken, address buyToken, Mode mode, uint64 deadline
    );
    event BidSubmitted(uint256 indexed id, address indexed taker);
    event Settled(uint256 indexed id, address indexed taker);
    event Cancelled(uint256 indexed id);
    event RFQPendingReveal(uint256 indexed id);

    /// @notice Create a Direct OTC intent (1 maker ↔ 1 taker)
    function createIntent(
        IERC7984 sellToken,
        IERC7984 buyToken,
        externalEuint256 sellAmountHandle,
        bytes calldata sellProof,
        externalEuint256 minBuyAmountHandle,
        bytes calldata minBuyProof,
        uint64 deadline,
        address allowedTaker
    ) external returns (uint256 id);

    /// @notice Accept a Direct OTC intent
    function acceptIntent(uint256 id, externalEuint256 buyAmountHandle, bytes calldata buyProof) external;

    /// @notice Cancel an open intent (maker only)
    function cancelIntent(uint256 id) external;

    /// @notice Create an RFQ intent (1 maker ↔ N takers, Vickrey pricing)
    function createRFQ(
        IERC7984 sellToken,
        IERC7984 buyToken,
        externalEuint256 sellAmountHandle,
        bytes calldata sellProof,
        uint64 biddingDeadline
    ) external returns (uint256 id);

    /// @notice Submit a sealed bid to an RFQ
    function submitBid(uint256 id, externalEuint256 bidAmountHandle, bytes calldata bidProof) external;

    /// @notice Step 1 of 2: freeze RFQ + compute encrypted second-highest price.
    /// Anyone can call after the bidding deadline. Status → PendingReveal.
    function finalizeRFQ(uint256 id) external;

    /// @notice Step 2 of 2: maker reveals winner (decrypted off-chain) and
    /// settlement runs at the encrypted second-price. Status → Filled.
    function revealRFQWinner(uint256 id, uint256 winnerIdx) external;
}
