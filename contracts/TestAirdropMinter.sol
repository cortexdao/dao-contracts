// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;

import {AirdropMinter} from "contracts/AirdropMinter.sol";
import {IRewardDistributor} from "contracts/IRewardDistributor.sol";

contract TestAirdropMinter is AirdropMinter {
    constructor(
        address daoTokenAddress,
        address veTokenAddress,
        uint256 bonusInBps
    ) AirdropMinter(daoTokenAddress, veTokenAddress, bonusInBps) {} // solhint-disable-line no-empty-blocks

    function testClaimApy(
        IRewardDistributor.Recipient calldata recipient,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _claimApy(recipient, v, r, s);
    }

    function testComputeBonus(uint256 blApyBalance)
        external
        view
        returns (uint256)
    {
        return _computeBonus(blApyBalance);
    }

    function testConvertAmount(uint256 apyAmount)
        external
        pure
        returns (uint256)
    {
        return _convertAmount(apyAmount);
    }
}
