#!/usr/bin/env node
const path = require('path');
const purgeLib = require('../lib/nutrolix-purge');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const summary = await purgeLib.purgeCustomerData({
    dryRun,
    confirmPhrase: dryRun ? '' : purgeLib.CONFIRM_PHRASE_REQUIRED,
    deleteLocalFiles: !dryRun,
    rootDir: path.resolve(__dirname, '..')
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('Purge failed:', err && err.message ? err.message : err);
  process.exit(1);
});
