const hre = require("hardhat");
const { ethers } = hre;

async function setBlockTime(timestamp) {
  timestamp = timestamp.toNumber();
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await ethers.provider.send("evm_mine");
}

module.exports = {
  setBlockTime,
};
