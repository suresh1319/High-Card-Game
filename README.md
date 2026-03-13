# Nexus High Card Terminal

A decentralized, on-chain Player-vs-Environment (PvE) card game built on the **SecureChain AI (SCAI)** network.

## 🎮 How to Play

1.  **Connect Wallet**: Click the **Connect Wallet** button in the top right to link your MetaMask or Web3 wallet.
2.  **Initialize Interface**: Click **INITIALIZE INTERFACE** on the landing page to enter the terminal.
3.  **Place Your Stake**: 
    - Enter the amount of SCAI you wish to bet.
    - Ensure your bet is within the protocol's Min/Max stake limits.
4.  **Battle**: Click **INITIALIZE MATCH** to draw cards.
5.  **View Results**:
    - **Win**: Your card is higher than the House. You receive your `Stake * Multiplier`.
    - **Lose**: Your card is lower than the House. The stake is kept by the House.
    - **Standoff**: Cards are equal. Your stake is returned instantly.

## ⚙️ Administration & Setup

### Environment Configuration
The project uses environment variables for security.
1. Copy `.env.example` to `.env`.
2. Fill in your `PRIVATE_KEY`, `RPC_URL`, and `CONTRACT_ADDRESS`.
3. Run the configuration sync:
   ```bash
   node scripts/sync_config.js
   ```

### Deployment & Funding
- **Deploy**: `npx hardhat run scripts/deploy.js --network securechain`
- **Fund House**: `npx hardhat run scripts/fund_house.js --network securechain`
- **Withdraw House**: `npx hardhat run scripts/withdraw_house.js --network securechain`
- **Check Status**: `npx hardhat run scripts/debug_bankroll.js --network securechain`

## 🛠 Project Structure
- `contracts/`: Solidity smart contracts.
- `scripts/`: Operational and management scripts.
- `app.js`: Frontend logic and blockchain interaction.
- `index.html`: Main game interface.

## ⚖️ Legal Disclaimer
As per the **Promotion and Regulation of Online Gaming Act, 2025 (India)**, this game is classified as an "online money game" and is considered **illegal in India**. Operating, promoting, or facilitating this game within Indian jurisdiction may lead to criminal penalties.

---
*Built with ❤️ for the Nexus Games Ecosystem.*
