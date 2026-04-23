import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";

const BASE_URL = process.env.SELENIUM_BASE_URL || "http://127.0.0.1:3000";
const BROWSER = process.env.SELENIUM_BROWSER || "chrome";
const HEADLESS = process.env.SELENIUM_HEADED !== "1";

async function buildDriver() {
  const builder = new Builder().forBrowser(BROWSER);

  if (BROWSER === "chrome") {
    const options = new chrome.Options().windowSize({ width: 1280, height: 900 });
    if (HEADLESS) {
      options.addArguments("--headless=new", "--disable-gpu", "--no-sandbox");
    }
    builder.setChromeOptions(options);
  }

  if (BROWSER === "MicrosoftEdge" || BROWSER === "edge") {
    const options = new edge.Options().windowSize({ width: 1280, height: 900 });
    if (HEADLESS) {
      options.addArguments("--headless=new", "--disable-gpu", "--no-sandbox");
    }
    builder.setEdgeOptions(options);
  }

  const driver = await builder.build();
  await driver.manage().setTimeouts({ pageLoad: 30000, script: 10000 });
  return driver;
}

async function openApp(driver, path = "/") {
  await driver.get(`${BASE_URL}${path}`);
  await driver.wait(until.elementLocated(By.css("main")), 15000);
}

async function waitForText(driver, text) {
  await driver.wait(
    until.elementLocated(By.xpath(`//*[contains(normalize-space(.), ${JSON.stringify(text)})]`)),
    15000,
  );
}

async function currentPath(driver) {
  const url = new URL(await driver.getCurrentUrl());
  return url.pathname;
}

async function waitForPath(driver, expectedPath) {
  await driver.wait(async () => (await currentPath(driver)) === expectedPath, 15000);
}

async function assertNoHorizontalOverflow(driver) {
  const hasOverflow = await driver.executeScript(
    "return document.documentElement.scrollWidth > window.innerWidth + 1;",
  );
  assert.equal(hasOverflow, false);
}

describe("CoResearch Selenium smoke tests", () => {
  let driver;

  before(async () => {
    driver = await buildDriver();
  });

  after(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  describe("Login page", () => {
    it("renders the student login screen", async () => {
      await openApp(driver);

      await waitForText(driver, "CoResearch");
      await waitForText(driver, "Student Sign In");
      await waitForText(driver, "Secure, Institution-Verified Access");

      const email = await driver.findElement(By.id("email"));
      const password = await driver.findElement(By.id("password"));
      const submit = await driver.findElement(By.css('button[type="submit"]'));

      assert.equal(await email.getAttribute("placeholder"), "student@university.edu");
      assert.equal(await password.getAttribute("type"), "password");
      assert.equal(await submit.getText(), "Continue");
    });

    it("switches to the university admin login form", async () => {
      await openApp(driver);

      await driver.findElement(By.xpath("//button[normalize-space()='University']")).click();

      await waitForText(driver, "University Admin Access");
      await waitForText(driver, "Institution administrators can log in or register");

      const email = await driver.findElement(By.id("email"));
      assert.equal(await email.getAttribute("placeholder"), "admin@university.edu");
    });

    it("switches back to the student login form", async () => {
      await openApp(driver);

      await driver.findElement(By.xpath("//button[normalize-space()='University']")).click();
      await driver.findElement(By.xpath("//button[normalize-space()='Student']")).click();

      await waitForText(driver, "Student Sign In");
      const email = await driver.findElement(By.id("email"));
      assert.equal(await email.getAttribute("placeholder"), "student@university.edu");
    });

    it("keeps HTML validation on required login fields", async () => {
      await openApp(driver);

      const submit = await driver.findElement(By.css('button[type="submit"]'));
      await submit.click();

      const email = await driver.findElement(By.id("email"));
      const isValid = await driver.executeScript("return arguments[0].validity.valid;", email);

      assert.equal(isValid, false);
    });

    it("rejects malformed email before login submission", async () => {
      await openApp(driver);

      const email = await driver.findElement(By.id("email"));
      await email.sendKeys("not-an-email");
      await driver.findElement(By.id("password")).sendKeys("password123");
      await driver.findElement(By.css('button[type="submit"]')).click();

      const isValid = await driver.executeScript("return arguments[0].validity.valid;", email);
      assert.equal(isValid, false);
    });

    it("accepts text entry in login fields", async () => {
      await openApp(driver);

      const email = await driver.findElement(By.id("email"));
      const password = await driver.findElement(By.id("password"));

      await email.sendKeys("student@university.edu");
      await password.sendKeys("password123");

      assert.equal(await email.getAttribute("value"), "student@university.edu");
      assert.equal(await password.getAttribute("value"), "password123");
    });
  });

  describe("Registration page", () => {
    it("opens registration from the login page", async () => {
      await openApp(driver);

      await driver.findElement(By.linkText("Register")).sendKeys(Key.ENTER);
      await driver.wait(until.urlContains("/register"), 10000);

      await waitForText(driver, "Student Registration");
      await waitForText(driver, "Verification Required");
    });

    it("renders all expected student registration fields", async () => {
      await openApp(driver, "/register");

      await waitForText(driver, "Student Registration");

      const expectedIds = ["name", "email", "password", "university", "studentId", "year", "program", "interests"];
      for (const id of expectedIds) {
        const element = await driver.findElement(By.id(id));
        assert.equal(await element.isDisplayed(), true);
      }
    });

    it("allows users to return from registration to sign in", async () => {
      await openApp(driver, "/register");

      await driver.findElement(By.linkText("Sign in")).sendKeys(Key.ENTER);
      await waitForPath(driver, "/");
      await waitForText(driver, "Student Sign In");
    });
  });

  describe("Route protection", () => {
    const protectedRoutes = ["/dashboard", "/discover", "/admin", "/verification-status", "/document/new"];

    for (const route of protectedRoutes) {
      it(`redirects unauthenticated users away from ${route}`, async () => {
        await openApp(driver, route);
        await waitForPath(driver, "/");
        await waitForText(driver, "Student Sign In");
      });
    }
  });

  describe("Error handling and navigation", () => {
    it("renders the custom not-found page for invalid routes", async () => {
      await openApp(driver, "/route-that-does-not-exist");

      await waitForText(driver, "Page Not Found");
      await waitForText(driver, "doesn't exist or has been moved");
    });

    it("routes the not-found page action through protected dashboard back to login", async () => {
      await openApp(driver, "/route-that-does-not-exist");

      await driver.findElement(By.xpath("//button[contains(normalize-space(.), 'Go to Dashboard')]")).click();
      await waitForPath(driver, "/");
      await waitForText(driver, "Student Sign In");
    });
  });

  describe("Responsive layout", () => {
    it("does not horizontally overflow on desktop login view", async () => {
      await driver.manage().window().setRect({ width: 1280, height: 900 });
      await openApp(driver);

      await assertNoHorizontalOverflow(driver);
    });

    it("does not horizontally overflow on mobile login view", async () => {
      await driver.manage().window().setRect({ width: 390, height: 844 });
      await openApp(driver);

      await assertNoHorizontalOverflow(driver);
    });

    it("does not horizontally overflow on mobile registration view", async () => {
      await driver.manage().window().setRect({ width: 390, height: 844 });
      await openApp(driver, "/register");

      await assertNoHorizontalOverflow(driver);
      await driver.manage().window().setRect({ width: 1280, height: 900 });
    });
  });
});
