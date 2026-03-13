const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy BotHighCardGame Contract
    const minStake = hre.ethers.parseUnits("0.1", 18);   // 0.1 SCAI
    const maxStake = hre.ethers.parseUnits("1000", 18); // 1000 SCAI
    const protocolFeeBps = 100; // 1%
    const exchangeRate = 198; // 1.98x (basis points 100 = 1x)

    const Game = await hre.ethers.getContractFactory("BotHighCardGame");
    const game = await Game.deploy(minStake, maxStake, protocolFeeBps, exchangeRate);
    await game.waitForDeployment();
    const gameAddress = await game.getAddress();
    console.log("BotHighCardGame deployed to:", gameAddress);

    // Fund House Bankroll (e.g. 1 SCAI for local testing)
    console.log("Depositing house funds...");
    const houseFunds = hre.ethers.parseUnits("1", 18);

    const depositTx = await game.depositHouseFunds({ value: houseFunds });
    await depositTx.wait();

    // Update Frontend config (app.js) and .env with real values
    const appJsPath = path.join(__dirname, '..', 'app.js');
    // Update .env with real values
    if (fs.existsSync(envPath)) {
        let envVal = fs.readFileSync(envPath, 'utf8');
        
        // Update CONTRACT_ADDRESS in .env
        if (envVal.includes("CONTRACT_ADDRESS=")) {
            envVal = envVal.replace(/CONTRACT_ADDRESS=0x[a-fA-F0-9]{40}/, `CONTRACT_ADDRESS=${gameAddress}`);
        } else {
            envVal += `\nCONTRACT_ADDRESS=${gameAddress}`;
        }

        fs.writeFileSync(envPath, envVal);
        console.log("Updated .env with new contract address");
        
        // Trigger config sync for frontend
        console.log("Syncing frontend config...");
        require('./sync_config.js');
    }

    console.log("==========================================");
    console.log("Deployment Complete!");
    console.log("Game Contract:", gameAddress);
    console.log("Contract Bankroll:", hre.ethers.formatUnits(houseFunds, 18), "SCAI");
    console.log("==========================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
