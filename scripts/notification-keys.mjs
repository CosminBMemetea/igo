import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import webpush from 'web-push';
const destination = resolve(process.argv[2] || '.env.notifications.local');
const subject = process.argv[3] || 'https://igo-kappa.vercel.app';
if (!/^(https:\/\/|mailto:)/.test(subject) || /[\r\n]/.test(subject)) throw new Error('Use an HTTPS contact URL or mailto address');
const keys = webpush.generateVAPIDKeys();
// Exclusive creation prevents accidental rotation, which would invalidate installed subscriptions.
writeFileSync(destination, `# PRIVATE: keep out of Git and chat; copy into the hosting environment.\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=${subject}\n`, { mode: 0o600, flag: 'wx' });
console.log(`VAPID configuration created at ${destination}. Secret values were not printed. Existing files are never overwritten.`);
