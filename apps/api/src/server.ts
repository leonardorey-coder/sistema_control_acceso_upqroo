import { serve } from "bun";
import { env } from "./config/env";
import { app } from "./app";
import { registerEventsSocket, unregisterEventsSocket } from "./modules/events/events";

serve({
  fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/api/v1/events") {
      const upgraded = server.upgrade(request);

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      return undefined;
    }

    return app.fetch(request);
  },
  port: env.API_PORT,
  websocket: {
    open(socket) {
      registerEventsSocket(socket);
      socket.send(JSON.stringify({
        topic: "connected",
        payload: { service: "control-acceso-api" },
        emittedAt: new Date().toISOString()
      }));
    },
    close(socket) {
      unregisterEventsSocket(socket);
    },
    message() {
      // Eventos server-driven; el scanner recibe broadcasts y no necesita publicar aqui.
    }
  }
});

console.info(`Control Acceso API listening on http://localhost:${env.API_PORT}`);
