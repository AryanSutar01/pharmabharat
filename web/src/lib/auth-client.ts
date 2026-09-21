"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export function signInWithGoogle(callbackURL = "/app") {
  return authClient.signIn.social({ provider: "google", callbackURL });
}
