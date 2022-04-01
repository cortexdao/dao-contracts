const hre = require("hardhat");
const { ethers } = hre;

const LOGIC_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

async function getEip1967Addresses(proxyAddress) {
  const logicAddress = await getLogicAddress(proxyAddress);
  const proxyAdminAddress = await getProxyAdminAddress(proxyAddress);
  return [logicAddress, proxyAdminAddress];
}

async function getProxyAdminAddress(proxyAddress) {
  // get admin address from slot specified by EIP-1967
  let proxyAdminAddress = await ethers.provider.getStorageAt(
    proxyAddress,
    ADMIN_SLOT
  );
  proxyAdminAddress = ethers.utils.getAddress(proxyAdminAddress.slice(-40));
  return proxyAdminAddress;
}

async function getLogicAddress(proxyAddress) {
  // get logic address from slot specified by EIP-1967
  let logicAddress = await ethers.provider.getStorageAt(
    proxyAddress,
    LOGIC_SLOT
  );
  logicAddress = ethers.utils.getAddress(logicAddress.slice(-40));
  return logicAddress;
}

async function getProxyAdmin(proxyAddress) {
  const proxyAdminAddress = await getProxyAdminAddress(proxyAddress);
  const proxyAdmin = await ethers.getContractAt(
    "ProxyAdmin",
    proxyAdminAddress
  );
  return proxyAdmin;
}

async function getLogicContract(proxyAddress, nameOrAbi) {
  const logicAddress = await getLogicAddress(proxyAddress);
  const logic = await ethers.getContractAt(nameOrAbi, logicAddress);
  return logic;
}

module.exports = {
  getEip1967Addresses,
  getProxyAdmin,
  getLogicContract,
};
