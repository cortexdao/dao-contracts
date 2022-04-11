const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const timeMachine = require("ganache-time-traveler");
const { tokenAmountToBigNumber, impersonateAccount } = require("./utils");

const SECONDS_IN_DAY = 86400;
const SECONDS_IN_WEEK = SECONDS_IN_DAY * 7;
const pinnedBlock = 14541023;
const forkingUrl = hre.config.networks.hardhat.forking.url;

const GOV_TOKEN_ADDRESS = "0x95a4492F028aa1fd432Ea71146b433E7B4446611";
const BLAPY_TOKEN_ADDRESS = "0xDC9EFf7BB202Fd60dE3f049c7Ec1EfB08006261f";
const REWARD_DISTRIBUTOR_ADDRESS = "0x2E11558316df8Dde1130D81bdd8535f15f70B23d";

// default account 0 used in some old version of ganache
const DISTRIBUTOR_SIGNER = "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";
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

describe("AirdropMinter - APY Gov Token integration", () => {
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

  // use EVM snapshots for test isolation
  let testSnapshotId;

  beforeEach(async () => {
    const snapshot = await timeMachine.takeSnapshot();
    testSnapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(testSnapshotId);
  });

  before("Use newer pinned block for recently deployed contracts", async () => {
    await hre.network.provider.send("hardhat_reset", [
      {
        forking: {
          jsonRpcUrl: forkingUrl,
          blockNumber: pinnedBlock,
        },
      },
    ]);
  });

  after("Undo mainnet forking", async () => {
    await hre.network.provider.send("hardhat_reset", []);
  });

  before("Attach to APY Governance Token", async () => {
    [deployer, user] = await ethers.getSigners();

    govToken = await ethers.getContractAt(
      "IApyGovernanceToken",
      GOV_TOKEN_ADDRESS
    );
    const apyDeployer = await impersonateAccount(await govToken.owner(), 1000);
    await govToken.connect(apyDeployer).transferOwnership(deployer.address);
  });

  before("Attach to blAPY contract", async () => {
    blApy = await ethers.getContractAt("IVotingEscrow", BLAPY_TOKEN_ADDRESS);
  });

  before("Deploy DAO token", async () => {
    const DaoToken = await ethers.getContractFactory("DaoToken");
    const logic = await DaoToken.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy();

    const TransparentUpgradeableProxy = await ethers.getContractFactory(
      "TransparentUpgradeableProxy"
    );
    const initData = await logic.interface.encodeFunctionData(
      "initialize()",
      []
    );
    const proxy = await TransparentUpgradeableProxy.deploy(
      logic.address,
      proxyAdmin.address,
      initData
    );

    daoToken = await DaoToken.attach(proxy.address);
  });

  before("Deploy DAO Voting Escrow", async () => {
    const DaoVotingEscrow = await ethers.getContractFactory("DaoVotingEscrow");
    daoVotingEscrow = await DaoVotingEscrow.deploy(
      daoToken.address,
      "Boost-Lock CXD",
      "blCXD",
      "1.0.0"
    );
  });

  before("Deploy DAO token minter", async () => {
    const AirdropMinter = await ethers.getContractFactory("AirdropMinter");
    minter = await AirdropMinter.deploy(
      daoToken.address,
      daoVotingEscrow.address
    );
  });

  describe("Constructor", () => {
    it("Contract fails to deploy when passed invalid DAO address", async () => {
      const AirdropMinter = await ethers.getContractFactory("AirdropMinter");
      await expect(
        AirdropMinter.deploy(
          ethers.constants.AddressZero,
          daoVotingEscrow.address
        )
      ).to.be.revertedWith("INVALID_DAO_ADDRESS");
    });

    it("Contract fails to deploy when passed invalid Escrow address", async () => {
      const AirdropMinter = await ethers.getContractFactory("AirdropMinter");
      await expect(
        AirdropMinter.deploy(daoToken.address, ethers.constants.AddressZero)
      ).to.be.revertedWith("INVALID_ESCROW_ADDRESS");
    });
  });

  describe("Defaults", () => {
    it("Storage variable are set correctly", async () => {
      expect(await minter.APY_TOKEN_ADDRESS()).to.equal(govToken.address);
      expect(await minter.BLAPY_TOKEN_ADDRESS()).to.equal(blApy.address);
      expect(await minter.DAO_TOKEN_ADDRESS()).to.equal(daoToken.address);
      expect(await minter.VE_TOKEN_ADDRESS()).to.equal(daoVotingEscrow.address);
    });

    it("Mint fails", async () => {
      await expect(minter.connect(user).mint()).to.be.revertedWith(
        "AIRDROP_INACTIVE"
      );
    });

    it("Mint Locked fails", async () => {
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "AIRDROP_INACTIVE"
      );
    });

    it("Claim APY and mint fails", async () => {
      const claimAmount = tokenAmountToBigNumber("123");
      const nonce = "0";
      const { v, r, s } = await generateSignature(
        DISTRIBUTOR_SIGNER_KEY,
        REWARD_DISTRIBUTOR_ADDRESS,
        nonce,
        user.address,
        claimAmount
      );
      let recipientData = [nonce, user.address, claimAmount];
      await expect(
        minter.connect(user).claimApyAndMint(recipientData, v, r, s)
      ).to.be.revertedWith("AIRDROP_INACTIVE");
    });
  });

  describe("Regular mint", () => {
    let userBalance;

    // use EVM snapshots for test isolation
    let snapshotId;

    before(async () => {
      const snapshot = await timeMachine.takeSnapshot();
      snapshotId = snapshot["result"];
    });

    after(async () => {
      await timeMachine.revertToSnapshot(snapshotId);
    });

    before("Set lock end", async () => {
      const timestamp = (await ethers.provider.getBlock()).timestamp;
      const lockEnd = timestamp + SECONDS_IN_DAY * 7;
      await govToken.connect(deployer).setLockEnd(lockEnd);
    });

    before("Add minter as APY locker", async () => {
      await govToken.connect(deployer).addLocker(minter.address);
    });

    before("Add minter as DAO token minter", async () => {
      await daoToken.connect(deployer).setMinter(minter.address);
    });

    before("Prepare user APY balance", async () => {
      userBalance = tokenAmountToBigNumber("1000");
      await govToken.connect(deployer).transfer(user.address, userBalance);
    });

    it("Successfully mint DAO tokens", async () => {
      expect(await daoToken.balanceOf(user.address)).to.equal(0);
      await minter.connect(user).mint();
      const mintAmount = convertToCdxAmount(userBalance);
      expect(await daoToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Unsuccessfully mint DAO tokens when aidrop has ended", async () => {
      expect(await daoToken.balanceOf(user.address)).to.equal(0);
      await govToken.connect(deployer).setLockEnd(0);
      await expect(minter.connect(user).mint()).to.be.revertedWith(
        "AIRDROP_INACTIVE"
      );
    });

    it("Unsuccessfully mint if minter isn't a locker", async () => {
      await govToken.connect(deployer).removeLocker(minter.address);
      await expect(minter.connect(user).mint()).to.be.revertedWith(
        "LOCKER_ONLY"
      );
    });

    it("Can't mint more with same APY tokens", async () => {
      await minter.connect(user).mint();
      await minter.connect(user).mint();
      const mintAmount = convertToCdxAmount(userBalance);
      expect(await daoToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Can mint more after accumulating more APY", async () => {
      // mint using current APY balance
      await minter.connect(user).mint();
      // accumulate more APY and mint
      const transferAmount = tokenAmountToBigNumber("288");
      await govToken.connect(deployer).transfer(user.address, transferAmount);
      await minter.connect(user).mint();

      const mintAmount = convertToCdxAmount(userBalance.add(transferAmount));
      expect(await daoToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("Can't mint after airdrop ends", async () => {
      const lockEnd = (await govToken.lockEnd()).toNumber();
      await ethers.provider.send("evm_setNextBlockTimestamp", [lockEnd]);
      await ethers.provider.send("evm_mine");

      await expect(minter.connect(user).mint()).to.be.revertedWith(
        "AIRDROP_INACTIVE"
      );
    });
  });

  describe("Boost-lock mint", () => {
    let userAPYBal;

    // use EVM snapshots for test isolation
    let snapshotId;

    before(async () => {
      const snapshot = await timeMachine.takeSnapshot();
      snapshotId = snapshot["result"];
    });

    after(async () => {
      await timeMachine.revertToSnapshot(snapshotId);
    });

    before("Set lock end", async () => {
      const timestamp = (await ethers.provider.getBlock()).timestamp;
      const lockEnd = timestamp + SECONDS_IN_DAY * 14; // lock ends in 2 weeks
      await govToken.connect(deployer).setLockEnd(lockEnd);
    });

    before("Add minter as locker", async () => {
      await govToken.connect(deployer).addLocker(minter.address);
    });

    before("Setup user delegation to daoToken", async () => {
      await daoVotingEscrow.connect(user).assign_delegate(minter.address);
    });

    before("Prepare user APY balance", async () => {
      userAPYBal = tokenAmountToBigNumber("1000");
      await govToken.connect(deployer).transfer(user.address, userAPYBal);
      await govToken.connect(user).approve(blApy.address, userAPYBal);
    });

    it("Successfully mint boost-locked DAO tokens", async () => {
      // create a lock longer than the lockEnd
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      const unlockTime = ethers.BigNumber.from(
        currentTime + SECONDS_IN_DAY * 30 * 6
      ); // lock for 6 months
      await blApy.connect(user).create_lock(userAPYBal, unlockTime);

      // user first approves daoVotingEscrow to transfer DAO tokens after mint
      const [apyAmount] = await blApy.locked(user.address);
      const expectedCdxAmount = convertToCdxAmount(apyAmount);
      const bonusExpectedCdxAmount = expectedCdxAmount.add(
        expectedCdxAmount.div(100)
      );
      console.log("exp", bonusExpectedCdxAmount.toString());
      await daoToken
        .connect(user)
        .approve(daoVotingEscrow.address, bonusExpectedCdxAmount);

      // mint the boost locked DAO tokens
      expect((await daoVotingEscrow.locked(user.address))[0]).to.equal(0);
      await minter.connect(user).mintLocked();
      // check locked CDX amount is properly converted from APY amount
      const [cdxAmount] = await daoVotingEscrow.locked(user.address);
      expect(cdxAmount).to.equal(bonusExpectedCdxAmount);
      // check CDX lock end is the same as APY lock end
      const [, apyLockEnd] = await blApy.locked(user.address);
      const [, cdxLockEnd] = await daoVotingEscrow.locked(user.address);
      expect(apyLockEnd).to.equal(cdxLockEnd);
    });

    it("Unsuccessfully mint boost-locked DAO tokens if no locked blApy", async () => {
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "NO_BOOST_LOCKED_AMOUNT"
      );
    });

    it("Unsuccessfully mint boost-locked DAO tokens if locked blApy ends too early", async () => {
      // get ve epoch time in the future so we can create a blAPY lock
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      let unlockTime = ethers.BigNumber.from(currentTime + SECONDS_IN_DAY * 7);
      unlockTime = unlockTime.div(SECONDS_IN_WEEK).mul(SECONDS_IN_WEEK); // normalize to ve epochs
      expect(unlockTime).to.be.gt(currentTime); // should pass unless test is run exactly at an epoch

      const lockEnd = await govToken.lockEnd();
      expect(unlockTime).to.be.lt(lockEnd);

      // create a blAPY lock shorter than the lockEnd
      await blApy.connect(user).create_lock(userAPYBal, unlockTime);

      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "BOOST_LOCK_ENDS_TOO_EARLY"
      );
    });

    it("Cannot repeatedly mint boost-locked DAO tokens", async () => {
      // create a lock longer than the lockEnd
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      const unlockTime = ethers.BigNumber.from(
        currentTime + SECONDS_IN_DAY * 30 * 6
      ); // lock for 6 months
      await blApy.connect(user).create_lock(userAPYBal, unlockTime);

      // user first approves daoVotingEscrow to transfer DAO tokens after mint
      const [apyAmount] = await blApy.locked(user.address);
      const expectedCdxAmount = convertToCdxAmount(apyAmount).add(
        apyAmount.div(100)
      );
      const bonusExpectedCdxAmount = expectedCdxAmount.add(
        expectedCdxAmount.div(100)
      );
      await daoToken
        .connect(user)
        .approve(daoVotingEscrow.address, bonusExpectedCdxAmount);

      await minter.connect(user).mintLocked();
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "Withdraw old tokens first"
      );
    });

    it("Unsuccessfully mint DAO tokens when airdrop has ended", async () => {
      // create a lock longer than the lockEnd
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      const unlockTime = ethers.BigNumber.from(
        currentTime + SECONDS_IN_DAY * 30 * 6
      ); // lock for 6 months
      await blApy.connect(user).create_lock(userAPYBal, unlockTime);

      // user first approves daoVotingEscrow to transfer DAO tokens after mint
      const [apyAmount] = await blApy.locked(user.address);
      const expectedCdxAmount = convertToCdxAmount(apyAmount);
      await daoToken
        .connect(user)
        .approve(daoVotingEscrow.address, expectedCdxAmount);

      // mint the boost locked DAO tokens
      expect((await daoVotingEscrow.locked(user.address))[0]).to.equal(0);
      await govToken.connect(deployer).setLockEnd(0);
      await expect(minter.connect(user).mintLocked()).to.be.revertedWith(
        "AIRDROP_INACTIVE"
      );
    });
  });

  describe("Claim APY and mint", () => {
    let userBalance;
    let rewardDistributor;

    // use EVM snapshots for test isolation
    let snapshotId;

    before(async () => {
      const snapshot = await timeMachine.takeSnapshot();
      snapshotId = snapshot["result"];
    });

    after(async () => {
      await timeMachine.revertToSnapshot(snapshotId);
    });

    before(
      "Attach to MAINNET reward distributor and set test signer",
      async () => {
        rewardDistributor = await ethers.getContractAt(
          "IRewardDistributor",
          REWARD_DISTRIBUTOR_ADDRESS
        );
        const distributorOwner = await impersonateAccount(
          await rewardDistributor.owner()
        );
        await rewardDistributor
          .connect(distributorOwner)
          .setSigner(DISTRIBUTOR_SIGNER);
      }
    );

    before("Set lock end", async () => {
      const timestamp = (await ethers.provider.getBlock()).timestamp;
      const lockEnd = timestamp + SECONDS_IN_DAY * 7;
      await govToken.connect(deployer).setLockEnd(lockEnd);
    });

    before("Add minter as locker", async () => {
      await govToken.connect(deployer).addLocker(minter.address);
    });

    before("Prepare user APY balance", async () => {
      userBalance = tokenAmountToBigNumber("1000");
      await govToken.connect(deployer).transfer(user.address, userBalance);
    });

    after(async () => {
      await timeMachine.revertToSnapshot(snapshotId);
    });

    it("Successfully claim APY", async () => {
      const claimAmount = tokenAmountToBigNumber("123");
      const nonce = "0";
      const { v, r, s } = await generateSignature(
        DISTRIBUTOR_SIGNER_KEY,
        REWARD_DISTRIBUTOR_ADDRESS,
        nonce,
        user.address,
        claimAmount
      );
      let recipientData = [nonce, user.address, claimAmount];

      expect(await govToken.balanceOf(user.address)).to.equal(userBalance);

      await expect(minter.claimApy(recipientData, v, r, s))
        .to.emit(govToken, "Transfer")
        .withArgs(rewardDistributor.address, user.address, claimAmount);

      const expectedBalance = userBalance.add(claimAmount);
      expect(await govToken.balanceOf(user.address)).to.equal(expectedBalance);
    });

    it("Successfully claim APY and mint DAO tokens", async () => {
      const claimAmount = tokenAmountToBigNumber("123");
      const nonce = "0";
      const { v, r, s } = await generateSignature(
        DISTRIBUTOR_SIGNER_KEY,
        REWARD_DISTRIBUTOR_ADDRESS,
        nonce,
        user.address,
        claimAmount
      );
      let recipientData = [nonce, user.address, claimAmount];

      expect(await daoToken.balanceOf(user.address)).to.equal(0);

      await minter.connect(user).claimApyAndMint(recipientData, v, r, s);

      const expectedApyBalance = userBalance.add(claimAmount);
      const expectedCdxBalance = convertToCdxAmount(expectedApyBalance);
      expect(await govToken.balanceOf(user.address)).to.equal(
        expectedApyBalance
      );
      expect(await daoToken.balanceOf(user.address)).to.equal(
        expectedCdxBalance
      );
    });

    it("Expire Airdrop", async () => {
      await govToken.connect(deployer).setLockEnd(0);
    });

    it("Verify that the minter detects when Airdrop has ended", async () => {
      await govToken.connect(deployer).setLockEnd(0);
      expect(await minter.connect(user).isAirdropActive(), true);
    });

    it("Unsuccessfully claim APY and mint DAO tokens when airdrop has ended", async () => {
      const claimAmount = tokenAmountToBigNumber("123");
      const nonce = "0";
      const { v, r, s } = await generateSignature(
        DISTRIBUTOR_SIGNER_KEY,
        REWARD_DISTRIBUTOR_ADDRESS,
        nonce,
        user.address,
        claimAmount
      );
      let recipientData = [nonce, user.address, claimAmount];
      await govToken.connect(deployer).setLockEnd(0);
      await expect(
        minter.connect(user).claimApyAndMint(recipientData, v, r, s)
      ).to.be.revertedWith("AIRDROP_INACTIVE");
    });
  });
});
