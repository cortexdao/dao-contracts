// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {IDetailedERC20} from "contracts/common/Imports.sol";

interface ITimeLockToken is IDetailedERC20 {
    function lockAmount(address account, uint256 amount) external;

    function setLockEnd(uint256 lockEnd) external;

    function addLocker(address locker) external;

    function removeLocker(address locker) external;

    function lockEnd() external view returns (uint256);

    function unlockedBalance(address account) external view returns (uint256);

    function owner() external view returns (address);
}
