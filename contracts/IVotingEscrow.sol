// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

/* solhint-disable func-name-mixedcase, func-param-name-mixedcase */

import {IDetailedERC20} from "contracts/common/Imports.sol";

interface IVotingEscrow is IDetailedERC20 {
    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    function deposit_for(address _addr, uint256 _value) external;

    function create_lock(uint256 _value, uint256 _unlock_time) external;

    function create_lock_for(
        address _addr,
        uint256 _value,
        uint256 _unlock_time
    ) external;

    function increase_amount(uint256 _value) external;

    function increase_unlock_time(uint256 _unlock_time) external;

    function withdraw() external;

    function locked(address _addr) external view returns (LockedBalance memory);

    function supply() external view returns (uint256);
}

/* solhint-enable func-name-mixedcase, func-param-name-mixedcase */
