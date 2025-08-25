// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC2771ContextLite } from "./ERC2771ContextLite.sol";

/// @notice Example venue contract that trusts a forwarder and records messages from the effective sender
contract VenueExample is ERC2771ContextLite {
    event Noted(address indexed sender, string note);

    constructor(address trustedForwarder) ERC2771ContextLite(trustedForwarder) {}

    function note(string calldata message) external {
        emit Noted(_msgSender(), message);
    }
}

