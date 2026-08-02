import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { ToastProvider, useToast } from "@/components/Toast";

describe("shared UI semantics", () => {
  it("renders a navigation action as a link without nesting a button", () => {
    render(<ButtonLink href="/create">Create a trade</ButtonLink>);

    expect(screen.getByRole("link", { name: "Create a trade" })).toHaveAttribute("href", "/create");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("associates field labels, hints, required state, and inline errors", () => {
    const { rerender } = render(
      <Field label="Amount" required hint="Encrypted before submission." />,
    );

    const input = screen.getByRole("textbox", { name: "Amount" });
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription("Encrypted before submission.");

    rerender(<Field label="Amount" required error="Enter an amount above zero." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount above zero.");
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveAttribute("aria-invalid", "true");
  });

  it("gives an empty state one clear recovery action", () => {
    render(
      <EmptyState
        icon="inbox"
        title="No trades yet"
        action={<ButtonLink href="/create">Create your first trade</ButtonLink>}
      />,
    );

    expect(screen.getByRole("link", { name: "Create your first trade" })).toHaveAttribute("href", "/create");
  });

  it("opens tooltip content from keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Amounts stay encrypted">
        <button type="button">Privacy details</button>
      </Tooltip>,
    );

    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Amounts stay encrypted");
  });

  it("announces toast feedback without moving focus", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Show error" });
    trigger.focus();
    await user.click(trigger);

    expect(screen.getByRole("region", { name: "Notifications" })).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Transaction failed. Retry from the form.")).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

function ToastHarness() {
  const toast = useToast();
  return <button type="button" onClick={() => toast.error("Transaction failed. Retry from the form.")}>Show error</button>;
}
