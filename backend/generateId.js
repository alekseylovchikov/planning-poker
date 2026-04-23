import crypto from 'crypto';

export function generateId() {
  // 32-bit random value in hex format (8 characters)
  return crypto.randomBytes(4).toString('hex');
}

export function generateSessionToken() {
  // 128-bit random token for session authentication
  return crypto.randomBytes(16).toString('hex');
}
