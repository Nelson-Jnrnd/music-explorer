import type { Device } from "./types";

export function selectDevice(devices: Device[], previous: string): string {
  const available = devices.filter((device) => !device.is_restricted);
  return (available.find((device) => device.id === previous) ??
    available.find((device) => device.is_active) ??
    available[0])?.id ?? "";
}
