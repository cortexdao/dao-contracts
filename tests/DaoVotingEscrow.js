const { expect } = require("chai");
const hre = require("hardhat");
const { artifacts, ethers, waffle } = hre;
const { deployMockContract } = waffle;
const timeMachine = require("ganache-time-traveler");
const {
  ZERO_ADDRESS,
  tokenAmountToBigNumber,
  FAKE_ADDRESS,
} = require("./utils");
const { BigNumber } = ethers;

const DAY = 86400; // day in seconds
const WEEK = 7 * DAY;
const MONTH = DAY * 30;
const YEAR = DAY * 365;
const MAXTIME = 4 * YEAR;

if (!process.env.CI) {
  // eslint-disable-next-line no-global-assign
  describe = describe.skip;
}

describe("DaoVotingEscrow deployment", () => {
  // signers
  let deployer;

  // contract factories
  let DaoVotingEscrow;

  // deployed contracts
  let veCrv;

  // use EVM snapshots for test isolation
  let snapshotId;

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  before(async () => {
    [deployer] = await ethers.getSigners();
  });

  it("Can deploy DaoVotingEscrow", async () => {
    const erc20Mock = await deployMockContract(
      deployer,
      artifacts.readArtifactSync("IDetailedERC20").abi
    );
    await erc20Mock.mock.decimals.returns(9);

    DaoVotingEscrow = await ethers.getContractFactory("DaoVotingEscrow");
    veCrv = await expect(
      DaoVotingEscrow.deploy(
        erc20Mock.address, // token
        "Vote-Locked CXD", // name
        "vlCXD", // symbol
        "1.0.0" // version
      )
    ).to.not.be.reverted;
    expect(veCrv.address).to.not.equal(ZERO_ADDRESS);

    expect(await veCrv.symbol()).to.equal("vlCXD");
    expect(await veCrv.name()).to.equal("Vote-Locked CXD");
    expect(await veCrv.version()).to.equal("1.0.0");
    expect(await veCrv.decimals()).to.equal(9);
  });
});

describe("DaoVotingEscrow unit tests", () => {
  // signers
  let deployer;
  let user;
  let anotherUser;
  let delegate;

  // contract factories
  let DaoVotingEscrow;

  // deployed contracts
  let cxd;
  let blCxd;

  // use EVM snapshots for test isolation
  let snapshotId;

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  before("Get signers", async () => {
    [deployer, user, anotherUser, delegate] = await ethers.getSigners();
  });

  before("Deploy DAO token and mint tokens for user", async () => {
    const DaoToken = await ethers.getContractFactory("TestDaoToken");
    cxd = await DaoToken.deploy();
    await cxd.initialize();

    await cxd.testMint(user.address, tokenAmountToBigNumber("100"));
    expect(await cxd.balanceOf(user.address)).to.equal(
      tokenAmountToBigNumber("100")
    );
  });

  before("Deploy Voting Escrow", async () => {
    DaoVotingEscrow = await ethers.getContractFactory("DaoVotingEscrow");
    blCxd = await DaoVotingEscrow.deploy(
      cxd.address,
      "Vote-Locked CXD", // name
      "vlCXD", // symbol
      "1.0.0" // version
    );
  });

  describe("Defaults", () => {
    it("Symbol", async () => {
      expect(await blCxd.symbol()).to.equal("vlCXD");
    });

    it("Name", async () => {
      expect(await blCxd.name()).to.equal("Vote-Locked CXD");
    });

    it("Version", async () => {
      expect(await blCxd.version()).to.equal("1.0.0");
    });

    it("Decimals", async () => {
      expect(await blCxd.decimals()).to.equal(await cxd.decimals());
    });

    it("Not shutdown", async () => {
      expect(await blCxd.is_shutdown()).to.be.false;
    });

    it("Deployer is admin", async () => {
      expect(await blCxd.admin()).to.equal(deployer.address);
    });
  });

  describe("Shutdown privileges", () => {
    it("Admin can shutdown", async () => {
      await expect(blCxd.connect(deployer).shutdown()).to.not.be.reverted;
      expect(await blCxd.is_shutdown()).to.be.true;
    });

    it("User cannot shutdown", async () => {
      await expect(blCxd.connect(user).shutdown()).to.be.revertedWith(
        "Admin only"
      );
    });
  });

  describe("Block all updates, except withdraw, when shutdown", () => {
    it("Cannot create lock if shutdown", async () => {
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      const unlockTime = BigNumber.from(currentTime + 86400 * 30 * 6); // lock for 6 months
      const lockAmount = tokenAmountToBigNumber("15");

      await blCxd.connect(deployer).shutdown();

      await cxd.connect(user).approve(blCxd.address, lockAmount);
      await expect(
        blCxd.connect(user).create_lock(lockAmount, unlockTime)
      ).to.be.revertedWith("Contract is shutdown");
    });

    it("Cannot deposit for another if shutdown", async () => {
      await blCxd.connect(deployer).shutdown();

      await expect(
        blCxd.connect(user).deposit_for(FAKE_ADDRESS, 100)
      ).to.be.revertedWith("Contract is shutdown");
    });

    it("Cannot increase locked amount if shutdown", async () => {
      await blCxd.connect(deployer).shutdown();

      await expect(
        blCxd.connect(user).increase_amount(tokenAmountToBigNumber(100))
      ).to.be.revertedWith("Contract is shutdown");
    });

    it("Cannot increase unlock time if shutdown", async () => {
      await blCxd.connect(deployer).shutdown();

      await expect(
        blCxd.connect(user).increase_unlock_time(86400 * 30)
      ).to.be.revertedWith("Contract is shutdown");
    });
  });

  describe("Withdraw when shutdown", () => {
    before("Mint tokens for another user", async () => {
      await cxd.testMint(anotherUser.address, tokenAmountToBigNumber("100"));
      expect(await cxd.balanceOf(anotherUser.address)).to.equal(
        tokenAmountToBigNumber("100")
      );
    });

    it("Can withdraw with non-expired lock", async () => {
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      // lock for ~ 6 months
      const unlockTime = BigNumber.from(currentTime + 6 * MONTH)
        .div(WEEK)
        .mul(WEEK);
      const lockAmount = tokenAmountToBigNumber("15");

      const apyBalance = await cxd.balanceOf(user.address);

      await cxd.connect(user).approve(blCxd.address, lockAmount);
      await blCxd.connect(user).create_lock(lockAmount, unlockTime);

      expect(await cxd.balanceOf(user.address)).to.equal(
        apyBalance.sub(lockAmount)
      );

      expect(await blCxd["balanceOf(address)"](user.address)).to.be.gt(
        lockAmount.mul(86400 * (30 * 6 - 7)).div(86400 * 365 * 4)
      );

      await expect(blCxd.connect(user).withdraw()).to.be.revertedWith(
        "The lock didn't expire"
      );

      await blCxd.connect(deployer).shutdown();

      await expect(blCxd.connect(user).withdraw()).to.not.be.reverted;
      expect(await cxd.balanceOf(user.address)).to.equal(apyBalance);
    });

    it("Withdraw properly updates user locked and supply", async () => {
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      // lock for ~ 6 months
      const unlockTime = BigNumber.from(currentTime + 6 * MONTH)
        .div(WEEK)
        .mul(WEEK);
      const lockAmount = tokenAmountToBigNumber("15");

      await cxd.connect(user).approve(blCxd.address, lockAmount);
      await blCxd.connect(user).create_lock(lockAmount, unlockTime);

      await cxd.connect(anotherUser).approve(blCxd.address, lockAmount);
      await blCxd.connect(anotherUser).create_lock(lockAmount, unlockTime);

      await blCxd.connect(deployer).shutdown();
      await blCxd.connect(anotherUser).withdraw();

      expect(await blCxd.supply()).to.equal(lockAmount);
      expect(await blCxd.locked(user.address)).to.deep.equal([
        lockAmount,
        unlockTime,
      ]);
      expect(await blCxd.locked(anotherUser.address)).to.deep.equal([
        BigNumber.from(0),
        BigNumber.from(0),
      ]);
    });

    it("`balanceOf` and `totalSupply` should be frozen", async () => {
      const currentTime = (await ethers.provider.getBlock()).timestamp;

      // user 1 creates lock
      const userUnlockTime = BigNumber.from(currentTime + 6 * MONTH); // lock for 6 months
      const userLockAmount = tokenAmountToBigNumber("15");

      await cxd.connect(user).approve(blCxd.address, userLockAmount);
      await blCxd.connect(user).create_lock(userLockAmount, userUnlockTime);

      // ... and extends lock
      await blCxd.connect(user).increase_unlock_time(userUnlockTime.add(WEEK));

      // user 2 creates lock
      const anotherUnlockTime = BigNumber.from(currentTime + 1 * MONTH); // lock for 1 month
      let anotherLockAmount = tokenAmountToBigNumber("88");

      await cxd.connect(anotherUser).approve(blCxd.address, anotherLockAmount);
      await blCxd
        .connect(anotherUser)
        .create_lock(anotherLockAmount, anotherUnlockTime);

      // ... and extends amount
      const extraLockAmount = tokenAmountToBigNumber("5");
      anotherLockAmount = anotherLockAmount.add(extraLockAmount);
      await cxd.connect(anotherUser).approve(blCxd.address, extraLockAmount);
      await blCxd.connect(anotherUser).increase_amount(extraLockAmount);

      const userBlappies = await blCxd["balanceOf(address)"](user.address);
      const anotherUserBlappies = await blCxd["balanceOf(address)"](
        anotherUser.address
      );
      const totalSupply = await blCxd["totalSupply()"]();

      // shutdown and user 1 withdraws
      await blCxd.connect(deployer).shutdown();
      await blCxd.connect(user).withdraw();

      // blAPY state should remain the same for all users
      expect(await blCxd["balanceOf(address)"](user.address)).to.be.gt(
        userBlappies.sub(userLockAmount.mul(DAY).div(MAXTIME))
      );
      expect(await blCxd["balanceOf(address)"](anotherUser.address)).to.be.gt(
        anotherUserBlappies.sub(anotherLockAmount.mul(DAY).div(MAXTIME))
      );
      expect(await blCxd["totalSupply()"]()).to.be.gt(
        totalSupply.sub(totalSupply.mul(DAY).div(MAXTIME))
      );
    });
  });

  describe("Lock delegation", () => {
    it("User can add delegate", async () => {
      await blCxd.connect(user).assign_delegate(delegate.address);
      expect(await blCxd.delegate_for(user.address)).to.equal(delegate.address);
    });

    it("User can remove delegate", async () => {
      await blCxd.connect(user).assign_delegate(ZERO_ADDRESS);
      expect(await blCxd.delegate_for(user.address)).to.equal(ZERO_ADDRESS);
    });

    it("Delegate can create lock for user", async () => {
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      // lock for ~ 6 months
      const unlockTime = BigNumber.from(currentTime + 6 * MONTH)
        .div(WEEK)
        .mul(WEEK);
      const lockAmount = tokenAmountToBigNumber("15");

      const cxdBalance = await cxd.balanceOf(user.address);

      await cxd.connect(user).approve(blCxd.address, lockAmount);
      await blCxd.connect(user).assign_delegate(delegate.address);
      await blCxd
        .connect(delegate)
        .create_lock_for(user.address, lockAmount, unlockTime);

      expect(await cxd.balanceOf(user.address)).to.equal(
        cxdBalance.sub(lockAmount)
      );

      expect(await blCxd["balanceOf(address)"](user.address)).to.be.gt(
        lockAmount.mul(6 * MONTH - WEEK).div(MAXTIME)
      );

      expect(await blCxd.locked(user.address)).to.deep.equal([
        lockAmount,
        unlockTime,
      ]);
    });

    it("Non-delegate cannot create lock for user", async () => {
      const currentTime = (await ethers.provider.getBlock()).timestamp;
      // lock for ~ 6 months
      const unlockTime = BigNumber.from(currentTime + 6 * MONTH)
        .div(WEEK)
        .mul(WEEK);
      const lockAmount = tokenAmountToBigNumber("15");

      await cxd.connect(user).approve(blCxd.address, lockAmount);
      await expect(
        blCxd
          .connect(anotherUser)
          .create_lock_for(user.address, lockAmount, unlockTime)
      ).to.be.revertedWith("Delegate only");
    });
  });
});
