// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal trusted forwarder used with ERC2771ContextLite
contract BasicForwarder2771 {
    event Forwarded(address indexed from, address indexed to, bytes data, bytes4 selector);

    function forward(address to, bytes calldata data) external payable {
        // Append the original sender to calldata (ERC-2771 convention)
        bytes memory callData = bytes.concat(data, bytes20(msg.sender));
        (bool ok, bytes memory ret) = to.call{value: msg.value}(callData);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        if (data.length >= 4) {
            bytes4 sel;
            assembly { sel := calldataload(4) }
            emit Forwarded(msg.sender, to, data, sel);
        } else {
            emit Forwarded(msg.sender, to, data, 0x00000000);
        }
    }
}

