/**
 * Sign-In With Solana (SIWS)
 *
 * Builds and signs SIWS messages for Solana automaton provisioning.
 * Ported from aiws control-plane siws.ts.
 */
import nacl from "tweetnacl";
import bs58 from "bs58";
export function buildSiwsMessage(params) {
    return `${params.domain} wants you to sign in with your Solana account:
${params.address}

${params.statement}

URI: ${params.uri}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}
Chain ID: ${params.chainId}`;
}
/**
 * Sign a SIWS message using a ChainIdentity (must be Solana).
 * Returns the base58-encoded detached signature.
 */
export async function signSiwsMessage(message, identity) {
    return identity.signMessage(message);
}
/**
 * Verify a SIWS signature.
 */
export function verifySiwsSignature(message, signatureBase58, addressBase58) {
    try {
        const signatureBytes = bs58.decode(signatureBase58);
        const publicKeyBytes = bs58.decode(addressBase58);
        if (signatureBytes.length !== 64 || publicKeyBytes.length !== 32) {
            return false;
        }
        const messageBytes = new TextEncoder().encode(message);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=siws.js.map