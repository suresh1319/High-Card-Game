const hre = require("hardhat");

async function main() {
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    const amount = hre.ethers.parseEther("50");

    console.log(`Withdrawing 50 SCAI from House Bankroll...`);
    
    // Get the signers
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);

    // Get the contract instance
    const BotHighCardGame = await hre.ethers.getContractAt("BotHighCardGame", CONTRACT_ADDRESS);

    // Call withdrawHouseFunds
    const tx = await BotHighCardGame.withdrawHouseFunds(amount);

    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`Successfully withdrawn 50 SCAI from House Bankroll!`);

    const balance = await hre.ethers.provider.getBalance(CONTRACT_ADDRESS);
    console.log(`Remaining Contract Balance: ${hre.ethers.formatEther(balance)} SCAI`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
