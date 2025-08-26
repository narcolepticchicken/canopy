// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { CanopyVerifierLib } from "../src/CanopyVerifierLib.sol";

contract VerifierLibTest {
    function test_CallHashChangesWithSelector() public pure {
        bytes32 a = CanopyVerifierLib.computeCallHash(
            1,
            address(0x2),
            address(0x1),
            0xabcdef01,
            0,
            bytes32(0)
        );
        bytes32 b = CanopyVerifierLib.computeCallHash(
            1,
            address(0x2),
            address(0x1),
            0xabcdef02,
            0,
            bytes32(0)
        );
        assert(a != b);
        assert(a != bytes32(0) && b != bytes32(0));
    }

    function test_DomainSeparatorDiffersByVerifier() public pure {
        bytes32 d1 = CanopyVerifierLib.domainSeparator(1, address(0x1111));
        bytes32 d2 = CanopyVerifierLib.domainSeparator(1, address(0x2222));
        assert(d1 != d2);
        assert(d1 != bytes32(0) && d2 != bytes32(0));
    }
}

