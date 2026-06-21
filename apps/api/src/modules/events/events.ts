import type { ServerWebSocket } from "bun";

type EventTopic =
  | "access.scan"
  | "access.table"
  | "attendance.table"
  | "hot-qr.table"
  | "credentials.table"
  | "temporary-daily-qr.table"
  | "vehicles.table"
  | "vehicle-permits.table"
  | "admins.table"
  | "admin-sessions.table"
  | "audit.table"
  | "config.table";

type EventMessage = {
  topic: EventTopic;
  payload: Record<string, unknown>;
  emittedAt: string;
};

const sockets = new Set<ServerWebSocket<unknown>>();

export function registerEventsSocket(socket: ServerWebSocket<unknown>) {
  sockets.add(socket);
}

export function unregisterEventsSocket(socket: ServerWebSocket<unknown>) {
  sockets.delete(socket);
}

export function broadcastEvent(topic: EventTopic, payload: Record<string, unknown>) {
  const message: EventMessage = {
    topic,
    payload,
    emittedAt: new Date().toISOString()
  };

  const serialized = JSON.stringify(message);

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(serialized);
    }
  }
}
