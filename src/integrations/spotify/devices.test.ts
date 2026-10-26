import { expect, it } from "vitest";
import { selectDevice } from "./devices";

it("prefers the active phone over an idle desktop and preserves explicit choices", () => {
  const devices = [
    { id: "desktop", name: "Desktop" },
    { id: "phone", name: "Phone", is_active: true },
    { id: "restricted", name: "Speaker", is_active: true, is_restricted: true },
  ];
  expect(selectDevice(devices, "")).toBe("phone");
  expect(selectDevice(devices, "desktop")).toBe("desktop");
  expect(selectDevice(devices, "restricted")).toBe("phone");
  expect(selectDevice([], "phone")).toBe("");
});
