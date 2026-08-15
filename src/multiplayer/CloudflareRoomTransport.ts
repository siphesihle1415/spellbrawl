import PartySocket from "partysocket";
import { clientRuntimeConfig } from "../config/runtime";
import type { RoomTransport, SemanticRoomEvent } from "./RoomTransport";

export class CloudflareRoomTransport implements RoomTransport {
  private socket: PartySocket | null = null;
  private readonly listeners = new Set<(event: SemanticRoomEvent) => void>();

  connect(roomCode: string): Promise<void> {
    // Close any prior socket first: otherwise reconnecting (e.g. "Create a new room" after
    // PEER_LEFT) leaks the old WebSocket, whose message listener keeps delivering events
    // from the abandoned room and whose connection still counts against room capacity.
    this.socket?.close();
    this.socket = null;

    return new Promise((resolve, reject) => {
      const socket = new PartySocket({
        host: clientRuntimeConfig.workerHost,
        room: roomCode.toUpperCase(),
      });
      this.socket = socket;

      // partysocket retries transient connection failures on its own (maxRetries is
      // infinite by default), so a single "error" event is not terminal. But if it never
      // connects (bad host, worker down) "open" would never fire and the UI would hang on
      // "Connecting…" forever, so reject after a timeout to surface a real error.
      const timeout = setTimeout(() => {
        socket.close();
        if (this.socket === socket) this.socket = null;
        reject(new Error("Timed out connecting to the room."));
      }, clientRuntimeConfig.roomConnectTimeoutMs);

      // Attached synchronously at socket creation (not after connect() resolves) so no
      // message sent immediately by the server's onConnect handler can be missed.
      socket.addEventListener("message", (message: MessageEvent<string>) => {
        let event: SemanticRoomEvent;
        try {
          event = JSON.parse(message.data) as SemanticRoomEvent;
        } catch {
          return; // ignore a malformed frame rather than throwing inside the listener
        }
        this.listeners.forEach((listener) => listener(event));
      });

      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  }

  publish(event: SemanticRoomEvent): void {
    this.socket?.send(JSON.stringify(event));
  }

  subscribe(listener: (event: SemanticRoomEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.listeners.clear();
  }
}
