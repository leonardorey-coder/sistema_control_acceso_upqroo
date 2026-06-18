export function stripSecretFields<T extends Record<string, unknown>>(row: T) {
  const { tokenHash: _tokenHash, passwordHash: _passwordHash, sessionHash: _sessionHash, ...safe } = row;
  return safe;
}
