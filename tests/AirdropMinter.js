const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, waffle, artifacts } = hre;
const { deployMockContract } = waffle;
const timeMachine = require("ganache-time-traveler");
const { tokenAmountToBigNumber, impersonateAccount } = require("./utils");

const ITimeLockToken = artifacts.readArtifactSync("ITimeLockToken");
const IVotingEscrow = artifacts.readArtifactSync("IVotingEscrow");
const DaoToken = artifacts.readArtifactSync("DaoToken");
const DaoVotingEscrow = artifacts.readArtifactSync("DaoVotingEscrow");
const IRewardDistributor = artifacts.readArtifactSync("IRewardDistributor");

const SECONDS_IN_DAY = 86400;
const BONUS_NUMERATOR = 100;
const BONUS_DENOMINATOR = 10000;

const APY_TOKEN_ADDRESS = "0x95a4492F028aa1fd432Ea71146b433E7B4446611";
const BLAPY_TOKEN_ADDRESS = "0xDC9EFf7BB202Fd60dE3f049c7Ec1EfB08006261f";
const APY_REWARD_DISTRIBUTOR_ADDRESS =
  "0x2E11558316df8Dde1130D81bdd8535f15f70B23d";

// default account 0 used in some old version of ganache
const DISTRIBUTOR_SIGNER_KEY =
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";

async function generateSignature(
  key,
  contract,
  nonce,
  recipient,
  amount,
  chain = 1
) {
  const domain = {
    name: "APY Distribution",
    version: "1",
    chainId: chain,
    verifyingContract: contract,
  };
  const types = {
    Recipient: [
      { name: "nonce", type: "uint256" },
      { name: "wallet", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  };
  const data = {
    nonce: nonce,
    wallet: recipient,
    amount: amount,
  };

  const provider = ethers.provider;
  const wallet = new ethers.Wallet(key, provider);
  let signature = await wallet._signTypedData(domain, types, data);
  signature = signature.slice(2);
  const r = "0x" + signature.substring(0, 64);
  const s = "0x" + signature.substring(64, 128);
  const v = parseInt(signature.substring(128, 130), 16);
  return { r, s, v };
}

function convertToCdxAmount(apyAmount) {
  return apyAmount.mul(271828182).div(100000000);
}

describe("AirdropMinter unit tests", () => {
  // signers
  let deployer;
  let user;

  // deployed contracts
  let minter;
  let daoToken;
  let daoVotingEscrow;
  // MAINNET contracts
  let govToken;
  let blApy;
  let rewardDistributor;

  // use EVM snapshots for test isolation
  let testSnapshotId;

  beforeEach(async () => {
    const snapshot = await timeMachine.takeSnapshot();
    testSnapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(testSnapshotId);
  });

  before("Upgrade Governance Token for time-lock functionality", async () => {
    [deployer, user] = await ethers.getSigners();
  });

  before("Setup mocked APY Token", async () => {
    const apyDeployerAddress = "0x7e9b0669018a70d6efcca2b11850a704db0e5b04";
    await hre.network.provider.send("hardhat_setNonce", [
      apyDeployerAddress,
      "0x2",
    ]);
    const apyDeployerSigner = await impersonateAccount(apyDeployerAddress);
    govToken = await deployMockContract(apyDeployerSigner, ITimeLockToken.abi);
    expect(govToken.address).to.equal(APY_TOKEN_ADDRESS);
  });

  before("Setup mocked BLAPY Token", async () => {
    const blApyDeployerAddress = "0xeb47c114b81c87980579340f491f28068e66578d";
    await hre.network.provider.send("hardhat_setNonce", [
      blApyDeployerAddress,
      "0xF",
    ]);
    const blApyDeployerSigner = await impersonateAccount(blApyDeployerAddress);
    blApy = await deployMockContract(blApyDeployerSigner, IVotingEscrow.abi);
    expect(blApy.address).to.equal(BLAPY_TOKEN_ADDRESS);
  });

  before("Setup mocked Reward Distributor", async () => {
    const rewardDistDeployerAddress =
      "0x6c38e52291db5f080e85ab7a9c9405f9750df7b9";
    await hre.network.provider.send("hardhat_setNonce", [
      rewardDistDeployerAddress,
      "0x0",
    ]);
    const rewardDistSigner = await impersonateAccount(
      rewardDistDeployerAddress
    );
    rewardDistributor = await deployMockContract(
      rewardDistSigner,
      IRewardDistributor.abi
    );
    expect(rewardDistributor.address).to.equal(APY_REWARD_DISTRIBUTOR_ADDRESS);
  });

  before("Deploy DAO token", async () => {
    daoToken = await deployMockContract(deployer, DaoToken.abi);
  });

  before("Deploy DAO Voting Escrow", async () => {
    daoVotingEscrow = await deployMockContract(deployer, DaoVotingEscrow.abi);
  });

  before("Deploy DAO token minter", async () => {
    const AirdropMinter = await ethers.getContractFactory("TestAirdropMinter");
    const bonusInBps = 100;
    minter = await AirdropMinter.deploy(
      daoToken.address,
      daoVotingEscrow.address,
      bonusInBps
    );
  });

  describe("Constructor", () => {
    it("Contract fails to deploy when passed invalid DAO address", async () => {
      const AirdropMinter = await ethers.getContractFactory("AirdropMinter");
      await expect(
        AirdropMinter.deploy(
          ethers.constants.AddressZero,
          daoVotingEscrow.address,
          100
        )
      ).to.be.revertedWith("INVALID_DAO_ADDRESS");
    });

    it("Contract fails to deploy when passed invalid Escrow address", async () => {
      const AirdropMinter = await ethers.getContractFactory("AirdropMinter");
      await expect(
        AirdropMinter.deploy(
          daoToken.address,
          ethers.constants.AddressZero,
          100
        )
      ).to.be.revertedWith("INVALID_ESCROW_ADDRESS");
    });
  });

  describe("isAirdropActive", () => {
    it("airdrop is inactive", async () => {
      await govToken.mock.lockEnd.returns(0);
      expect(await minter.isAirdropActive()).to.equal(false);
    });

    it("airdrop is active", async () => {
      await govToken.mock.lockEnd.returns(ethers.constants.MaxInt256);
      expect(await minter.isAirdropActive()).to.equal(true);
    });
  });

  describe("_claimAPY", () => {
    it("unsuccessfully claim ", async () => {
      const claimAmount = tokenAmountToBigNumber("123");
      const nonce = "0";
      const { v, r, s } = await generateSignature(
        DISTRIBUTOR_SIGNER_KEY,
        APY_REWARD_DISTRIBUTOR_ADDRESS,
        nonce,
        user.address,
        claimAmount
      );
      let recipientData = [nonce, user.address, claimAmount];
      await rewardDistributor.mock.claim.revertsWithReason("claiming failed");
      await expect(
        minter.testClaimApy(recipientData, v, r, s)
      ).to.be.revertedWith("claiming failed");
    });

    it("successfully claim ", async () => {
      const claimAmount = tokenAmountToBigNumber("123");
      const nonce = "0";
      const { v, r, s } = await generateSignature(
        DISTRIBUTOR_SIGNER_KEY,
        APY_REWARD_DISTRIBUTOR_ADDRESS,
        nonce,
        user.address,
        claimAmount
      );
      let recipientData = [nonce, user.address, claimAmount];
      await rewardDistributor.mock.claim.returns();
      await expect(minter.testClaimApy(recipientData, v, r, s)).to.not.be
        .reverted;
    });
  });

  describe("mint()", () => {
    it("Calls external contracts with the right args", async () => {
      const apyAmt = ethers.BigNumber.from(1029);
      await govToken.mock.lockEnd.returns(ethers.constants.MaxInt256);
      await govToken.mock.unlockedBalance.returns(apyAmt);

      // first, the right APY amount has to be locked by the APY Gov Token;
      // 1. only revert if the call is made with right args
      await govToken.mock.lockAmount
        .withArgs(user.address, apyAmt)
        .revertsWithReason("PASS_THE_TEST_1");
      await expect(minter.connect(user).mint()).to.be.revertedWith(
        "PASS_THE_TEST_1"
      );
      // 2. now that we know the call is made, undo revert
      await govToken.mock.lockAmount.withArgs(user.address, apyAmt).returns();

      // lastly, the right CXD amount needs to be minted;
      // only revert if the call is made with right args
      const cdxAmt = convertToCdxAmount(apyAmt);
      await daoToken.mock.mint
        .withArgs(user.address, cdxAmt)
        .revertsWithReason("PASS_THE_TEST_2");
      await expect(minter.connect(user).mint()).to.be.revertedWith(
        "PASS_THE_TEST_2"
      );
    });
  });

  describe("mintLocked()", () => {
    it("Revert when no locked amount", async () => {
      await govToken.mock.lockEnd.returns(ethers.constants.MaxInt256);
      const blApyLockedAmt = 0;
      const blApyLockEnd = 99;
      await blApy.mock.locked.returns([blApyLockedAmt, blApyLockEnd]);
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "NO_BOOST_LOCKED_AMOUNT"
      );
    });

    it("Revert when boost lock ends too early", async () => {
      const apyAmt = ethers.BigNumber.from(1029);
      const timestamp = (await ethers.provider.getBlock()).timestamp;
      const lockEnd = timestamp + SECONDS_IN_DAY * 7;
      await govToken.mock.lockEnd.returns(lockEnd);
      await blApy.mock.locked.returns([apyAmt, lockEnd - 1]);
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "BOOST_LOCK_ENDS_TOO_EARLY"
      );
    });

    it("Calls external contracts with the right args", async () => {
      const apyAmt = ethers.BigNumber.from(1029);
      const timestamp = (await ethers.provider.getBlock()).timestamp;
      const lockEnd = timestamp + SECONDS_IN_DAY * 7;
      await govToken.mock.lockEnd.returns(lockEnd);
      await blApy.mock.locked.returns([apyAmt, lockEnd]);
      const blApyBalance = tokenAmountToBigNumber("2187");
      await blApy.mock.balanceOf.withArgs(user.address).returns(blApyBalance);

      // first, the right CXD amount needs to be minted
      // 1. only revert if the call is made with the right args
      const cdxAmount = convertToCdxAmount(apyAmt);
      const unconvertedBonus = blApyBalance
        .mul(BONUS_NUMERATOR)
        .div(BONUS_DENOMINATOR);
      const bonus = convertToCdxAmount(unconvertedBonus);
      const cdxAmountWithBonus = cdxAmount.add(bonus);
      await daoToken.mock.mint
        .withArgs(user.address, cdxAmountWithBonus)
        .revertsWithReason("PASS_THE_TEST_1");
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "PASS_THE_TEST_1"
      );
      // 2. now that we know the call is made, undo revert
      await daoToken.mock.mint
        .withArgs(user.address, cdxAmountWithBonus)
        .returns();

      // lastly, the CXD lock needs to be created;
      // revert only if the call is made with the right args
      await daoVotingEscrow.mock.create_lock_for
        .withArgs(user.address, cdxAmount, lockEnd)
        .revertsWithReason("PASS_THE_TEST_2");
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "PASS_THE_TEST_2"
      );
    });
  });
});
