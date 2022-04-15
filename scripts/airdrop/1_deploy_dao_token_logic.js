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
const { getJson, saveJson } = require("../json");
const { getSafeSigner, waitForSafeTxReceipt } = require("../safe");

const ADDRESSES_PATH = "./airdrop/addresses.json";

const PROTOCOL_SAFE_ADDRESS = "0x2A208EC9144e6380016aD51a529B354aE1dD5D7d";

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
  console.log("Safe Owner: %s", safeOwner.address);
  const balance =
    (await ethers.provider.getBalance(safeOwner.address)).toString() / 1e18;
  console.log("ETH balance: %s", balance);
  console.log("");

  const contractName = "DaoToken";
  console.log(`${contractName} deploy`);
  console.log("");

  if (argv.compile) {
    console.log("Compiling ...");
    await hre.run("clean");
    await hre.run("compile");
    await hre.run("compile:one", { contractName });
  }

  let maxFeePerGas = await getMaxFee(argv.maxFeePerGas);
  let maxPriorityFeePerGas = await getMaxPriorityFee(argv.maxPriorityFeePerGas);

  console.log("Deploying ... ");
  console.log("");

  const safeSigner = await getSafeSigner(
    networkName,
    PROTOCOL_SAFE_ADDRESS,
    safeOwner
  );

  const contractFactory = await ethers.getContractFactory(contractName);
  const contract = await contractFactory
    .connect(safeSigner)
    .deploy({ maxFeePerGas, maxPriorityFeePerGas });
  const receipt = await waitForSafeTxReceipt(
    contract.deployTransaction,
    safeSigner.service
  );
  console.log("Contract address: %s", receipt.contractAddress);
  console.log("");

  const obj = getJson(ADDRESSES_PATH);
  obj["DAO_TOKEN_LOGIC"] = receipt.contractAddress;
  saveJson(ADDRESSES_PATH, obj);

  maxFeePerGas = await getMaxFee(argv.maxFeePerGas);
  maxPriorityFeePerGas = await getMaxPriorityFee(argv.maxPriorityFeePerGas);

  console.log("Initializing ... ");
  console.log("");
  const tx = await contract
    .connect(safeSigner)
    .initialize({ maxFeePerGas, maxPriorityFeePerGas });
  await tx.wait(2);

  console.log("Verifying on Etherscan ...");
  await hre.run("verify:verify", {
    address: contract.address,
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
