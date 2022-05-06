// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {ReentrancyGuard} from "contracts/common/Imports.sol";
import {ITimeLockToken} from "contracts/ITimeLockToken.sol";
import {IVotingEscrow} from "contracts/IVotingEscrow.sol";
import {IRewardDistributor} from "contracts/IRewardDistributor.sol";
import {DaoToken} from "contracts/DaoToken.sol";

contract AirdropMinter is ReentrancyGuard {
    address public constant APY_TOKEN_ADDRESS =
        0x95a4492F028aa1fd432Ea71146b433E7B4446611;
    address public constant BLAPY_TOKEN_ADDRESS =
        0xDC9EFf7BB202Fd60dE3f049c7Ec1EfB08006261f;
    address public constant APY_REWARD_DISTRIBUTOR_ADDRESS =
        0x2E11558316df8Dde1130D81bdd8535f15f70B23d;

    address public immutable DAO_TOKEN_ADDRESS;
    address public immutable VE_TOKEN_ADDRESS;

    uint256 internal constant _CONVERSION_NUMERATOR = 271828182;
    uint256 internal constant _CONVERSION_DENOMINATOR = 1e8;
    uint256 internal immutable _BONUS_NUMERATOR; // in bps
    uint256 internal constant _BONUS_DENOMINATOR = 1e4; // 100% in bps

    constructor(
        address daoTokenAddress,
        address veTokenAddress,
        uint256 bonusInBps
    ) {
        require(daoTokenAddress != address(0), "INVALID_DAO_ADDRESS");
        require(veTokenAddress != address(0), "INVALID_ESCROW_ADDRESS");
        DAO_TOKEN_ADDRESS = daoTokenAddress;
        VE_TOKEN_ADDRESS = veTokenAddress;
        _BONUS_NUMERATOR = bonusInBps;
    }

    function mintLocked() external nonReentrant returns (uint256) {
        require(isAirdropActive(), "AIRDROP_INACTIVE");

        IVotingEscrow blApy = IVotingEscrow(BLAPY_TOKEN_ADDRESS);
        IVotingEscrow.LockedBalance memory locked = blApy.locked(msg.sender);
        // amount is int128 so we do a defensive check
        require(locked.amount > 0, "NO_BOOST_LOCKED_AMOUNT");
        uint256 blApyLockedAmount = uint128(locked.amount);
        uint256 blApyLockEnd = locked.end;

        require(
            ITimeLockToken(APY_TOKEN_ADDRESS).lockEnd() <= blApyLockEnd,
            "BOOST_LOCK_ENDS_TOO_EARLY"
        );

        IVotingEscrow veToken = IVotingEscrow(VE_TOKEN_ADDRESS);
        IVotingEscrow.LockedBalance memory newLocked =
            veToken.locked(msg.sender);
        require(newLocked.amount == 0, "LOCK_ALREADY_EXISTS");

        // bonus takes into account user's time commitment
        uint256 blApyBalance = blApy.balanceOf(msg.sender);
        uint256 bonusAmount = _computeBonus(blApyBalance);

        uint256 cxdLockedAmount = _convertAmount(blApyLockedAmount);
        uint256 mintAmount = cxdLockedAmount + bonusAmount;

        // mint the full amount to user;
        DaoToken(DAO_TOKEN_ADDRESS).mint(msg.sender, mintAmount);
        // only lock up the non-bonus in the voting escrow, so
        // the user keeps the bonus unlocked.
        veToken.create_lock_for(msg.sender, cxdLockedAmount, blApyLockEnd);

        return mintAmount;
    }

    function claimApyAndMint(
        IRewardDistributor.Recipient calldata recipient,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256) {
        require(isAirdropActive(), "AIRDROP_INACTIVE");
        _claimApy(recipient, v, r, s);
        return mint();
    }

    function mint() public nonReentrant returns (uint256) {
        require(isAirdropActive(), "AIRDROP_INACTIVE");

        ITimeLockToken apy = ITimeLockToken(APY_TOKEN_ADDRESS);
        uint256 unlockedApyBalance = apy.unlockedBalance(msg.sender);
        require(unlockedApyBalance > 0, "NO_UNLOCKED_BALANCE");

        apy.lockAmount(msg.sender, unlockedApyBalance);
        uint256 mintAmount = _convertAmount(unlockedApyBalance);
        DaoToken(DAO_TOKEN_ADDRESS).mint(msg.sender, mintAmount);

        return mintAmount;
    }

    function isAirdropActive() public view returns (bool) {
        ITimeLockToken apyToken = ITimeLockToken(APY_TOKEN_ADDRESS);
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp < apyToken.lockEnd();
    }

    function _claimApy(
        IRewardDistributor.Recipient calldata recipient,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        IRewardDistributor(APY_REWARD_DISTRIBUTOR_ADDRESS).claim(
            recipient,
            v,
            r,
            s
        );
    }

    /** @dev convert blAPY balance to CXD bonus for boost-lockers minting */
    function _computeBonus(uint256 blApyBalance)
        internal
        view
        returns (uint256)
    {
        uint256 unconvertedBonus =
            (blApyBalance * _BONUS_NUMERATOR) / _BONUS_DENOMINATOR;
        return _convertAmount(unconvertedBonus);
    }

    /** @dev convert APY token amount to CXD token amount */
    function _convertAmount(uint256 apyAmount) internal pure returns (uint256) {
        return (apyAmount * _CONVERSION_NUMERATOR) / _CONVERSION_DENOMINATOR;
    }
}
