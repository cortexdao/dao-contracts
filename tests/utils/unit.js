const hre = require("hardhat");
const { ethers } = hre;
const { BigNumber } = ethers;

const bytes32 = ethers.utils.formatBytes32String;
const commify = ethers.utils.commify;
const formatUnits = ethers.utils.formatUnits;

const tokenAmountToBigNumber = (amount, decimals) => {
  if (BigNumber.isBigNumber(amount)) return amount;

  amount = amount.toString();
  if (decimals == undefined) decimals = "18";
  decimals = decimals.toString();
  let [wholePart, fracPart] = amount.split(".");
  fracPart = fracPart || "0";
  if (fracPart != "0" && fracPart.length > decimals) {
    throw new Error(
      "Cannot convert ERC20 token amount to bits: decimal part is too long."
    );
  }
  while (fracPart.length < decimals) {
    fracPart += "0";
  }
  fracPart = BigNumber.from(fracPart);
  wholePart = BigNumber.from(wholePart || "0");

  const base = BigNumber.from("10").pow(BigNumber.from(decimals));
  const amountBits = wholePart.mul(base).add(fracPart);

  amount = BigNumber.from(amountBits.toString());
  return amount;
};

module.exports = {
  bytes32,
  tokenAmountToBigNumber,
  commify,
  formatUnits,
};
