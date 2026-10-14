/**
 * Measures real page-load metrics in Chrome against a running PRODUCTION server.
 *   node scripts/perf.mjs [baseUrl]
 * Emulates a mid-range phone on Slow-4G-like network (1.6 Mbps down, 150 ms RTT) with 4x CPU slowdown.
 * Targets: LCP <= 2.5 s, CLS <= 0.1, TBT-proxy (long tasks) low, first-load JS <= ~200 KB compressed.
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const pages = ["/", "/services", "/services/deep-cleaning", "/book", "/contact"];
const browser = await chromium.launch({ channel: "chrome" });

for (const path of pages) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // Transferred (compressed) bytes, by resource type, straight from the protocol.
  let jsBytes = 0, totalBytes = 0;
  const types = new Map();
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    totalBytes += e.encodedDataLength;
    if (types.get(e.requestId) === "Script") jsBytes += e.encodedDataLength;
  });
  await page.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, longTaskMs: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.longTaskMs += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
  });
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    return { ...window.__m, ttfb: nav.responseStart, fcp, load: nav.loadEventEnd };
  });
  console.log(`${path.padEnd(26)} TTFB ${m.ttfb.toFixed(0).padStart(4)}ms  FCP ${m.fcp.toFixed(0).padStart(5)}ms  LCP ${m.lcp.toFixed(0).padStart(5)}ms  CLS ${m.cls.toFixed(3)}  blocking ${m.longTaskMs.toFixed(0).padStart(4)}ms  JS ${(jsBytes / 1024).toFixed(0)}KB  total ${(totalBytes / 1024).toFixed(0)}KB`);
  await ctx.close();
}
await browser.close();
