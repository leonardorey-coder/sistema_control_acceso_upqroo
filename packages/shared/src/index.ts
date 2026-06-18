export type ApiHealth = {
  ok: true;
  service: "control-acceso-api";
  version: string;
  checkedAt: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
