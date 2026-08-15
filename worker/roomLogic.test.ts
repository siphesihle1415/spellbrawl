import { describe, expect, it } from "vitest";
import { RoomLogic } from "./roomLogic";

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

describe("RoomLogic", () => {
  it("tells a late-joining guest that the host already signaled ready", () => {
    const room = new FakeRoom();
    // room.getConnections() must reflect membership at connect time, same as the real Durable Object.
    const logic = new RoomLogic(room as never);

    const host = new FakeConnection("host-1");
    room.add(host);
    logic.onConnect(host as never);
    logic.onMessage(JSON.stringify({ type: "PLAYER_READY", playerId: "PLAYER_A" }), host as never);

    const guest = new FakeConnection("guest-1");
    room.add(guest);
    logic.onConnect(guest as never);

    const guestMessages = messagesOf(guest);
    expect(guestMessages).toContainEqual({ type: "PLAYER_READY", playerId: "PLAYER_A" });
  });

  it("rejects a 3rd connection with close code 4000", () => {
    const room = new FakeRoom();
    const logic = new RoomLogic(room as never);

    const first = new FakeConnection("c1");
    room.add(first);
    logic.onConnect(first as never);

    const second = new FakeConnection("c2");
    room.add(second);
    logic.onConnect(second as never);

    const third = new FakeConnection("c3");
    room.add(third);
    logic.onConnect(third as never);

    expect(third.closeCode).toBe(4000);
  });

  it("only broadcasts PEER_LEFT for a connection that was actually accepted", () => {
    const room = new FakeRoom();
    const logic = new RoomLogic(room as never);

    const first = new FakeConnection("c1");
    room.add(first);
    logic.onConnect(first as never);

    const second = new FakeConnection("c2");
    room.add(second);
    logic.onConnect(second as never);

    const third = new FakeConnection("c3");
    room.add(third);
    logic.onConnect(third as never);
    room.remove("c3");
    logic.onClose(third as never);

    expect(messagesOf(first)).not.toContainEqual({ type: "PEER_LEFT" });

    room.remove("c2");
    logic.onClose(second as never);
    expect(messagesOf(first)).toContainEqual({ type: "PEER_LEFT" });
  });
});
