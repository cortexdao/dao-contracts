const { tokenAmountToBigNumber } = require("./unit");
const { getAddress, impersonateAccount } = require("./account.js");

/**
 * @param sender: address, holds the tokens to be sent
 * @param recipient: address, receives the tokens
 * @param token: contract instance of token (ethers)
 * @param amount: BigNumber or string, should be in big units not wei if string
 */
async function acquireToken(sender, recipient, token, amount) {
  sender = await getAddress(sender);
  recipient = await getAddress(recipient);

  const decimals = await token.decimals();
  amount = tokenAmountToBigNumber(amount, decimals);

  const fundAccountSigner = await impersonateAccount(sender, "10");

  const trx = await token
    .connect(fundAccountSigner)
    .transfer(recipient, amount);
  await trx.wait();
  const balance = (await token.balanceOf(recipient)).toString();
  const symbol = await token.symbol();
  console.debug(`${symbol} balance: ${balance / 10 ** decimals}`);
}

module.exports = {
  acquireToken,
};
