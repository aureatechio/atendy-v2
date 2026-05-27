import crypto from "node:crypto";
import { getImpersonationSecret } from "@/lib/supabase/env";

export const IMPERSONATION_COOKIE = "atendy-impersonator";

export const impersonationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export type ImpersonationPayload = {
  impersonatorId: string;
  impersonatorName: string;
  iat: number;
};

function sign(payloadB64: string) {
  return crypto.createHmac("sha256", getImpersonationSecret()).update(payloadB64).digest("base64url");
}

export function encodeImpersonationCookie(payload: Omit<ImpersonationPayload, "iat">) {
  const full: ImpersonationPayload = { ...payload, iat: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function decodeImpersonationCookie(value: string | undefined | null): ImpersonationPayload | null {
  if (!value) return null;

  const [payloadB64, signature] = value.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as ImpersonationPayload;
  } catch {
    return null;
  }
}
