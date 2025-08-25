// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CanopyVerifierLib
/// @notice Verifies EIP-712 signatures for the CompliantCall capability and recomputes callHash
library CanopyVerifierLib {
    bytes32 internal constant _TYPEHASH = keccak256(
        "CompliantCall(address subject,address verifier,address target,uint256 value,bytes32 argsHash,bytes32 policyId,uint64 expiry,uint256 nonce)"
    );

    bytes32 internal constant _NAME_HASH = keccak256("Canopy");
    bytes32 internal constant _VERSION_HASH = keccak256("1");

    /// @dev ERC-1271 magic value for valid signature
    bytes4 internal constant EIP1271_MAGICVALUE = 0x1626ba7e;

    /// @notice Compute callHash bound to (chainId, target, subject, selector, value, keccak(args))
    function computeCallHash(
        uint256 chainId,
        address target,
        address subject,
        bytes4 selector,
        uint256 value,
        bytes32 argsHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(chainId, target, subject, selector, value, argsHash));
    }

    /// @notice Compute EIP-712 domain separator for Canopy
    function domainSeparator(uint256 chainId, address verifyingContract) internal pure returns (bytes32) {
        // EIP-712 domain typehash
        bytes32 DOMAIN_TYPEHASH = keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        return keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            _NAME_HASH,
            _VERSION_HASH,
            chainId,
            verifyingContract
        ));
    }

    /// @notice Hash the typed data struct for CompliantCall
    function hashCompliantCall(
        address subject,
        address verifier,
        address target,
        uint256 value,
        bytes32 argsHash,
        bytes32 policyId,
        uint64 expiry,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(_TYPEHASH, subject, verifier, target, value, argsHash, policyId, expiry, nonce));
    }

    /// @notice Compute the full EIP-712 digest to be signed/recovered
    function digest(
        uint256 chainId,
        address verifyingContract,
        address subject,
        address verifier,
        address target,
        uint256 value,
        bytes32 argsHash,
        bytes32 policyId,
        uint64 expiry,
        uint256 nonce
    ) internal pure returns (bytes32) {
        bytes32 ds = domainSeparator(chainId, verifyingContract);
        bytes32 st = hashCompliantCall(subject, verifier, target, value, argsHash, policyId, expiry, nonce);
        return keccak256(abi.encodePacked("\x19\x01", ds, st));
    }

    /// @notice ECDSA recover based verification against EOA issuer
    function verifyECDSA(
        address issuer,
        bytes32 dig,
        bytes calldata signature
    ) internal pure returns (bool) {
        (bytes32 r, bytes32 s, uint8 v) = _split(signature);
        address recovered = ecrecover(dig, v, r, s);
        return recovered == issuer;
    }

    /// @notice EIP-1271 contract-based signature validation
    function verify1271(
        address issuerContract,
        bytes32 dig,
        bytes calldata signature
    ) internal view returns (bool) {
        (bool ok, bytes memory ret) = issuerContract.staticcall(
            abi.encodeWithSignature("isValidSignature(bytes32,bytes)", dig, signature)
        );
        return ok && ret.length >= 4 && bytes4(ret) == EIP1271_MAGICVALUE;
    }

    function _split(bytes memory sig) private pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "bad sig len");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
    }
}

