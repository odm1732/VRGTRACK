import type { User } from "../../drizzle/schema";
import { ONE_YEAR_MS } from "@shared/const";
import { sdk } from "./sdk";

/**
 * Create a session JWT for an email/password user.
 * We use a synthetic openId of the form `email:<userId>` so that
 * `authenticateRequest` can look up the user by openId from the DB.
 */
export async function createSessionToken(user: User): Promise<string> {
  const syntheticOpenId = `email:${user.id}`;
  return sdk.signSession(
    {
      openId: syntheticOpenId,
      appId: process.env.VITE_APP_ID ?? "",
      name: user.name ?? "",
    },
    { expiresInMs: ONE_YEAR_MS }
  );
}
