import { DurableObject } from "cloudflare:workers";
import { RoomLogic, type Connection } from "./roomLogic";

export class RoomDurableObject extends DurableObject {
  private readonly sockets = new Map<string, WebSocket>();
  private readonly logic = new RoomLogic({
    getConnections: () => this.connections(),
    broadcast: (message, without) => {
      for (const [id, socket] of this.sockets) {
        if (without?.includes(id)) continue;
        socket.send(message);
      }
    },
  });

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const id = crypto.randomUUID();

    server.accept();
    // The socket must be registered before onConnect() runs so that room.getConnections()
    // reflects this connection at connect time, matching RoomLogic's documented contract.
    this.sockets.set(id, server);
    const connection = this.asConnection(id, server);

    server.addEventListener("message", (event: MessageEvent) => {
      this.logic.onMessage(event.data as string, connection);
    });
    server.addEventListener("close", () => {
      this.sockets.delete(id);
      this.logic.onClose(connection);
    });
    server.addEventListener("error", () => {
      this.sockets.delete(id);
      this.logic.onClose(connection);
    });

    this.logic.onConnect(connection);

    return new Response(null, { status: 101, webSocket: client });
  }

  private connections(): Connection[] {
    return [...this.sockets.entries()].map(([id, socket]) => this.asConnection(id, socket));
  }

  private asConnection(id: string, socket: WebSocket): Connection {
    return {
      id,
      send: (message) => socket.send(message),
      close: (code, reason) => socket.close(code, reason),
    };
  }
}
