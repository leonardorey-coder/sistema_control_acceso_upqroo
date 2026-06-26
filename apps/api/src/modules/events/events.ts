import type { ServerWebSocket } from "bun";
import { env } from "../../config/env";

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
const immediateTopics = new Set<EventTopic>(["access.scan"]);
const pendingEvents = new Map<EventTopic, EventMessage>();
const pendingTimers = new Map<EventTopic, ReturnType<typeof setTimeout>>();
const eventMetrics = {
  sockets: 0,
  messagesSent: 0,
  messagesQueued: 0,
  messagesCoalesced: 0,
  sendsFailed: 0,
  byTopic: {} as Record<EventTopic, number>
};

function sendMessage(message: EventMessage) {
  const serialized = JSON.stringify(message);

  for (const socket of sockets) {
    if (socket.readyState !== WebSocket.OPEN) continue;

    try {
      socket.send(serialized);
      eventMetrics.messagesSent += 1;
      eventMetrics.byTopic[message.topic] = (eventMetrics.byTopic[message.topic] ?? 0) + 1;
    } catch {
      eventMetrics.sendsFailed += 1;
    }
  }
}

function flushTopic(topic: EventTopic) {
  const message = pendingEvents.get(topic);
  pendingEvents.delete(topic);
  const timer = pendingTimers.get(topic);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(topic);

  if (message) sendMessage(message);
}

export function registerEventsSocket(socket: ServerWebSocket<unknown>) {
  sockets.add(socket);
  eventMetrics.sockets = sockets.size;
}

export function unregisterEventsSocket(socket: ServerWebSocket<unknown>) {
  sockets.delete(socket);
  eventMetrics.sockets = sockets.size;
}

export function broadcastEvent(topic: EventTopic, payload: Record<string, unknown>) {
  const message: EventMessage = {
    topic,
    payload,
    emittedAt: new Date().toISOString()
  };

  if (env.EVENT_COALESCE_MS <= 0 || immediateTopics.has(topic)) {
    sendMessage(message);
    return;
  }

  if (pendingEvents.has(topic)) {
    eventMetrics.messagesCoalesced += 1;
  } else {
    eventMetrics.messagesQueued += 1;
  }

  pendingEvents.set(topic, message);

  if (!pendingTimers.has(topic)) {
    pendingTimers.set(topic, setTimeout(() => flushTopic(topic), env.EVENT_COALESCE_MS));
  }
}

export function getEventMetrics() {
  return {
    ...eventMetrics,
    sockets: sockets.size,
    pendingTopics: pendingEvents.size,
    byTopic: { ...eventMetrics.byTopic }
  };
}

export function resetEventMetricsForTests() {
  for (const timer of pendingTimers.values()) clearTimeout(timer);
  pendingEvents.clear();
  pendingTimers.clear();
  eventMetrics.messagesSent = 0;
  eventMetrics.messagesQueued = 0;
  eventMetrics.messagesCoalesced = 0;
  eventMetrics.sendsFailed = 0;
  eventMetrics.byTopic = {} as Record<EventTopic, number>;
}
