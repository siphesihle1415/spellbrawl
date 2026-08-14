import PartySocket from "partysocket";
import type { RoomTransport, SemanticRoomEvent } from "./RoomTransport";

const DEFAULT_HOST = "127.0.0.1:1999";

export class PartyKitRoomTransport implements RoomTransport {
  private socket: PartySocket | null = null;
  private readonly listeners = new Set<(event: SemanticRoomEvent) => void>();

  connect(roomCode: string): Promise<void> {
    return new Promise((resolve) => {
      const socket = new PartySocket({
        host: import.meta.env.VITE_PARTYKIT_HOST ?? DEFAULT_HOST,
        room: roomCode.toUpperCase(),
      });
      this.socket = socket;

      // Attached synchronously at socket creation (not after connect() resolves) so no
      // message sent immediately by the server's onConnect handler can be missed.
      socket.addEventListener("message", (message: MessageEvent<string>) => {
        const event = JSON.parse(message.data) as SemanticRoomEvent;
        this.listeners.forEach((listener) => listener(event));
      });

      // partysocket retries transient connection failures on its own (maxRetries is
      // infinite by default) and still fires "open" once it succeeds, so a single "error"
      // event here is not a terminal failure — only resolve, never reject, on "open".
      socket.addEventListener("open", () => resolve(), { once: true });
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
