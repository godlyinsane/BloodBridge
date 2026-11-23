import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data = [];

    if (pathname.endsWith("/features/map/banks") || pathname.endsWith("/blood-banks")) {
      data = [{
        _id: "bank-demo",
        id: "bank-demo",
        name: "Bilaspur Blood Bank",
        city: "Bilaspur",
        state: "Chhattisgarh",
        address: "Demo Road",
        phone: "07752-000000",
        openingHours: "9 AM–5 PM",
        lat: 22.0797,
        lng: 82.1391,
      }];
    } else if (pathname.endsWith("/camps") || pathname.endsWith("/features/map/camps")) {
      data = [{
        _id: "camp-demo",
        title: "Community Donation Camp",
        organizer: "RaktSetu",
        location: "Bilaspur",
        city: "Bilaspur",
        state: "Chhattisgarh",
        date: "2030-06-14T09:00:00.000Z",
        contactPhone: "07752-000000",
      }];
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });

  await page.goto("/");
});

test("mobile layout stays within common phone and tablet widths", async ({ page }) => {
  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Home" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      offenders: [...document.querySelectorAll("body *")]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            className: typeof element.className === "string" ? element.className : "",
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            text: (element.textContent || "").trim().slice(0, 45),
            style: element.getAttribute("style") || "",
          };
        })
        .filter((element) => element.right > window.innerWidth + 2 && element.width > 0)
        .slice(0, 12),
    }));

    expect(dimensions.document, `document overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(width + 1);
    expect(dimensions.body, `body overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(width + 1);
  }
});

test("navigation works by touch-sized buttons and Camps & Banks content renders", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const campsButton = page.getByRole("button", { name: "Camps & Banks" });
  await expect(campsButton).toBeVisible();
  await campsButton.click();
  await expect(campsButton).toHaveClass(/active/);
  await expect(page.getByRole("heading", { name: /camp or blood bank/i })).toBeVisible();

  const donorButton = page.getByRole("button", { name: "Donor", exact: true });
  await donorButton.click();
  await expect(donorButton).toHaveClass(/active/);

  const recipientButton = page.getByRole("button", { name: "Recipient", exact: true });
  await recipientButton.click();
  await expect(recipientButton).toHaveClass(/active/);
});

test("home tools and donor/recipient forms behave safely on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: /check your eligibility/i }).click();
  await expect(page.getByText(/Question 1 of/i)).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByText(/Question 2 of/i)).toBeVisible();

  await page.getByRole("button", { name: /show donor map/i }).click();
  await expect(page.getByText(/Live donor map/i)).toBeVisible();
  await expect(page.getByText(/No available, verified donor locations/i)).toBeVisible();

  await page.getByRole("button", { name: "Recipient", exact: true }).click();
  await page.getByLabel("Hospital / recipient reference").fill("Demo Hospital");
  await page.getByRole("button", { name: "Find matching donors" }).click();
  await expect(page.getByText(/Set the hospital.s real location.*valid latitude and longitude/i)).toBeVisible();

  await page.getByRole("button", { name: "Donor", exact: true }).click();
  await expect(page.getByText("Register as a donor")).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Phone number")).toBeVisible();
});
