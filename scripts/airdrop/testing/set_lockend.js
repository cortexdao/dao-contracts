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
const { impersonateAccount } = require("../../../tests/utils");

const APY_TOKEN_ADDRESS = "0x95a4492F028aa1fd432Ea71146b433E7B4446611";

// eslint-disable-next-line no-unused-vars
async function main(argv) {
  const networkName = network.name.toUpperCase();
  console.log("");
  console.log(`${networkName} selected`);
  console.log("");

  let lockEnd = argv.lockEnd;
  if (lockEnd === undefined) {
    console.log(
      "`lockEnd` arg not supplied.  Defaulting to one week from current timestamp."
    );
    const currentTimestamp = (await ethers.provider.getBlock()).timestamp;
    lockEnd = currentTimestamp + 7 * 86400;
  }

  console.log("Setting lockEnd on APY token ...");
  const apyToken = await ethers.getContractAt(
    "ITimeLockToken",
    APY_TOKEN_ADDRESS
  );
  const apyDeployer = await impersonateAccount(await apyToken.owner());
  await apyToken.connect(apyDeployer).setLockEnd(lockEnd);
  console.log("Set `lockEnd`: %s", lockEnd);
  console.log("");
}

if (!module.parent) {
  main(argv)
    .then(() => {
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
