/**
 * ARISUN CHAT E2EE CRYPTOGRAPHY ENGINE
 * Signal Protocol Stack: Curve25519, Ed25519, XSalsa20-Poly1305.
 */

import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

// ----------------------------------------------------
// 1. KEY GENERATION
// ----------------------------------------------------
export function generateE2EEKeys() {
  // Generate Curve25519 for Encryption
  const encKeyPair = nacl.box.keyPair();
  // Generate Ed25519 for Signatures
  const signKeyPair = nacl.sign.keyPair();

  // Create a 16-character human-readable recovery phrase (e.g., A8F4-B9C2-D3E1-F7G6)
  const randBytes = nacl.randomBytes(8);
  const hex = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const recoveryPhrase = `${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`;

  return {
    publicKeys: {
      encPublicKey: util.encodeBase64(encKeyPair.publicKey),
      signPublicKey: util.encodeBase64(signKeyPair.publicKey),
    },
    privateKeys: {
      encSecretKey: util.encodeBase64(encKeyPair.secretKey),
      signSecretKey: util.encodeBase64(signKeyPair.secretKey),
    },
    recoveryPhrase
  };
}

// ----------------------------------------------------
// 2. THE VAULT (PBKDF2 + XSalsa20-Poly1305)
// ----------------------------------------------------
async function deriveKey(passwordOrPhrase, saltUint8) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passwordOrPhrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const keyBuffer = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltUint8,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256 // 32 bytes for nacl.secretbox
  );

  return new Uint8Array(keyBuffer);
}

export async function lockVault(privateKeysObject, passwordOrPhrase) {
  const payloadBytes = util.decodeUTF8(JSON.stringify(privateKeysObject));
  
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  
  const derivedKey = await deriveKey(passwordOrPhrase, salt);
  
  const encryptedBox = nacl.secretbox(payloadBytes, nonce, derivedKey);

  return JSON.stringify({
    salt: util.encodeBase64(salt),
    nonce: util.encodeBase64(nonce),
    cipherText: util.encodeBase64(encryptedBox)
  });
}

export async function unlockVault(vaultJsonString, passwordOrPhrase) {
  try {
    const vault = JSON.parse(vaultJsonString);
    const salt = util.decodeBase64(vault.salt);
    const nonce = util.decodeBase64(vault.nonce);
    const cipherText = util.decodeBase64(vault.cipherText);

    const derivedKey = await deriveKey(passwordOrPhrase, salt);

    const decryptedBytes = nacl.secretbox.open(cipherText, nonce, derivedKey);
    if (!decryptedBytes) throw new Error("Decryption failed. Bad password/phrase.");

    const jsonString = util.encodeUTF8(decryptedBytes);
    return JSON.parse(jsonString); // Returns { encSecretKey, signSecretKey }
  } catch (error) {
    console.error("Vault Unlock Error:", error.message);
    return null;
  }
}

// ----------------------------------------------------
// 3. MESSAGE PIPELINE (Sign -> Encrypt -> Box)
// ----------------------------------------------------
export function encryptMessage(text, myPrivateKeys, receiverEncPublicKeyBase64, myEncPublicKeyBase64) {
  // 1. Generate a random temporary symmetric key for this specific message
  const msgKey = nacl.randomBytes(nacl.secretbox.keyLength);
  
  // 2. Encrypt the actual message text
  const msgNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msgBytes = util.decodeUTF8(text);
  const cipherText = nacl.secretbox(msgBytes, msgNonce, msgKey);

  // 3. Box the temporary msgKey for the receiver
  const receiverEncPk = util.decodeBase64(receiverEncPublicKeyBase64);
  const myEncSk = util.decodeBase64(myPrivateKeys.encSecretKey);
  const boxNonceForReceiver = nacl.randomBytes(nacl.box.nonceLength);
  const boxedKeyForReceiver = nacl.box(msgKey, boxNonceForReceiver, receiverEncPk, myEncSk);

  // 4. Box the temporary msgKey for ourselves (so we can read our own sent messages)
  const myEncPk = util.decodeBase64(myEncPublicKeyBase64);
  const boxNonceForMe = nacl.randomBytes(nacl.box.nonceLength);
  const boxedKeyForMe = nacl.box(msgKey, boxNonceForMe, myEncPk, myEncSk);

  // 5. Package it together
  const payload = JSON.stringify({
    msgNonce: util.encodeBase64(msgNonce),
    cipherText: util.encodeBase64(cipherText),
    receiverBox: { nonce: util.encodeBase64(boxNonceForReceiver), key: util.encodeBase64(boxedKeyForReceiver) },
    meBox: { nonce: util.encodeBase64(boxNonceForMe), key: util.encodeBase64(boxedKeyForMe) }
  });

  // 6. Sign the entire payload using Ed25519 to prove authenticity
  const payloadBytes = util.decodeUTF8(payload);
  const mySignSk = util.decodeBase64(myPrivateKeys.signSecretKey);
  const signedMessage = nacl.sign(payloadBytes, mySignSk);

  return util.encodeBase64(signedMessage);
}

export function decryptMessage(signedBase64, myPrivateKeys, senderEncPublicKeyBase64, senderSignPublicKeyBase64, isMessageFromMe) {
  try {
    const signedBytes = util.decodeBase64(signedBase64);
    const senderSignPk = util.decodeBase64(senderSignPublicKeyBase64);
    const myEncSk = util.decodeBase64(myPrivateKeys.encSecretKey);
    const senderEncPk = util.decodeBase64(senderEncPublicKeyBase64);

    // 1. Verify Signature (Ensures message wasn't forged by the server)
    const verifiedPayloadBytes = nacl.sign.open(signedBytes, senderSignPk);
    if (!verifiedPayloadBytes) throw new Error("Invalid Signature! Message was tampered with.");
    
    const payload = JSON.parse(util.encodeUTF8(verifiedPayloadBytes));

    // 2. Open the correct key box
    const boxToOpen = isMessageFromMe ? payload.meBox : payload.receiverBox;
    const boxNonce = util.decodeBase64(boxToOpen.nonce);
    const boxedKey = util.decodeBase64(boxToOpen.key);
    
    // (If I sent it, I open it with my own public key. If they sent it, I open it with their public key)
    const peerEncPk = isMessageFromMe ? util.decodeBase64(myPrivateKeys.encPublicKey) : senderEncPk;

    const msgKey = nacl.box.open(boxedKey, boxNonce, peerEncPk, myEncSk);
    if (!msgKey) throw new Error("Failed to open key box.");

    // 3. Decrypt the actual message text
    const msgNonce = util.decodeBase64(payload.msgNonce);
    const cipherText = util.decodeBase64(payload.cipherText);
    const decryptedBytes = nacl.secretbox.open(cipherText, msgNonce, msgKey);
    if (!decryptedBytes) throw new Error("Failed to decrypt message content.");

    return util.encodeUTF8(decryptedBytes);
  } catch (error) {
    console.error("E2EE Decryption Error:", error.message);
    return "🔒 [Encrypted/Unverifiable Message]";
  }
}