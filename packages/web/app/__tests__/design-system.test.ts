import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function productSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "slides" || entry.name === "__tests__" ? [] : productSources(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
  });
}

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing color token: ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe("design-system contrast", () => {
  it.each([
    ["foreground on canvas", "--color-foreground", "--color-bg"],
    ["secondary text on surface", "--color-text-secondary", "--color-surface"],
    ["muted text on surface", "--color-text-muted", "--color-surface"],
    ["white CTA text on violet", "--color-primary-fg", "--color-primary"],
    ["danger text on surface", "--color-danger-text", "--color-surface"],
  ])("keeps %s at WCAG AA for normal text", (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps control boundaries at the WCAG non-text threshold", () => {
    expect(contrast(token("--color-border-control"), token("--color-surface-low"))).toBeGreaterThanOrEqual(3);
  });

  it("uses valid CSS custom-property references in product components", () => {
    const sources = [
      ...productSources(resolve(process.cwd(), "app")),
      ...productSources(resolve(process.cwd(), "components")),
    ];
    expect(sources.join("\n")).not.toMatch(/\[--color-/);
  });
});
