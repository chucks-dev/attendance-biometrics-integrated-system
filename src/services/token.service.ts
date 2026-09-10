import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string; // userId
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
  expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'],
};

return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

function expiryDateFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// Refresh tokens are opaque random UUIDs persisted server-side (not JWTs themselves),
// which lets us revoke them individually — a JWT-signed refresh token cannot be revoked
// without a blocklist, so we avoid that failure mode entirely.
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = uuidv4() + uuidv4();
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: expiryDateFromNow(7),
    },
  });
  return token;
}

export async function rotateRefreshToken(oldToken: string) {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });

  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revoked: true },
  });

  const newToken = await issueRefreshToken(existing.userId);
  return { user: existing.user, refreshToken: newToken };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked: true },
  });
}

export async function revokeAllUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}
