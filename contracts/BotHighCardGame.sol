// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BotHighCardGame
 * @notice PvE (Player vs Environment) card game.
 *         The player bets native coin (SCAI) against the house (contract).
 *         If the player wins, the house pays out from its own balance.
 *         If the house wins, the house keeps the player's bet.
 *         The game resolves in a single transaction.
 */
contract BotHighCardGame is ReentrancyGuard {

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Game {
        address player;
        uint256 betAmount;
        bool    resolved;
        uint256 createdAt;
    }

    // ── State ────────────────────────────────────────────────────────────────

    address public immutable owner;

    uint256 public minStake;
    uint256 public maxStake; 
    uint256 public exchangeRate; 
    uint256 public protocolFeeBps;
    uint256 public totalFeesCollected;

    uint256 private _nextGameId;

    mapping(uint256 => Game) public games;

    // ── Events ───────────────────────────────────────────────────────────────

    event GamePlayed(
        uint256 indexed gameId,
        address indexed player,
        uint256 betAmount
    );

    /// @notice Emitted when the game is resolved (instantly in PvE).
    event GameResult(
        uint256 indexed gameId,
        uint8   playerCard,
        uint8   botCard,
        address winner,      // address(0) = draw, address(this) = bot
        uint256 payout
    );

    event FundsDeposited(address indexed admin, uint256 amount);
    event FundsWithdrawn(address indexed admin, uint256 amount);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        uint256 _minStake,
        uint256 _maxStake,
        uint256 _protocolFeeBps,
        uint256 _exchangeRate
    ) {
        require(_minStake > 0, "Invalid min stake");
        require(_maxStake >= _minStake, "Max stake < min stake");
        require(_protocolFeeBps <= 1000, "Fee too high");
        require(_exchangeRate > 0, "Exchange rate must be > 0");

        owner          = msg.sender;
        minStake       = _minStake;
        maxStake       = _maxStake;
        protocolFeeBps = _protocolFeeBps;
        exchangeRate   = _exchangeRate;
    }

    // ── House Bankroll Management ─────────────────────────────────────────────

    /**
     * @notice Admin deposits native coins to bankroll the bot so it can pay winners.
     */
    function depositHouseFunds() external payable onlyOwner nonReentrant {
        require(msg.value > 0, "Zero amount");
        emit FundsDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Admin withdraws house native coins (excluding protocol fees).
     */
    function withdrawHouseFunds(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Zero amount");
        // Ensure we don't withdraw collected fees
        uint256 availableBankroll = address(this).balance - totalFeesCollected;
        require(amount <= availableBankroll, "Insufficient house funds");
        
        payable(owner).transfer(amount);
        emit FundsWithdrawn(msg.sender, amount);
    }

    // ── Play ──────────────────────────────────────────────────────────────────

    /**
     * @notice Player bets against the bot using native coin (SCAI). The game is resolved instantly.
     * @return gameId    The ID of the resolved game.
     */
    function playGame()
        external
        payable
        nonReentrant
        returns (uint256 gameId)
    {
        uint256 betAmount = msg.value;
        require(betAmount >= minStake, "Bet too small");
        require(betAmount <= maxStake, "Bet too large");
        
        // Ensure contract has enough bankroll to pay out a player's win 
        uint256 availableBankroll = getAvailableBankroll();
        require(availableBankroll >= (betAmount * exchangeRate) / 100, "House bankroll too low");

        gameId = _nextGameId++;
        games[gameId] = Game({
            player:          msg.sender,
            betAmount:       betAmount,
            resolved:        true,
            createdAt:       block.timestamp
        });

        emit GamePlayed(gameId, msg.sender, betAmount);

        // ── Settle Instantly ──────────────────────────────────────────────────
        
        // Simple PRNG (Note: Miner manipulation is possible, not for large sums)
        uint256 entropy = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    msg.sender,
                    address(this),
                    gameId
                )
            )
        );

        uint8 playerCard = uint8(entropy        % 13) + 1;
        uint8 botCard    = uint8((entropy >> 8) % 13) + 1;

        uint256 totalPot = (betAmount * exchangeRate) / 100;
        address winner;
        uint256 payout;

        if (playerCard == botCard) {
            // Draw: Refund player's original bet
            winner = address(0);
            payout = betAmount;
            payable(msg.sender).transfer(betAmount);
            
        } else if (playerCard > botCard) {
            // Player wins: Payout = pot - fee
            winner = msg.sender;
            uint256 fee = (totalPot * protocolFeeBps) / 10_000;
            payout = totalPot - fee;
            totalFeesCollected += fee;
            
            payable(msg.sender).transfer(payout);
            
        } else {
            // Bot wins: House keeps the bet
            winner = address(this);
            uint256 fee = (totalPot * protocolFeeBps) / 10_000;
            payout = totalPot - fee; // Internal bookkeeping for how much the bot "won"
            totalFeesCollected += fee;
            
            // No transfer needed, the player's bet becomes part of house bankroll
        }

        emit GameResult(gameId, playerCard, botCard, winner, payout);
    }

    // ── Admin Setters ─────────────────────────────────────────────────────────

    function withdrawFees(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0,                        "Invalid amount");
        require(amount <= totalFeesCollected,      "Insufficient fees");
        totalFeesCollected -= amount;
        payable(owner).transfer(amount);
    }

    function setMinStake(uint256 _minStake) external onlyOwner {
        require(_minStake > 0, "Invalid min stake");
        require(maxStake >= _minStake, "Max stake < min stake");
        minStake = _minStake;
    }

    function setMaxStake(uint256 _maxStake) external onlyOwner {
        require(_maxStake >= minStake, "Max stake < min stake");
        maxStake = _maxStake;
    }

    function setExchangeRate(uint256 _exchangeRate) external onlyOwner {
        require(_exchangeRate > 0, "Exchange rate must be > 0");
        exchangeRate = _exchangeRate;
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function nextGameId() external view returns (uint256) {
        return _nextGameId;
    }

    /**
     * @notice Returns the current house bankroll available for payouts.
     */
    function getAvailableBankroll() public view returns (uint256) {
        uint256 balance = address(this).balance;
        if (balance <= totalFeesCollected) return 0;
        return balance - totalFeesCollected;
    }
    
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
}
