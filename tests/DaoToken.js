const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;
const timeMachine = require("ganache-time-traveler");
const { ZERO_ADDRESS, tokenAmountToBigNumber } = require("./utils");

describe("DaoToken deployment", () => {
  // contract factories
  let DaoToken;

  // deployed contracts
  let daoToken;

  // use EVM snapshots for test isolation
  let snapshotId;

  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot["result"];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  it("Can deploy DAO token", async () => {
    DaoToken = await ethers.getContractFactory("DaoToken");
    const logic = await DaoToken.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy();

    const supplyCap = tokenAmountToBigNumber("271828182");
    const TransparentUpgradeableProxy = await ethers.getContractFactory(
      "TransparentUpgradeableProxy"
    );
    const initData = logic.interface.encodeFunctionData("initialize(uint256)", [
      supplyCap,
    ]);
    daoToken = await expect(
      TransparentUpgradeableProxy.deploy(
        logic.address,
        proxyAdmin.address,
        initData
      )
    ).to.not.be.reverted;
    expect(daoToken.address).to.not.equal(ZERO_ADDRESS);
  });
});

describe("DaoToken unit tests", () => {
  // signers
  let deployer;
  let user;
  let anotherUser;

  // deployed contracts
  let daoToken;

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
    [deployer, user, anotherUser] = await ethers.getSigners();
  });

  before("Deploy DAO token", async () => {
    const DaoToken = await ethers.getContractFactory("DaoToken");
    const logic = await DaoToken.deploy();

    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy();

    const supplyCap = tokenAmountToBigNumber("271828182");
    const TransparentUpgradeableProxy = await ethers.getContractFactory(
      "TransparentUpgradeableProxy"
    );
    const initData = logic.interface.encodeFunctionData("initialize(uint256)", [
      supplyCap,
    ]);
    const proxy = await TransparentUpgradeableProxy.deploy(
      logic.address,
      proxyAdmin.address,
      initData
    );
    daoToken = logic.attach(proxy.address);
  });

  describe("Defaults", () => {
    it("Symbol", async () => {
      expect(await daoToken.symbol()).to.equal("CXD");
    });

    it("Name", async () => {
      expect(await daoToken.name()).to.equal("Cortex DAO Token");
    });

    it("Decimals", async () => {
      expect(await daoToken.decimals()).to.equal(18);
    });

    it("Deployer is owner", async () => {
      expect(await daoToken.owner()).to.equal(deployer.address);
    });
  });
});
