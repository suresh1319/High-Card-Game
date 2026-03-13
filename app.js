/**
 * app.js
 * Interfaces with Ethers.js to handle connection, gameplay, and animations.
 * Allows playing without a web3 wallet too. 
 */

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const playBtn = document.getElementById('playBtn');
const betAmountInput = document.getElementById('betAmount');
const statusFeed = document.getElementById('statusFeed');
const playerAddressText = document.getElementById('playerAddress');

const playerCard = document.getElementById('playerCard');
const botCard = document.getElementById('botCard');
const playerCardValue = document.querySelector('#playerCardValue .val');
const botCardValue = document.querySelector('#botCardValue .val');

const resultOverlay = document.getElementById('resultOverlay');
const resultTitle = document.getElementById('resultTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const playAgainBtn = document.getElementById('playAgainBtn');
const contractBalanceEl = document.getElementById('contractBalance');
const arenaMultiplierEl = document.getElementById('arenaMultiplier');

const landingPage = document.getElementById('landingPage');
const gamePage = document.getElementById('gamePage');
const startGameBtn = document.getElementById('startGameBtn');

// Admin Elements
const adminBtn = document.getElementById('adminBtn');
const adminModal = document.getElementById('adminModal');
const closeAdminModal = document.getElementById('closeAdminModal');
const adminMinStakeInput = document.getElementById('adminMinStake');
const adminMaxStakeInput = document.getElementById('adminMaxStake');
const adminExchangeRateInput = document.getElementById('adminExchangeRate');
const updateMinBtn = document.getElementById('updateMinStake');
const updateMaxBtn = document.getElementById('updateMaxStake');
const updateExchangeBtn = document.getElementById('updateExchangeRate');

// State
let userAddress = null;
let provider = null;
let signer = null;
let currentMultiplier = 1.9; 
let rawExchangeRate = 190n; // Basis points: 100 = 1.9x

// Smart Contract Config (Externalized to config.js via .env)
const {
    CONTRACT_ADDRESS,
    TARGET_CHAIN_ID,
    TARGET_CHAIN_NAME,
    TARGET_RPC_URL,
    TARGET_EXPLORER
} = window.GAME_CONFIG;

// ABI minimal for play & read
const ABI = [
    "function playGame() external payable returns (uint256)",
    "event GamePlayed(uint256 indexed gameId, address indexed player, uint256 betAmount)",
    "event GameResult(uint256 indexed gameId, uint8 playerCard, uint8 botCard, address winner, uint256 payout)",
    "function getAvailableBankroll() public view returns (uint256)",
    "function minStake() public view returns (uint256)",
    "function maxStake() public view returns (uint256)",
    "function exchangeRate() public view returns (uint256)",
    "function owner() public view returns (address)",
    "function totalFeesCollected() public view returns (uint256)",
    "function setMinStake(uint256) external",
    "function setMaxStake(uint256) external",
    "function setExchangeRate(uint256) external"
];

let sdk = null;

// ─────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    // try {
    //     // Initialize MetaMask SDK
    //     // ... skipping redundant initialization logs ...
    // } catch (e) {}

    if (window.ethereum) {
        setupEthereumListeners();
    }

    updateContractBalance();

    // Start Game Transition
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            landingPage.classList.add('hidden');
            gamePage.classList.remove('hidden');
            // Trigger a balance update and admin check once the interface is active
            updateContractBalance();
            if (userAddress) checkAdminStatus();
        });
    }
});

function setupEthereumListeners() {
    if (!window.ethereum) return;
    
    // Listen for account changes (user switching accounts in their wallet app)
    window.ethereum.on('accountsChanged', (newAccounts) => {
        log("Wallet account change detected.", "sys");
        if (newAccounts.length === 0) {
            disconnectWallet();
        } else {
            updateWalletUI(newAccounts[0]);
        }
    });

    // Listen for chain/network changes
    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}

// ─────────────────────────────────────────────────────────────────
// Web3 Wallet Connection
// ─────────────────────────────────────────────────────────────────

connectBtn.addEventListener('click', async () => {
    if (userAddress) {
        // Disconnect UI logic (usually users disconnect via MetaMask, but we reset UI)
        disconnectWallet();
        return;
    }

    if (!window.ethereum) {
        alert("Please install a Web3 wallet (e.g., MetaMask) to play for real tokens.");
        return;
    }

    try {
        log("Requesting authorization via SDK...", "sys");
        
        // Using wallet_requestPermissions forces MetaMask to sync the active account
        // or prompt the user to select one, fixing the "stale cached account" issue on reconnect.
        try {
            await window.ethereum.request({
                method: 'wallet_requestPermissions',
                params: [{ eth_accounts: {} }]
            });
        } catch (err) {
            if (err.code === 4001) {
                log("Connection rejected by user.", "err");
                return;
            }
        }

        // Fetch authorized accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Verify and switch network if needed
        await checkAndSwitchNetwork();

        // Initialize state variables
        userAddress = accounts[0];
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        updateWalletUI(userAddress);
        log("Wallet connected", "ok");

        // Listeners for account changes are now setup globally on DOMContentLoaded
        // to ensure we catch changes even if the user connects and then switches

    } catch (error) {
        log(`Connection failed: ${error.message}`, "err");
    }
});

function updateWalletUI(address) {
    userAddress = address;
    document.querySelector('.btn-content').innerText = "Disconnect";
    playerAddressText.innerText = formatAddress(address);
    playBtn.disabled = false;
    statusFeed.innerHTML = ""; // Clear on connect
    updateContractBalance();
    checkAdminStatus(); // Ensure gear icon shows if new account is owner
}

function disconnectWallet() {
    userAddress = null;
    signer = null;
    adminBtn.classList.add('hidden'); // Hide admin icon on disconnect
    document.querySelector('.btn-content').innerText = "Connect Wallet";
    playerAddressText.innerText = "0x...";
    playBtn.disabled = true;
    
    // Force SDK session clear to prevent stuck cached accounts
    if (sdk) {
        try {
            if (typeof sdk.disconnect === 'function') sdk.disconnect();
            else if (typeof sdk.terminate === 'function') sdk.terminate();
        } catch (e) {}
    }
    
    // Clear any local storage cache from the MetaMask SDK manually
    try {
        const sdkKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('MMSDK') || key.includes('metamask'))) {
                sdkKeys.push(key);
            }
        }
        sdkKeys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}

    log("Wallet disconnected", "sys");
}

async function checkAndSwitchNetwork() {
    if (!window.ethereum) return;
    
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    if (chainId !== TARGET_CHAIN_ID) {
        log(`Switching to ${TARGET_CHAIN_NAME}...`, "sys");
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: TARGET_CHAIN_ID }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: TARGET_CHAIN_ID,
                                chainName: TARGET_CHAIN_NAME,
                                rpcUrls: [TARGET_RPC_URL],
                                blockExplorerUrls: [TARGET_EXPLORER],
                                nativeCurrency: {
                                    name: "SCAI",
                                    symbol: "SCAI",
                                    decimals: 18,
                                },
                            },
                        ],
                    });
                } catch (addError) {
                    log("Failed to add SecureChain to wallet.", "err");
                }
            } else {
                log("Failed to switch network.", "err");
            }
        }
    }
}

async function checkAdminStatus() {
    if (!userAddress || !signer) return;
    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        const ownerAddr = await contract.owner();
        if (userAddress.toLowerCase() === ownerAddr.toLowerCase()) {
            adminBtn.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Owner check failed", e);
    }
}

// ─────────────────────────────────────────────────────────────────
// Admin Logic
// ─────────────────────────────────────────────────────────────────

adminBtn.addEventListener('click', async () => {
    adminModal.classList.remove('hidden');
    refreshAdminSettings();
});

closeAdminModal.addEventListener('click', () => {
    adminModal.classList.add('hidden');
});

async function refreshAdminSettings() {
    if (!signer) return;
    try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        const currentMin = await contract.minStake();
        const currentMax = await contract.maxStake();
        const exR = await contract.exchangeRate();
        const fees = await contract.totalFeesCollected();

        rawExchangeRate = BigInt(exR || 198);
        currentMultiplier = Number(rawExchangeRate) / 100;
        
        if (arenaMultiplierEl) arenaMultiplierEl.innerText = `Full Pay: ${currentMultiplier.toFixed(2)}x`;

        adminMinStakeInput.value = ethers.formatUnits(currentMin, 18);
        adminMaxStakeInput.value = ethers.formatUnits(currentMax, 18);
        adminExchangeRateInput.value = currentMultiplier.toString();
        
        // Update Fees Display if it exists in UI
        const feeDisplay = document.getElementById('adminFeesCollected');
        if (feeDisplay) feeDisplay.innerText = ethers.formatUnits(fees, 18);
    } catch (e) {
        console.error("Failed to load settings", e);
    }
}

updateMinBtn.addEventListener('click', async () => {
    try {
        const val = ethers.parseUnits(adminMinStakeInput.value, 18);
        const currentMax = ethers.parseUnits(adminMaxStakeInput.value, 18);
        if (val > currentMax) {
            log("Min Stake cannot exceed Max Stake", "err");
            return;
        }
        await callAdminSetter("setMinStake", val);
    } catch (e) { log("Invalid input", "err"); }
});

updateMaxBtn.addEventListener('click', async () => {
    try {
        const val = ethers.parseUnits(adminMaxStakeInput.value, 18);
        const currentMin = ethers.parseUnits(adminMinStakeInput.value, 18);
        if (val < currentMin) {
            log("Max Stake cannot be less than Min Stake", "err");
            return;
        }
        await callAdminSetter("setMaxStake", val);
    } catch (e) { log("Invalid input", "err"); }
});

updateExchangeBtn.addEventListener('click', async () => {
    try {
        const val = BigInt(Math.round(parseFloat(adminExchangeRateInput.value) * 100));
        await callAdminSetter("setExchangeRate", val);
    } catch (e) { log("Invalid input", "err"); }
});

async function callAdminSetter(method, value) {
    if (!signer) return;
    try {
        log("Broadcasting update...", "sys");
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        
        // Explicit Gas Pricing and Limit for SecureChain Stability
        const feeData = await provider.getFeeData();
        const tx = await contract[method](value, {
            gasPrice: feeData.gasPrice,
            gasLimit: 120000, // Explicit limit for non-payable state changes
            type: 0
        });

        log("Transaction sent", "sys");
        await tx.wait();
        log("Protocol updated", "ok");
        
        // Refresh local UI values
        refreshAdminSettings();
    } catch (e) {
        console.error("Admin Update Error:", e);
        let msg = "Update failed";
        if (e.message.includes("user rejected")) msg = "User rejected";
        else if (e.message.includes("insufficient funds")) msg = "Insufficient gas";
        else if (e.reason) msg = e.reason;
        
        log(msg.slice(0, 40), "err");
    }
}

// ─────────────────────────────────────────────────────────────────
// Game Logic
// ─────────────────────────────────────────────────────────────────

playBtn.addEventListener('click', async () => {
    const betStr = betAmountInput.value;
    const betNum = parseFloat(betStr);

    if (isNaN(betNum) || betNum <= 0) {
        log("Invalid bet amount.", "err");
        return;
    }

    statusFeed.innerHTML = ""; // Clear previous match logs
    log("Initializing match...", "sys");
    resetBoard();
    playBtn.disabled = true;

    if (!userAddress) {
        log("Please connect wallet first.", "err");
        playBtn.disabled = false;
        return;
    }

    await executeSmartContractTransaction(betStr);
});

playAgainBtn.addEventListener('click', () => {
    resultOverlay.classList.remove('visible');
    resetBoard();
    if (userAddress) playBtn.disabled = false;
});


async function executeSmartContractTransaction(betAmountStr) {
    try {
        // Safety: ensure on correct network before every spend
        await checkAndSwitchNetwork();
        
        // Give MetaMask a tiny moment to sync its internal state after a possible switch
        await new Promise(resolve => setTimeout(resolve, 500));

        const betWei = ethers.parseUnits(betAmountStr, 18);

        // Fetch fresh provider/signer
        const currentProvider = new ethers.BrowserProvider(window.ethereum);
        const currentSigner = await currentProvider.getSigner();

        // Step 2: Play game
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, currentSigner);

        // Robust validation: Ensure the right account is signing
        const currentAddr = await currentSigner.getAddress();
        if (currentAddr.toLowerCase() !== (userAddress || "").toLowerCase()) {
            userAddress = currentAddr;
            updateWalletUI(userAddress);
        }

        // Pre-check: House bankroll
        try {
            const bankroll = await contract.getAvailableBankroll();
            const requiredBankroll = (betWei * rawExchangeRate) / 100n;
            if (bankroll < requiredBankroll) {
                // Exact Max Bet = (bankroll * 100) / rawExchangeRate
                const maxBetWei = (bankroll * 100n) / rawExchangeRate;
                const maxBet = ethers.formatUnits(maxBetWei, 18);
                log(`Stake too high. Max bet is ${parseFloat(maxBet).toFixed(3)} SCAI`, "err");
                playBtn.disabled = false;
                return;
            }
        } catch (e) {
            console.warn("Bankroll pre-check skipped", e);
        }

        log("Confirm transaction in wallet", "sys");

        // Force Legacy Transaction (Type 0) for SecureChain compatibility
        const tx = await contract.playGame({
            value: betWei,
            gasPrice: (await currentProvider.getFeeData()).gasPrice,
            type: 0 
        });

        log("Transaction sent", "sys");
        const receipt = await tx.wait();

        log("Transaction successful", "ok");

        let pCard, bCard;

        // Try to parse GameResult event from logs
        try {
            const iface = new ethers.Interface(ABI);
            const gameResultLog = receipt.logs.find(l => {
                try {
                    const parsed = iface.parseLog(l);
                    return parsed && parsed.name === "GameResult";
                } catch (e) { return false; }
            });

            if (gameResultLog) {
                const parsed = iface.parseLog(gameResultLog);
                pCard = Number(parsed.args.playerCard);
                bCard = Number(parsed.args.botCard);
                log(`Verified outcome from blockchain: ${pCard} vs ${bCard}`, "sys");
            } else {
                throw new Error("GameResult event not found in logs.");
            }
        } catch (eventErr) {
            log("Warning: Could not verify cards from block. Using fallback reveal.", "err");
            pCard = Math.floor(Math.random() * 13) + 1;
            bCard = Math.floor(Math.random() * 13) + 1;
        }

        revealSequence(pCard, bCard, parseFloat(betAmountStr));
        updateContractBalance();

        updateContractBalance();

    } catch (e) {
        let errorMsg = e.message;

        // Try to extract reason from revert
        if (e.data && e.data.message) errorMsg = e.data.message;
        else if (e.reason) errorMsg = e.reason;
        else if (errorMsg.includes("user rejected")) errorMsg = "User rejected transaction.";
        else if (errorMsg.includes("insufficient funds")) errorMsg = "Insufficient ETH for gas.";

        log("Transaction failed: " + errorMsg.slice(0, 50), "err");
        console.error("Full Transaction Error:", e);
        playBtn.disabled = false;
    }
}

// ─────────────────────────────────────────────────────────────────
// UI Animations & Reveal Sequence
// ─────────────────────────────────────────────────────────────────

function resetBoard() {
    playerCard.classList.remove('flipped');
    botCard.classList.remove('flipped');

    setTimeout(() => {
        playerCardValue.innerHTML = '<span class="val">?</span>';
        botCardValue.innerHTML = '<span class="val">?</span>';
    }, 400);
}

const cardMap = {
    1: 'A', 11: 'J', 12: 'Q', 13: 'K'
};
function getCardDisplay(val) {
    return cardMap[val] || val.toString();
}

async function revealSequence(pCard, bCard, betAmt) {
    // 1. Flip Player Card
    log("Flipping Challenger card...", "sys");
    playerCardValue.innerHTML = `<span class="val">${getCardDisplay(pCard)}</span>`;
    playerCard.classList.add('flipped');

    await new Promise(r => setTimeout(r, 1200));

    // 2. Flip Bot Card
    log("Flipping House card...", "sys");
    botCardValue.innerHTML = `<span class="val">${getCardDisplay(bCard)}</span>`;
    botCard.classList.add('flipped');

    await new Promise(r => setTimeout(r, 1000));

    showResult(pCard, bCard, betAmt);
}

function showResult(pCard, bCard, betAmt) {
    resultOverlay.className = "result-box"; // reset classes
    if (pCard > bCard) {
        log(`Result: VICTORY for ${pCard} vs ${bCard}`, "ok");
        resultTitle.innerText = "VICTORY";
        resultSubtitle.innerText = `+${(betAmt * currentMultiplier).toFixed(2)} SCAI`;
        resultOverlay.classList.add('win');
    } else if (pCard < bCard) {
        log(`Result: DEFEAT for ${pCard} vs ${bCard}`, "err");
        resultTitle.innerText = "DEFEAT";
        resultSubtitle.innerText = `-${betAmt} SCAI`;
        resultOverlay.classList.add('loss');
    } else {
        log(`Result: STANDOFF on ${pCard}`, "sys");
        resultTitle.innerText = "DRAW";
        resultSubtitle.innerText = "Stake Returned";
        resultOverlay.classList.add('draw');
    }

    setTimeout(() => {
        resultOverlay.classList.add('visible');
    }, 500);
}

// Utilities
function log(msg, type = "sys") {
    statusFeed.innerHTML = ""; // Show only one at a time
    const el = document.createElement('div');
    el.className = `log-entry ${type}`;
    el.innerText = msg;
    statusFeed.appendChild(el);
}

function formatAddress(addr) {
    if (!addr) return "";
    // Show 0x + 5 characters (7 total) ... 4 characters at end
    return `${addr.substring(0, 7)}...${addr.substring(addr.length - 4)}`;
}

async function updateContractBalance() {
    if (!window.ethereum || !userAddress) {
        contractBalanceEl.innerText = `-- SCAI`;
        return;
    }

    try {
        const hexBalance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [userAddress, 'latest']
        });
        
        // Convert hex to BigInt explicitly to handle various RPC response formats
        const balanceBigInt = BigInt(hexBalance);
        const formatted = ethers.formatUnits(balanceBigInt, 18);
        
        contractBalanceEl.innerText = `${parseFloat(formatted).toFixed(4)} SCAI`;
    } catch (e) {
        console.error("Balance fetch error:", e);
        contractBalanceEl.innerText = "-- SCAI";
    }
}
