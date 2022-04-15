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
  await hre.run("clean");
  await hre.run("compile");

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

  const contractName = "DaoVotingEscrow";
  console.log(`${contractName} deploy`);
  console.log("");

  const maxFeePerGas = await getMaxFee(argv.maxFeePerGas);
  const maxPriorityFeePerGas = await getMaxPriorityFee(
    argv.maxPriorityFeePerGas
  );

  console.log("Deploying ... ");
  console.log("");

  const safeSigner = await getSafeSigner(
    networkName,
    PROTOCOL_SAFE_ADDRESS,
    safeOwner
  );

  const obj = getJson(ADDRESSES_PATH);
  const DAO_TOKEN_ADDRESS = obj["DAO_TOKEN_PROXY"];
  console.log("DAO Token: %s", DAO_TOKEN_ADDRESS);
  console.log("");

  const contractFactory = await ethers.getContractFactory(contractName);
  const contract = await contractFactory.connect(safeSigner).deploy(
    DAO_TOKEN_ADDRESS, // token
    "Vote Locked CXD", // name
    "vlCXD", // symbol
    "1.0.0", // version
    { maxFeePerGas, maxPriorityFeePerGas }
  );
  const receipt = await waitForSafeTxReceipt(
    contract.deployTransaction,
    safeSigner.service
  );
  console.log("Contract address: %s", receipt.contractAddress);
  console.log("");

  obj["VOTING_ESCROW"] = receipt.contractAddress;
  saveJson(ADDRESSES_PATH, obj);

  console.log("Verify manually on the etherscan website.");
  // can't verify vyper contracts through hardhat; must do through
  // Etherscan website using this bytecode for the constructor args:
  // (replace FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF with dao token address)
  //
  // vyper version 0.2.4
  // 0000000000000000000000005A56Da75c50aA2733F5Fa9A2442AaEfcBc60B2e6000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000f566f7465204c6f636b65642043584400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005766c4358440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005312e302e30000000000000000000000000000000000000000000000000000000
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
