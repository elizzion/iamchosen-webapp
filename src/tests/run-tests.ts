import { getPublicAppUrl, buildAffiliateReferralUrl, validateCommunityUrl } from '../services/affiliate-config.service';

console.log('🚀 Running I AM CHOSEN Affiliate Growth Tools Test Suite...');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// Mocking import.meta.env since we are running in TSX
if (!(globalThis as any).import) {
  (globalThis as any).import = { meta: { env: {} } };
}

// 1. Test getPublicAppUrl
try {
  // Test fallback when VITE_PUBLIC_APP_URL is empty
  const urlDefault = getPublicAppUrl();
  assert(urlDefault === 'https://iamchosen.app', 'getPublicAppUrl correctly falls back to default in node environment');
} catch (e) {
  console.error('getPublicAppUrl test error:', e);
  failed++;
}

// 2. Test buildAffiliateReferralUrl
const url1 = buildAffiliateReferralUrl({
  baseUrl: 'https://iamchosen.app',
  registrationPath: '/register',
  referralCode: 'TEST1234',
  queryParameter: 'ref'
});
assert(url1 === 'https://iamchosen.app/register?ref=TEST1234', 'buildAffiliateReferralUrl builds valid URL');

const url2 = buildAffiliateReferralUrl({
  baseUrl: 'https://iamchosen.app',
  registrationPath: '/register',
  referralCode: '  SPONSOR_CASE_PRESERVED  ',
  queryParameter: 'ref'
});
assert(url2 === 'https://iamchosen.app/register?ref=SPONSOR_CASE_PRESERVED', 'buildAffiliateReferralUrl trims code and preserves case');

// 3. Test validateCommunityUrl
assert(validateCommunityUrl('https://t.me/chosen'), 'Valid HTTPS telegram link passes');
assert(!validateCommunityUrl('http://t.me/chosen'), 'Insecure HTTP link fails');
assert(!validateCommunityUrl('javascript:alert(1)'), 'Unsafe javascript schema fails');
assert(!validateCommunityUrl(''), 'Empty URL fails');

console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All tests passed successfully!');
}
