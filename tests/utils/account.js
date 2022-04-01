const hre = require("hardhat");
const { ethers } = hre;
const { tokenAmountToBigNumber } = require("./unit");

/**
 * Impersonate an account through either Hardhat node or Ganache.
 * @param {address|signer|contract} account - an "account-like" object
 *    with either a `getAddress` function or `address` property.
 *    Allowed to be an address string.
 * @param {Number|string} [ethBalance=5] - new balance of Ether (in big units)
 *    for the impersonated account.
 * @returns signer for unlocked account
 */
async function impersonateAccount(account, ethBalance) {
  const address = await getAddress(account);
  try {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });
  } catch {
    // fallback to ganache method
    await hre.network.provider.request({
      method: "evm_unlockUnknownAccount",
      params: [address],
    });
  }

  await setBalance(address, ethBalance);

  const signer = await ethers.getSigner(address);
  return signer;
}

/**
 * Get the address from various Ethers (& Hardhat) account abstractions.
 * @param {address|signer|contract} account - an "account-like" object
 *    with either a `getAddress` function or `address` property.
 *    Allowed to be an address string.
 * @returns address of account
 */
async function getAddress(object) {
  if (ethers.Signer.isSigner(object)) {
    return await object.getAddress();
  } else if (typeof object === "object" && "address" in object) {
    return object.address;
  } else if (typeof object === "string") {
    return ethers.utils.getAddress(object);
  } else {
    throw new Error("getAddress: argument type is not recognized.");
  }
}

/**
 * Set the ETH balance of given account in Hardhat.
 * @param {address|signer|contract} account - an "account-like" object
 *    with either a `getAddress` function or `address` property.
 *    Allowed to be an address string.
 * @param {Number|string} [ethBalance=5] - new balance of Ether (in big units)
 */
async function setBalance(account, ethBalance) {
  const address = await getAddress(account);
  ethBalance = ethBalance || 5;
  const newBalance = tokenAmountToBigNumber(ethBalance);

  // This is necessary because hex quantities with leading zeros are not valid at the JSON-RPC layer
  // See https://github.com/nomiclabs/hardhat/issues/1585
  let newBalanceHex = newBalance.toHexString().replace(/0x0+/, "0x");
  if (newBalanceHex === "0x") {
    newBalanceHex = "0x0;";
  }

  await hre.network.provider.send("hardhat_setBalance", [
    address,
    newBalanceHex,
  ]);
}

module.exports = {
  impersonateAccount,
  getAddress,
  setBalance,
};
