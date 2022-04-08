// SPDX-License-Identifier: BUSDL-1.1
pragma solidity 0.8.9;
pragma experimental ABIEncoderV2;

interface IRewardDistributor {
    struct Recipient {
        uint256 nonce;
        address wallet;
        uint256 amount;
    }

    function claim(
        Recipient calldata recipient,
        uint8 v,
        bytes32 r,
        bytes32 s // bytes calldata signature
    ) external;

    function setSigner(address signer) external;

    function owner() external view returns (address);
}
