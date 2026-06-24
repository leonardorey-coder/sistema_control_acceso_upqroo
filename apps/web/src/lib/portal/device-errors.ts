export function getApiErrorCode(error: unknown) {
  return error instanceof Error && "code" in error ? String(error.code) : "";
}

export function isDeviceBindingError(code: string) {
  return [
    "DEVICE_NOT_FOUND",
    "DEVICE_PROOF_REQUIRED",
    "DEVICE_CHALLENGE_INVALID",
    "DEVICE_KEY_INVALID",
    "DEVICE_SIGNATURE_INVALID"
  ].includes(code);
}
