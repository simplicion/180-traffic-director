import assert from 'assert';
import { PixelManagerService } from '../../src/services/pixel.service';

console.log('========================================================================');
console.log('  TEST SUITE 24: UNIVERSAL PIXEL CONFIGURATION & CRYPTOGRAPHIC VAULT     ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// 🧪 1. AES-256-GCM Cryptographic Vault
console.log('🧪 1. Testing Cryptographic Vault & Meta CAPI Token Encryption (AES-256-GCM)...');

const mockCapiToken = 'EAAGNO4a7r2wBAODwQzK1k4Y3j9s8d7f6g5h4j3k2l1m9n8b7v6c5x4z3a2s1d0';

runTest('Encrypts CAPI token with non-deterministic IV & AuthTag', () => {
  const cipher1 = PixelManagerService.encryptToken(mockCapiToken);
  const cipher2 = PixelManagerService.encryptToken(mockCapiToken);

  assert(typeof cipher1 === 'string' && cipher1.includes(':'), 'Cipher output must be colon-delimited');
  const parts1 = cipher1.split(':');
  assert.strictEqual(parts1.length, 3, 'Cipher package must contain IV, AuthTag, and CipherText');
  assert.strictEqual(parts1[0].length, 24, 'IV must be 12 bytes (24 hex characters)');
  assert.strictEqual(parts1[1].length, 32, 'AuthTag must be 16 bytes (32 hex characters)');

  // Non-deterministic check (unique IV per encryption)
  assert.notStrictEqual(cipher1, cipher2, 'Two encryptions of the same token must produce distinct ciphertexts');
});

runTest('Decrypts encrypted token accurately (Round-trip verification)', () => {
  const cipher = PixelManagerService.encryptToken(mockCapiToken);
  const decrypted = PixelManagerService.decryptToken(cipher);
  assert.strictEqual(decrypted, mockCapiToken, 'Decrypted token must exactly match original plaintext');
});

runTest('Tamper Detection: Tampering with ciphertext or auth tag fails gracefully', () => {
  const cipher = PixelManagerService.encryptToken(mockCapiToken);
  const [iv, authTag, enc] = cipher.split(':');

  // Corrupt the ciphertext
  const tamperedEnc = enc.substring(0, enc.length - 2) + (enc.slice(-2) === 'aa' ? 'bb' : 'aa');
  const tamperedPackage = `${iv}:${authTag}:${tamperedEnc}`;
  const decrypted = PixelManagerService.decryptToken(tamperedPackage);

  assert.strictEqual(decrypted, '', 'Tampered ciphertext must fail authentication and return empty string');
});

runTest('Tamper Detection: Decryption with wrong master key fails securely', () => {
  const cipher = PixelManagerService.encryptToken(mockCapiToken, 'key_tenant_alpha_32_bytes_long_secret_1');
  const decrypted = PixelManagerService.decryptToken(cipher, 'key_tenant_beta_32_bytes_long_secret_2');

  assert.strictEqual(decrypted, '', 'Decryption with wrong key must fail authentication tag verification');
});

// 🧪 2. User Data Normalization & SHA-256 Hashing (Meta Graph API v19.0 Specs)
console.log('\n🧪 2. Testing User Data Normalization & SHA-256 Standards...');

runTest('Normalizes and hashes email per Meta guidelines (lowercase, trim, sha256)', () => {
  const rawEmail = '  Alex.Morgan@SubDomain.Example.COM  ';
  const expectedHash = PixelManagerService.hashSha256('alex.morgan@subdomain.example.com');
  const actualHash = PixelManagerService.normalizeEmail(rawEmail);

  assert.strictEqual(actualHash, expectedHash, 'Email must be trimmed, lowercased, and SHA-256 hashed');
});

runTest('Normalizes and hashes phone numbers (strips symbols, leading zeros, preserves country code)', () => {
  const rawPhone = '+1 (415) 555-2671';
  const expectedHash = PixelManagerService.hashSha256('14155552671');
  const actualHash = PixelManagerService.normalizePhone(rawPhone);

  assert.strictEqual(actualHash, expectedHash, 'Phone number must retain country code and strip symbols');

  const leadingZeroPhone = '0044 7911 123456';
  const expectedLeadingZeroHash = PixelManagerService.hashSha256('447911123456');
  assert.strictEqual(PixelManagerService.normalizePhone(leadingZeroPhone), expectedLeadingZeroHash, 'Leading zeros must be stripped');
});

runTest('Normalizes comprehensive CapiUserData payload', () => {
  const rawData = {
    email: 'client@store.com',
    phone: '+1-800-555-0199',
    ipAddress: '172.56.21.89',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)',
    fbp: 'fb.1.1689234567.987654321',
    fbc: 'fb.1.1689234567.IwAR3xYz'
  };

  const normalized = PixelManagerService.normalizeUserData(rawData);

  assert(Array.isArray(normalized.em), 'Normalized email must be an array');
  assert.strictEqual(normalized.em![0], PixelManagerService.hashSha256('client@store.com'));
  assert(Array.isArray(normalized.ph), 'Normalized phone must be an array');
  assert.strictEqual(normalized.ph![0], PixelManagerService.hashSha256('18005550199'));
  assert.strictEqual(normalized.client_ip_address, '172.56.21.89');
  assert.strictEqual(normalized.client_user_agent, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)');
  assert.strictEqual(normalized.fbp, 'fb.1.1689234567.987654321');
  assert.strictEqual(normalized.fbc, 'fb.1.1689234567.IwAR3xYz');
});

// 🧪 3. Pixel Format Validation
console.log('\n🧪 3. Testing Pixel ID Validation Rules...');

runTest('Accepts valid standard Meta Pixel IDs (12-18 digits)', () => {
  assert.strictEqual(PixelManagerService.validatePixelId('123456789012345'), true);
  assert.strictEqual(PixelManagerService.validatePixelId('9876543210123456'), true);
});

runTest('Rejects malformed, non-numeric, or malicious input strings', () => {
  assert.strictEqual(PixelManagerService.validatePixelId(''), false);
  assert.strictEqual(PixelManagerService.validatePixelId('12345'), false); // Too short
  assert.strictEqual(PixelManagerService.validatePixelId('123456789012345a'), false); // Contains letter
  assert.strictEqual(PixelManagerService.validatePixelId("123456789012345' OR '1'='1"), false); // Injection attempt
  assert.strictEqual(PixelManagerService.validatePixelId('<script>alert(1)</script>'), false);
});

console.log('\n========================================================================');
console.log(`  SUITE 24 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
console.log('========================================================================\n');
