import { describe, expect, it } from "vitest";
import RoomServer from "./room";

class FakeConnection {
  readonly sent: string[] = [];
  closeCode: number | undefined;

  constructor(readonly id: string) {}

  send(message: string): void {
    this.sent.push(message);
  }

  close(code: number, _reason: string): void {
    this.closeCode = code;
  }
}

class FakeRoom {
  private readonly connections = new Map<string, FakeConnection>();

  add(connection: FakeConnection): void {
    this.connections.set(connection.id, connection);
  }

  remove(id: string): void {
    this.connections.delete(id);
  }

  getConnections(): Iterable<FakeConnection> {
    return this.connections.values();
  }

  broadcast(message: string, without?: string[]): void {
    for (const connection of this.connections.values()) {
      if (without?.includes(connection.id)) continue;
      connection.send(message);
    }
  }
}

function messagesOf(connection: FakeConnection): unknown[] {
  return connection.sent.map((message) => JSON.parse(message));
}

describe("RoomServer", () => {
  it("tells a late-joining guest that the host already signaled ready", () => {
    const room = new FakeRoom();
    // room.getConnections() must reflect membership at connect time, same as real PartyKit.
    const server = new RoomServer(room as never);

    const host = new FakeConnection("host-1");
    room.add(host);
    server.onConnect(host as never);
    server.onMessage(JSON.stringify({ type: "PLAYER_READY", playerId: "PLAYER_A" }), host as never);

    const guest = new FakeConnection("guest-1");
    room.add(guest);
    server.onConnect(guest as never);

    const guestMessages = messagesOf(guest);
    expect(guestMessages).toContainEqual({ type: "PLAYER_READY", playerId: "PLAYER_A" });
  });
});
