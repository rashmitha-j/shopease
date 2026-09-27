import crypto from 'crypto';

// "Wireless Earbuds Pro!" -> "wireless-earbuds-pro"
export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// Short random suffix used to keep slugs unique: "wireless-earbuds-3f9a1c"
export const randomSuffix = () => crypto.randomBytes(3).toString('hex');

// Escape user input before putting it in a RegExp, so characters like
// ".*(" are matched literally and can't be used for slow/malicious patterns.
export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
