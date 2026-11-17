import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 48): string => randomBytes(bytes).toString('base64url');
export const uuid = (): string => randomUUID();

/** Room codes: 6 chars, unambiguous alphabet (no 0/O/1/I/L), CSPRNG based. ~887M combinations. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function randomRoomCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
