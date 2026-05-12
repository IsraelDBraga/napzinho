// Structured JSON logger. Never include secrets in `data`.

export type LogLevel = "info" | "warn" | "error";

export function log(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {},
): void {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
