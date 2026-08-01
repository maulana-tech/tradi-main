// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox, euint256, externalEuint256, ebool} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

import {IERC7984} from "./interfaces/IERC7984.sol";

/// @title PrivateOTC — On-chain confidential OTC desk
/// @notice Hidden-amount OTC trading with Vickrey-fair RFQ pricing.
/// @dev Settlement uses ERC-7984 cTokens. Encrypted ops via iExec Nox.
contract PrivateOTC {
    uint256 public constant MAX_BIDS_PER_RFQ = 10;

    enum IntentStatus {
        Open,
        Filled,
        Cancelled,
        Expired,
        // RFQ only — auction frozen and second-price computed; maker must
        // call revealRFQWinner(id, winnerIdx) to pick the highest bidder
        // (verified off-chain via Nox decryption of bid amounts) and settle.
        // Prevents the "always bids[0] wins" bug — Vickrey requires the
        // highest bidder to receive the goods, but Nox doesn't yet support
        // encrypted address tracking, so we surface the winner-pick to the
        // maker explicitly.
        PendingReveal
    }

    enum Mode {
        Direct,
        RFQ
    }

    struct Intent {
        address maker;
        IERC7984 sellToken;
        IERC7984 buyToken;
        euint256 sellAmount;
        euint256 minBuyAmount;
        uint64 deadline;
        IntentStatus status;
        Mode mode;
        address allowedTaker;
        // RFQ only — encrypted second-highest bid amount, computed at
        // finalizeRFQ time, consumed at revealRFQWinner time.
        euint256 priceToPay;
    }

    struct Bid {
        address taker;
        euint256 offeredAmount;
        bool active;
    }

    mapping(uint256 => Intent) public intents;
    mapping(uint256 => Bid[]) public bids;
    uint256 public nextIntentId;

    event IntentCreated(
        uint256 indexed id, address indexed maker, address sellToken, address buyToken, Mode mode, uint64 deadline
    );
    event BidSubmitted(uint256 indexed id, address indexed taker);
    event Settled(uint256 indexed id, address indexed taker);
    event Cancelled(uint256 indexed id);
    /// @notice Emitted when an RFQ has been finalized but is awaiting maker
    /// reveal of the winning bidder. Maker decrypts bid amounts off-chain
    /// then calls revealRFQWinner(id, winnerIdx) to settle.
    event RFQPendingReveal(uint256 indexed id);

    error IntentNotOpen();
    error NotMaker();
    error NotAllowedTaker();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error MaxBidsReached();
    error InsufficientBids();
    error InvalidWinnerIndex();
    error NotPendingReveal();

    /* -------------------------------------------------------------------------- */
    /*                                Direct OTC                                  */
    /* -------------------------------------------------------------------------- */

    function createIntent(
        IERC7984 sellToken,
        IERC7984 buyToken,
        externalEuint256 sellAmountHandle,
        bytes calldata sellProof,
        externalEuint256 minBuyAmountHandle,
        bytes calldata minBuyProof,
        uint64 deadline,
        address allowedTaker
    ) external returns (uint256 id) {
        if (deadline <= block.timestamp) revert DeadlinePassed();

        id = nextIntentId++;

        euint256 sellAmount = Nox.fromExternal(sellAmountHandle, sellProof);
        euint256 minBuyAmount = Nox.fromExternal(minBuyAmountHandle, minBuyProof);

        intents[id] = Intent({
            maker: msg.sender,
            sellToken: sellToken,
            buyToken: buyToken,
            sellAmount: sellAmount,
            minBuyAmount: minBuyAmount,
            deadline: deadline,
            status: IntentStatus.Open,
            mode: Mode.Direct,
            allowedTaker: allowedTaker,
            priceToPay: Nox.toEuint256(0)
        });

        Nox.allowThis(sellAmount);
        Nox.allow(sellAmount, msg.sender);
        Nox.allowThis(minBuyAmount);
        Nox.allow(minBuyAmount, msg.sender);

        emit IntentCreated(id, msg.sender, address(sellToken), address(buyToken), Mode.Direct, deadline);
    }

    function acceptIntent(uint256 id, externalEuint256 buyAmountHandle, bytes calldata buyProof) external {
        Intent storage intent = intents[id];
        if (intent.status != IntentStatus.Open) revert IntentNotOpen();
        if (intent.mode != Mode.Direct) revert IntentNotOpen();
        if (block.timestamp > intent.deadline) revert DeadlinePassed();
        if (intent.allowedTaker != address(0) && msg.sender != intent.allowedTaker) {
            revert NotAllowedTaker();
        }

        euint256 buyAmount = Nox.fromExternal(buyAmountHandle, buyProof);

        // ─── Strategy B: atomic conditional via safeSub + select ───
        // sufficient = (buyAmount >= minBuyAmount), underflow-safe.
        (ebool sufficient,) = Nox.safeSub(buyAmount, intent.minBuyAmount);

        euint256 zero = Nox.toEuint256(0);
        // Route real amounts on success, zeros on failure. The branch is encrypted.
        euint256 effectiveSell = Nox.select(sufficient, intent.sellAmount, zero);
        euint256 effectiveBuy = Nox.select(sufficient, buyAmount, zero);

        _settleAtomic(intent.sellToken, intent.buyToken, intent.maker, msg.sender, effectiveSell, effectiveBuy);

        intent.status = IntentStatus.Filled;
        emit Settled(id, msg.sender);
    }

    function cancelIntent(uint256 id) external {
        Intent storage intent = intents[id];
        if (intent.maker != msg.sender) revert NotMaker();
        if (intent.status != IntentStatus.Open) revert IntentNotOpen();
        intent.status = IntentStatus.Cancelled;
        emit Cancelled(id);
    }

    /* -------------------------------------------------------------------------- */
    /*                              RFQ (Vickrey)                                 */
    /* -------------------------------------------------------------------------- */

    function createRFQ(
        IERC7984 sellToken,
        IERC7984 buyToken,
        externalEuint256 sellAmountHandle,
        bytes calldata sellProof,
        uint64 biddingDeadline
    ) external returns (uint256 id) {
        if (biddingDeadline <= block.timestamp) revert DeadlinePassed();

        id = nextIntentId++;
        euint256 sellAmount = Nox.fromExternal(sellAmountHandle, sellProof);

        intents[id] = Intent({
            maker: msg.sender,
            sellToken: sellToken,
            buyToken: buyToken,
            sellAmount: sellAmount,
            minBuyAmount: Nox.toEuint256(0),
            deadline: biddingDeadline,
            status: IntentStatus.Open,
            mode: Mode.RFQ,
            allowedTaker: address(0),
            priceToPay: Nox.toEuint256(0)
        });

        Nox.allowThis(sellAmount);
        Nox.allow(sellAmount, msg.sender);

        emit IntentCreated(id, msg.sender, address(sellToken), address(buyToken), Mode.RFQ, biddingDeadline);
    }

    function submitBid(uint256 id, externalEuint256 bidAmountHandle, bytes calldata bidProof) external {
        Intent storage intent = intents[id];
        if (intent.status != IntentStatus.Open) revert IntentNotOpen();
        if (intent.mode != Mode.RFQ) revert IntentNotOpen();
        if (block.timestamp > intent.deadline) revert DeadlinePassed();
        if (bids[id].length >= MAX_BIDS_PER_RFQ) revert MaxBidsReached();

        euint256 bidAmount = Nox.fromExternal(bidAmountHandle, bidProof);
        bids[id].push(Bid({taker: msg.sender, offeredAmount: bidAmount, active: true}));

        Nox.allowThis(bidAmount);
        Nox.allow(bidAmount, msg.sender);

        emit BidSubmitted(id, msg.sender);
    }

    /// @notice Step 1 of 2: freeze the auction and compute the encrypted
    /// second-highest price. Anyone can call this after the bidding deadline.
    /// Maker must then call revealRFQWinner with the winning bid index to
    /// settle. The 2-step flow is necessary because Nox doesn't yet support
    /// encrypted addresses, so the winner must be picked off-chain by the
    /// maker (who decrypts bid amounts via the per-bid Nox.allow access
    /// granted to them).
    function finalizeRFQ(uint256 id) external {
        Intent storage intent = intents[id];
        if (intent.status != IntentStatus.Open) revert IntentNotOpen();
        if (intent.mode != Mode.RFQ) revert IntentNotOpen();
        if (block.timestamp <= intent.deadline) revert DeadlineNotPassed();

        Bid[] storage _bids = bids[id];
        if (_bids.length < 2) revert InsufficientBids();

        euint256 priceToPay = _computeSecondPrice(id);
        intent.priceToPay = priceToPay;
        intent.status = IntentStatus.PendingReveal;

        // Allow the maker to read every bid amount off-chain so they can
        // determine the actual highest bidder. (Bid handles already had ACL
        // for their own taker via submitBid.)
        for (uint256 i = 0; i < _bids.length; i++) {
            Nox.allow(_bids[i].offeredAmount, intent.maker);
        }
        Nox.allow(priceToPay, intent.maker);

        emit RFQPendingReveal(id);
    }

    /// @notice Step 2 of 2: maker picks the actual highest bidder (verified
    /// off-chain via Nox decryption) and settlement runs. Trust assumption:
    /// the maker is honest about which bidder won. Maker has weak incentive
    /// to cheat (they get paid the same encrypted second-price regardless of
    /// who they pick), and reputation/social cost makes off-chain cheating
    /// expensive. For stronger guarantees, future Nox versions with eaddress
    /// support will let us pick the winner fully on-chain.
    function revealRFQWinner(uint256 id, uint256 winnerIdx) external {
        Intent storage intent = intents[id];
        if (intent.maker != msg.sender) revert NotMaker();
        if (intent.status != IntentStatus.PendingReveal) revert NotPendingReveal();

        Bid[] storage _bids = bids[id];
        if (winnerIdx >= _bids.length) revert InvalidWinnerIndex();

        address winnerAddr = _bids[winnerIdx].taker;

        _settleAtomic(
            intent.sellToken,
            intent.buyToken,
            intent.maker,
            winnerAddr,
            intent.sellAmount,
            intent.priceToPay
        );

        intent.status = IntentStatus.Filled;
        emit Settled(id, winnerAddr);
    }

    /* -------------------------------------------------------------------------- */
    /*                             Internal helpers                               */
    /* -------------------------------------------------------------------------- */

    /// @dev Vickrey: compute the encrypted second-highest bid amount. Used
    /// as the price the winner will pay. Winner address is determined
    /// separately by the maker via revealRFQWinner (see comment there).
    ///
    /// Three cases per iteration:
    ///   candidate > highest  → second = highest, highest = candidate
    ///   second < candidate ≤ highest → second = candidate (highest unchanged)
    ///   candidate ≤ second   → no change
    /// The naive `second = isHigher ? highest : second` would lose the middle
    /// case — caught by Vickrey algorithm fuzz tests in VickreyAlgorithm.t.sol.
    function _computeSecondPrice(uint256 id) internal returns (euint256 priceToPay) {
        Bid[] storage _bids = bids[id];

        ebool initSwap = Nox.gt(_bids[1].offeredAmount, _bids[0].offeredAmount);
        euint256 highest = Nox.select(initSwap, _bids[1].offeredAmount, _bids[0].offeredAmount);
        euint256 second = Nox.select(initSwap, _bids[0].offeredAmount, _bids[1].offeredAmount);

        for (uint256 i = 2; i < _bids.length; i++) {
            euint256 candidate = _bids[i].offeredAmount;
            ebool isHigher = Nox.gt(candidate, highest);
            ebool isMiddle = Nox.gt(candidate, second);

            euint256 newSecondIfNotHigher = Nox.select(isMiddle, candidate, second);
            second = Nox.select(isHigher, highest, newSecondIfNotHigher);
            highest = Nox.select(isHigher, candidate, highest);
        }

        Nox.allowThis(highest);
        Nox.allowThis(second);
        priceToPay = second;
    }

    /// @dev Settle a swap: sellToken from maker → taker, buyToken from taker → maker.
    /// Both amounts encrypted. Requires both parties to have called setOperator(this, until).
    function _settleAtomic(
        IERC7984 sellToken,
        IERC7984 buyToken,
        address maker,
        address taker,
        euint256 effectiveSell,
        euint256 effectiveBuy
    ) internal {
        // Grant cTokens transient access to the amount handles for this tx
        Nox.allowTransient(effectiveSell, address(sellToken));
        Nox.allowTransient(effectiveBuy, address(buyToken));

        // Atomic ERC-7984 transfers
        sellToken.confidentialTransferFrom(maker, taker, euint256.unwrap(effectiveSell));
        buyToken.confidentialTransferFrom(taker, maker, euint256.unwrap(effectiveBuy));

        // Persist amounts so both parties can decrypt off-chain (auditor + audit trail)
        Nox.allowThis(effectiveSell);
        Nox.allow(effectiveSell, maker);
        Nox.allow(effectiveSell, taker);
        Nox.allowThis(effectiveBuy);
        Nox.allow(effectiveBuy, maker);
        Nox.allow(effectiveBuy, taker);
    }
}
