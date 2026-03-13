const hre = require("hardhat");

async function main() {
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    const amount = hre.ethers.parseEther("10");

    console.log(`Funding House Bankroll with 10 SCAI...`);
    
    // Get the signers
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);

    // Get the contract instance
    const BotHighCardGame = await hre.ethers.getContractAt("BotHighCardGame", CONTRACT_ADDRESS);

    // Call depositHouseFunds with 50 SCAI
    const tx = await BotHighCardGame.depositHouseFunds({
        value: amount
    });

    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`Successfully deposited ${hre.ethers.formatEther(amount)} SCAI to House Bankroll!`);

    const balance = await hre.ethers.provider.getBalance(CONTRACT_ADDRESS);
    console.log(`New Contract Balance: ${hre.ethers.formatEther(balance)} SCAI`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
