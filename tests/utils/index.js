const hre = require("hardhat");
const { ethers, web3 } = hre;
const { AddressZero: ZERO_ADDRESS, MaxUint256: MAX_UINT256 } = ethers.constants;
const { getAddress, impersonateAccount, setBalance } = require("./account.js");
const { acquireToken } = require("./token");
const {
  bytes32,
  tokenAmountToBigNumber,
  commify,
  formatUnits,
} = require("./unit");
const {
  getEip1967Addresses,
  getProxyAdmin,
  getLogicContract,
} = require("./proxy");

console.debug = function () {
  if (!console.debugging) return;
  console.log.apply(this, arguments);
};

console.debugging = false;

const FAKE_ADDRESS = web3.utils.toChecksumAddress(
  "0xCAFECAFECAFECAFECAFECAFECAFECAFECAFECAFE"
);
const ANOTHER_FAKE_ADDRESS = web3.utils.toChecksumAddress(
  "0xBAADC0FFEEBAADC0FFEEBAADC0FFEEBAADC0FFEE"
);

module.exports = {
  bytes32,
  console,
  getAddress,
  impersonateAccount,
  setBalance,
  tokenAmountToBigNumber,
  commify,
  formatUnits,
  acquireToken,
  ZERO_ADDRESS,
  MAX_UINT256,
  FAKE_ADDRESS,
  ANOTHER_FAKE_ADDRESS,
  getEip1967Addresses,
  getProxyAdmin,
  getLogicContract,
};
