import { beforeAll, describe, expect, it } from "vitest";

// The web app signs tokens (src/lib/realtime.ts) and the realtime service
// verifies them (../realtime/token.mjs). They are separate copies, so this
// test fails if the two ever drift apart.
const SECRET = "cross-check-secret-123456";

beforeAll(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "x".repeat(32),
    MONGODB_URI: "mongodb://localhost/test",
    GOOGLE_CLIENT_ID: "x",
    GOOGLE_CLIENT_SECRET: "x",
    REALTIME_URL: "http://localhost:4000",
    REALTIME_SECRET: SECRET,
  });
});

describe("realtime token compatibility", () => {
  it("tokens signed by the web app are accepted by the realtime service", async () => {
    const { signRealtimeToken } = await import("@/lib/realtime");
    const { verifyToken } = await import("../../realtime/token.mjs");
    const token = signRealtimeToken(["biz:abc", "community:india"], 60);
    expect(verifyToken(token, SECRET)?.rooms).toEqual(["biz:abc", "community:india"]);
    expect(verifyToken(token, "another-secret-000000")).toBeNull();
  });
});
