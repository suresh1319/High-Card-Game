const hre = require("hardhat");

async function main() {
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    
    console.log(`Checking Contract State...`);
    const BotHighCardGame = await hre.ethers.getContractAt("BotHighCardGame", CONTRACT_ADDRESS);
    
    const balance = await hre.ethers.provider.getBalance(CONTRACT_ADDRESS);
    const fees = await BotHighCardGame.totalFeesCollected();
    const minStake = await BotHighCardGame.minStake();
    const bankroll = await BotHighCardGame.getAvailableBankroll();
    const exchangeRate = await BotHighCardGame.exchangeRate();

    console.log(`-----------------------------------`);
    console.log(`Total Balance:     ${balance.toString()} wei (${hre.ethers.formatEther(balance)} SCAI)`);
    console.log(`Fees Collected:    ${fees.toString()} wei`);
    console.log(`Available Bank:   ${bankroll.toString()} wei`);
    console.log(`Min Stake:         ${minStake.toString()} wei`);
    console.log(`Exchange Rate:     ${exchangeRate.toString()} (Multiplier: ${(Number(exchangeRate)/100).toFixed(2)}x)`);
    console.log(`-----------------------------------`);
    
    if (bankroll === 0n) {
        console.log("WARNING: Bankroll is EMPTY. The house cannot pay winners.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
