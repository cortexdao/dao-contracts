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
const {
  impersonateAccount,
  tokenAmountToBigNumber,
} = require("../../../tests/utils");

const ADDRESSES_PATH = "./airdrop/addresses.json";
const APY_TOKEN_ADDRESS = "0x95a4492F028aa1fd432Ea71146b433E7B4446611";

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  const networkName = network.name.toUpperCase();
  console.log("");
  console.log(`${networkName} selected`);
  console.log("");

  const [deployer] = await ethers.getSigners();

  const addressesJson = getJson(ADDRESSES_PATH);
  const airdropMinterAddress = addressesJson["AIRDROP_MINTER"];
  const airdropMinter = await ethers.getContractAt(
    "AirdropMinter",
    airdropMinterAddress
  );
  console.log("Airdrop Minter: %s", airdropMinterAddress);
  console.log("");

  console.log("Supply account 0 with some APY ...");
  const apyToken = await ethers.getContractAt(
    "ITimeLockToken",
    APY_TOKEN_ADDRESS
  );
  const apyDeployer = await impersonateAccount(await apyToken.owner());
  await apyToken
    .connect(apyDeployer)
    .transfer(deployer.address, tokenAmountToBigNumber("100"));

  const daoTokenAddress = addressesJson["DAO_TOKEN_PROXY"];
  const daoToken = await ethers.getContractAt("DaoToken", daoTokenAddress);
  console.log(
    "CXD balance before mint: %s",
    await daoToken.balanceOf(deployer.address)
  );
  await airdropMinter.connect(deployer).mint();
  console.log(
    "CXD balance after mint: %s",
    await daoToken.balanceOf(deployer.address)
  );
}

if (!module.parent) {
  main(argv)
    .then(() => {
      console.log("");
      console.log("Tested mint.");
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
