// src/lib/auth/registration-token.ts
import { SignJWT, jwtVerify } from 'jose';

const REGISTRATION_TOKEN_EXPIRY = '10m';

function getRegistrationSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || 'medkart-default-dev-secret-key-at-least-32-chars';
  return new TextEncoder().encode(secret);
}

export interface RegistrationTokenPayload {
  phone: string;
  verified: boolean;
}

export async function createRegistrationToken(phone: string): Promise<string> {
  const normalizedPhone = phone.trim().replace(/\D/g, '').slice(-10);
  return await new SignJWT({ phone: normalizedPhone, verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REGISTRATION_TOKEN_EXPIRY)
    .sign(getRegistrationSecret());
}

export async function verifyRegistrationToken(token: string): Promise<RegistrationTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getRegistrationSecret(), {
      algorithms: ['HS256'],
    });
    if (payload.verified === true && typeof payload.phone === 'string') {
      return {
        phone: payload.phone,
        verified: true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

