import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// No real network in tests: a test that needs fetch stubs it (vi.stubGlobal);
// anything else (e.g. the public profiles file) sees a network error.
globalThis.fetch = () => Promise.reject(new TypeError("network disabled in tests"));

// jsdom has <dialog> but not showModal()/close(): enough of them for tests.
if (typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
