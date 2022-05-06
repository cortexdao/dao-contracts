#!/usr/bin/env node
/*
 * Command to run script:
 *
 * $ HARDHAT_NETWORK=<network name> node scripts/<script filename> --arg1=val1 --arg2=val2
 */
require("dotenv").config();
const { argv } = require("yargs");
const hre = require("hardhat");
const { ethers, network } = hre;
const { getJson } = require("../../json");
const { impersonateAccount } = require("../../../tests/utils");

const ADDRESSES_PATH = "./airdrop/addresses.json";
const PROTOCOL_SAFE_ADDRESS = "0x2A208EC9144e6380016aD51a529B354aE1dD5D7d";
const APY_TOKEN_ADDRESS = "0x95a4492F028aa1fd432Ea71146b433E7B4446611";

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  const networkName = network.name.toUpperCase();
  console.log("");
  console.log(`${networkName} selected`);
  console.log("");

  const addressesJson = getJson(ADDRESSES_PATH);
  const airdropMinterAddress = addressesJson["AIRDROP_MINTER"];
  const airdropMinter = await ethers.getContractAt(
    "AirdropMinter",
    airdropMinterAddress
  );
  console.log("Airdrop Minter: %s", airdropMinterAddress);
  console.log("");

  console.log("Giving APY locker permission to Airdrop Minter ...");
  const apyToken = await ethers.getContractAt(
    "ITimeLockToken",
    APY_TOKEN_ADDRESS
  );
  const apyDeployer = await impersonateAccount(await apyToken.owner());
  await apyToken.connect(apyDeployer).addLocker(airdropMinter.address);
  console.log("Done.");
  console.log("");

  console.log("Giving DAO token minter role to Airdrop Minter ...");
  const daoTokenAddress = addressesJson["DAO_TOKEN_PROXY"];
  const daoToken = await ethers.getContractAt("DaoToken", daoTokenAddress);
  const protocolSafe = await impersonateAccount(PROTOCOL_SAFE_ADDRESS);
  const MINTER_ROLE = await daoToken.MINTER_ROLE();
  await daoToken
    .connect(protocolSafe)
    .grantRole(MINTER_ROLE, airdropMinter.address);
  console.log("Done.");
  console.log("");
}

if (!module.parent) {
  main(argv)
    .then(() => {
      console.log("");
      console.log("Permissions given to Airdrop Minter.");
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
