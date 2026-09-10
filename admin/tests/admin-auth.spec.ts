import { expect, test } from "@playwright/test";
import { isAllowedAdminEmail, normaliseEmail } from "../src/lib/admin-email";

test("the admin email comparison is case-insensitive and trims whitespace", async () => {
  expect(normaliseEmail("  YusufMohdSuhair@GMAIL.COM ")).toBe("yusufmohdsuhair@gmail.com");
  expect(isAllowedAdminEmail("  YusufMohdSuhair@GMAIL.COM ", "yusufmohdsuhair@gmail.com")).toBe(true);
});

test("a different account is rejected", async () => {
  expect(isAllowedAdminEmail("other@example.com", "yusufmohdsuhair@gmail.com")).toBe(false);
  expect(isAllowedAdminEmail(undefined, "yusufmohdsuhair@gmail.com")).toBe(false);
});

test("a missing allowlist is fail-closed", async () => {
  expect(isAllowedAdminEmail("yusufmohdsuhair@gmail.com", "")).toBe(false);
});
