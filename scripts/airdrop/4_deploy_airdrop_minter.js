#!/usr/bin/env node
/*
 * Command to run script:
 *
 * $ HARDHAT_NETWORK=<network name> node scripts/<script filename> --arg1=val1 --arg2=val2
 */
require("dotenv").config();
const { argv } = require("yargs")
  .option("compile", {
    type: "boolean",
    default: true,
    description: "Compile contract using `compile:one`",
  })
  .option("maxFeePerGas", {
    type: "number",
    description: "Gas price in gwei; omitting uses default Ethers logic",
  })
  .option("maxPriorityFeePerGas", {
    type: "number",
    description: "Gas price in gwei; omitting uses default Ethers logic",
  });
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { getMaxFee, getMaxPriorityFee } = require("../gas");
const { getSafeSigner, waitForSafeTxDetails } = require("../safe");

const PROTOCOL_SAFE_ADDRESS = "0x00";
const DAO_TOKEN_ADDRESS = "0x00";
const DAO_VOTING_ESCROW_ADDRESS = "0x00";
const bonusInBps = 5000;

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  const networkName = network.name.toUpperCase();
  console.log("");
  console.log(`${networkName} selected`);
  console.log("");

  if (!process.env.SAFE_OWNER_KEY) {
    throw new Error("Must set SAFE_OWNER_KEY env var.");
  }
  const safeOwner = new ethers.Wallet(
    process.env.SAFE_OWNER_KEY,
    ethers.provider
  );
  console.log("Deployer: %s", safeOwner.address);
  const balance =
    (await ethers.provider.getBalance(safeOwner.address)).toString() / 1e18;
  console.log("ETH balance (Safe owner): %s", balance);

  const contractName = "AirdropMinter";
  console.log(`${contractName} deploy`);
  console.log("");

  if (argv.compile) {
    console.log("Compiling ...");
    await hre.run("clean");
    await hre.run("compile");
    await hre.run("compile:one", { contractName });
  }

  const maxFeePerGas = await getMaxFee(argv.maxFeePerGas);
  const maxPriorityFeePerGas = await getMaxPriorityFee(
    argv.maxPriorityFeePerGas
  );

  console.log("Deploying ... ");
  console.log("");

  const safeSigner = await getSafeSigner(
    PROTOCOL_SAFE_ADDRESS,
    safeOwner,
    networkName
  );

  const contractFactory = await ethers.getContractFactory(contractName);
  const contract = await contractFactory
    .connect(safeSigner)
    .deploy(DAO_TOKEN_ADDRESS, DAO_VOTING_ESCROW_ADDRESS, bonusInBps, {
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
  const receipt = await waitForSafeTxDetails(
    contract.deployTransaction,
    safeSigner.service
  );
  console.log("Contract address: %s", receipt.contractAddress);
  console.log("");

  console.log("Verifying on Etherscan ...");
  await hre.run("verify:verify", {
    address: contract.address,
    constructorArguments: [
      DAO_TOKEN_ADDRESS,
      DAO_VOTING_ESCROW_ADDRESS,
      bonusInBps,
    ],
  });
}

if (!module.parent) {
  main(argv)
    .then(() => {
      console.log("");
      console.log("Contract deployed.");
      console.log("");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      console.log("");
      process.exit(1);
    });
} else {
  module.exports = main;
}
