import { describe, expect, it, beforeEach } from "vitest";
import { leadSchema, passwordRule, registerSchema } from "@/lib/validators";
import { rateLimit, __resetRateLimits } from "@/lib/rate-limit";
import { parseTags, pct } from "@/lib/utils";

const base = { name: "Jane", source: "Website", status: "NEW", priority: "LOW", value: 100 } as const;

describe("validation", () => {
  it("accepts a minimal lead and rejects bad email / negative value", () => {
    expect(leadSchema.safeParse(base).success).toBe(true);
    expect(leadSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, value: -5 }).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, name: " " }).success).toBe(false);
  });
  it("enforces password strength", () => {
    expect(passwordRule.safeParse("short1").success).toBe(false);
    expect(passwordRule.safeParse("longpassword").success).toBe(false);
    expect(passwordRule.safeParse("Password123!").success).toBe(true);
    expect(registerSchema.safeParse({ orgName: "A", name: "Bo", email: "a@b.co", password: "Password123!" }).success).toBe(false);
  });
  it("helpers", () => { expect(parseTags("a, b,a ,, c")).toEqual(["a", "b", "c"]); expect(pct(1, 3)).toBe(33.3); expect(pct(1, 0)).toBe(0); });
});

describe("rate limiter", () => {
  beforeEach(() => __resetRateLimits());
  it("blocks after the limit and is keyed per bucket", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000);
    expect(() => rateLimit("k", 3, 1000)).toThrow(/Too many/);
    expect(() => rateLimit("other", 3, 1000)).not.toThrow();
  });
});
