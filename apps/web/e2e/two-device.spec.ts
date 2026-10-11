import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import { AUTH, type Ctx, id, run, setVisibility, SPEC_DIR, type Step, visibleTitles } from "./steps";

/**
 * Two browser contexts signed in to one account act as two devices, each with its own tab, cache and Realtime socket
 * (spec/features/realtime.md). Device A signs in with the code from Mailpit; device B gets A's session, because GoTrue
 * won't send a second code to the same email within 60 s.
 */
const en = JSON.parse(readFileSync(join(SPEC_DIR, "i18n/en.json"), "utf8")) as Record<string, string>;

type Device = {
  context: BrowserContext;
  page: Page;
  /** Realtime websockets this tab currently has open. */
  sockets: () => number;
  reloads: () => number;
  do: (step: Step) => Promise<void>;
};

async function openDevice(browser: Browser, ctx: Ctx, from?: Device): Promise<Device> {
  const context = await browser.newContext(from ? { storageState: await from.context.storageState() } : {});
  const page = await context.newPage();
  const open = new Set<object>();
  page.on("websocket", (ws) => {
    if (!new URL(ws.url()).pathname.startsWith("/realtime/")) return;
    open.add(ws);
    ws.on("close", () => open.delete(ws));
  });
  let reloads = -1;
  page.on("load", () => reloads++);
  await page.goto("/");
  return { context, page, sockets: () => open.size, reloads: () => reloads, do: (step) => run(page, step, ctx) };
}

/** Signed in, live (one socket, no banner) and editable. */
async function expectLive(device: Device) {
  await expect(device.page.getByTestId(id("authAccount"))).toBeVisible();
  await expect(device.page.getByTestId(id("connectionBanner"))).toBeHidden();
  await expect(device.page.getByTestId(id("formTitle"))).toBeEnabled();
  await expect.poll(device.sockets).toBe(1);
}

async function expectReadOnly(device: Device, banner: string, title: string) {
  await expect(device.page.getByTestId(id("connectionBanner"))).toContainText(banner);
  await device.do({ expect: "editable", value: false, title });
}

const titles = (device: Device) => expect.poll(() => visibleTitles(device.page), { timeout: 10_000 });

/** A signed in through the UI, B on the same account, both live. */
async function twoDevices(browser: Browser, email: string): Promise<[Device, Device]> {
  const ctx: Ctx = { emails: new Map() };
  const a = await openDevice(browser, ctx);
  await a.do({ do: "signIn", email });
  await expectLive(a);
  const b = await openDevice(browser, ctx, a);
  await expectLive(b);
  return [a, b];
}

test.describe("two devices", () => {
  test.skip(!AUTH, "needs the local Supabase stack (pnpm e2e:auth)");

  let devices: Device[] = [];
  test.afterEach(async () => {
    await Promise.all(devices.map((device) => device.context.close()));
    devices = [];
  });

  test("add, rename, complete and delete show up on the other device without a reload", async ({ browser }) => {
    const [a, b] = (devices = await twoDevices(browser, "live@example.com"));
    await b.do({ expect: "empty" });

    await a.do({ do: "add", title: "Buy milk" });
    await titles(b).toEqual(["Buy milk"]);

    await b.do({ do: "rename", from: "Buy milk", to: "Buy oat milk" });
    await titles(a).toEqual(["Buy oat milk"]);

    await a.do({ do: "toggle", title: "Buy oat milk" });
    await expect(b.page.getByTestId(id("itemToggle", "Buy oat milk"))).toBeChecked();

    await b.do({ do: "delete", title: "Buy oat milk" });
    await expect(a.page.getByTestId(id("empty"))).toBeVisible();

    expect([a.reloads(), b.reloads()]).toEqual([0, 0]);
    expect([a.sockets(), b.sockets()]).toEqual([1, 1]);
  });

  test("an offline device is read-only, then shows the other device's edit once back online", async ({ browser }) => {
    const [a, b] = (devices = await twoDevices(browser, "offline@example.com"));
    await a.do({ do: "add", title: "Pay rent" });
    await titles(b).toEqual(["Pay rent"]);

    await a.do({ do: "goOffline" });
    await expectReadOnly(a, en["connection.offline"], "Pay rent");

    await b.do({ do: "rename", from: "Pay rent", to: "Pay rent today" });
    await titles(b).toEqual(["Pay rent today"]);

    await a.do({ do: "goOnline" });
    await expectLive(a);
    await titles(a).toEqual(["Pay rent today"]);
    expect(a.reloads()).toBe(0);
  });

  test("a hidden device closes its socket, and when shown is read-only until it has caught up", async ({ browser }) => {
    const [a, b] = (devices = await twoDevices(browser, "background@example.com"));
    await a.do({ do: "add", title: "Pay rent" });
    await titles(b).toEqual(["Pay rent"]);

    await setVisibility(a.page, "hidden");
    await expect.poll(a.sockets).toBe(0);
    await expectReadOnly(a, en["connection.reconnecting"], "Pay rent");

    await b.do({ do: "add", title: "Walk dog" });
    await titles(b).toEqual(["Pay rent", "Walk dog"]);

    // Hold A's catch-up pull so the Reconnecting state can be checked after the socket is back.
    let releasePull!: () => void;
    const pullHeld = new Promise<void>((resolve) => (releasePull = resolve));
    const isPull = (url: URL) => url.pathname === "/rest/v1/todos";
    await a.page.route(isPull, async (route) => {
      await pullHeld;
      await route.continue();
    });

    await setVisibility(a.page, "visible");
    await expect.poll(a.sockets).toBe(1);
    await expectReadOnly(a, en["connection.reconnecting"], "Pay rent");
    await titles(a).toEqual(["Pay rent"]);

    releasePull();
    await expectLive(a);
    await titles(a).toEqual(["Pay rent", "Walk dog"]);
    await a.page.unroute(isPull);
    expect(a.reloads()).toBe(0);
  });

  test("guest todos moved on first sign-in show up on the other device", async ({ browser }) => {
    const ctx: Ctx = { emails: new Map() };
    const a = await openDevice(browser, ctx);
    devices = [a];
    await a.do({ do: "add", title: "Buy milk" });
    await a.do({ do: "add", title: "Walk dog" });
    await a.do({ do: "signIn", email: "move@example.com" });
    await a.do({ expect: "movePrompt", text: "Move your 2 guest todos to your account?" });

    const b = await openDevice(browser, ctx, a);
    devices.push(b);
    await expectLive(b);
    await b.do({ expect: "movePrompt", text: null });
    await b.do({ expect: "empty" });

    await a.do({ do: "chooseGuestTodos", choice: "move" });
    await a.do({ expect: "movePrompt", text: null });
    await titles(a).toEqual(["Buy milk", "Walk dog"]);
    await expectLive(a);

    await titles(b).toEqual(["Buy milk", "Walk dog"]);
    expect(b.reloads()).toBe(0);
  });
});
