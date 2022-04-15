const chalk = require("chalk");
const hre = require("hardhat");
const { ethers } = hre;
const { BigNumber } = ethers;

// Current Ethers default logic is to take
//    maxFeePerGas = block.baseFeePerGas.mul(2).add(maxPriorityFeePerGas);
// See:
// https://github.com/ethers-io/ethers.js/blob/da4e107268b380a844dc6d303d28f957a2bd4c88/packages/abstract-provider/src.ts/index.ts#L242
async function getMaxFee(maxFeePerGas) {
  if (maxFeePerGas) {
    console.log(
      "Using provided max fee (gwei): %s",
      chalk.yellow(maxFeePerGas)
    );
    maxFeePerGas = BigNumber.from(maxFeePerGas * 1e9);
  } else {
    const feeData = await ethers.provider.getFeeData(); // values are BigNumber and in wei, not gwei
    maxFeePerGas = feeData.maxFeePerGas;
    console.log(
      "Max fee (gwei): %s",
      chalk.yellow(maxFeePerGas.toString() / 1e9)
    );
  }
  return maxFeePerGas;
}

async function getMaxPriorityFee(maxPriorityFeePerGas) {
  if (maxPriorityFeePerGas) {
    console.log(
      "Using provided max fee (gwei): %s",
      chalk.yellow(maxPriorityFeePerGas)
    );
    maxPriorityFeePerGas = BigNumber.from(maxPriorityFeePerGas * 1e9);
  } else {
    const feeData = await ethers.provider.getFeeData(); // values are BigNumber and in wei, not gwei
    maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    console.log(
      "Max priority fee (gwei): %s",
      chalk.yellow(maxPriorityFeePerGas.toString() / 1e9)
    );
  }
  return maxPriorityFeePerGas;
}

module.exports = {
  getMaxFee,
  getMaxPriorityFee,
};
