const EXTERNAL_ERROR_PATTERNS = [
  "_0x2f79fe is not defined",
  "DeviceModeDestinationsPlugin:: Failed to get the ready status",
  "Facebook-Pixel___",
  "signal timed out",
];

function isKnownExternalPreviewError(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return EXTERNAL_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function shouldSilenceErrorEvent(event: ErrorEvent): boolean {
  const source = event.filename ?? "";
  return (
    isKnownExternalPreviewError(event.message) ||
    isKnownExternalPreviewError(event.error) ||
    (source.includes("vendor-sentry") && isKnownExternalPreviewError(event.message))
  );
}

function shouldSilenceRejectionEvent(event: PromiseRejectionEvent): boolean {
  return isKnownExternalPreviewError(event.reason);
}

export function installExternalErrorGuard(): void {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "error",
    (event) => {
      if (!shouldSilenceErrorEvent(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!shouldSilenceRejectionEvent(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}