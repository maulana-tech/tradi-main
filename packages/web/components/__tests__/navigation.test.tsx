import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/BottomNav";

const navigationState = vi.hoisted(() => ({ pathname: "/portfolio" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

describe("mobile navigation", () => {
  it("marks the current destination semantically", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /portfolio/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /market/i })).not.toHaveAttribute("aria-current");
  });

  it("exposes secondary destinations from the More menu", async () => {
    const user = userEvent.setup();
    render(<BottomNav />);

    await user.click(screen.getByRole("button", { name: "More destinations" }));

    expect(await screen.findByRole("menuitem", { name: "Prices" })).toHaveAttribute("href", "/prices");
    expect(screen.getByRole("menuitem", { name: "Analytics" })).toHaveAttribute("href", "/analytics");
    expect(screen.getByRole("menuitem", { name: "Faucet" })).toHaveAttribute("href", "/faucet");
    expect(screen.getByRole("menuitem", { name: "Docs" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("menuitem", { name: "Source" })).toHaveAttribute("target", "_blank");
  });
});
