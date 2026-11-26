import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

describe("PanelErrorBoundary", () => {
  it("catches a throwing view, and Retry remounts it", async () => {
    let fail = true;
    function View() {
      if (fail) throw new Error("broken view");
      return <p>view ok</p>;
    }
    const onReset = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PanelErrorBoundary onReset={onReset}>
        <View />
      </PanelErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong in this tab.");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("view ok")).toBeInTheDocument();
    spy.mockRestore();
  });
});
