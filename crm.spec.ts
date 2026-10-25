import { expect, test } from "@playwright/test";
// Requires: database migrated + seeded (npm run db:seed)

async function login(page: import("@playwright/test").Page, email = "admin@salesflow.dev") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/login/);
});

test("rejects wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@salesflow.dev");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
});

test("admin sees dashboard KPIs and can create a lead", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Total leads")).toBeVisible();
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).first().click();
  const name = `E2E Lead ${Date.now()}`;
  await page.getByLabel("Name *").fill(name);
  await page.getByRole("button", { name: "Create lead" }).click();
  await expect(page.getByText("Lead created")).toBeVisible();
  await page.getByPlaceholder("Search name, email, company…").fill(name);
  await expect(page.getByRole("link", { name })).toBeVisible();
});

test("sales rep cannot access admin pages", async ({ page }) => {
  await login(page, "rep@salesflow.dev");
  await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);
  await page.goto("/team");
  await expect(page).toHaveURL(/dashboard/);
});
