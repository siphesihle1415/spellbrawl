import type * as Party from "partykit/server";

type PlayerId = "PLAYER_A" | "PLAYER_B";

const ROOM_CAPACITY = 2;

export default class RoomServer implements Party.Server {
  private readonly acceptedConnectionIds = new Set<string>();
  private readonly readyPlayerIds = new Set<PlayerId>();

  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection): void {
    const connections = [...this.room.getConnections()];
    if (connections.length > ROOM_CAPACITY) {
      connection.close(4000, "Room full");
      return;
    }

    this.acceptedConnectionIds.add(connection.id);
    const isHost = connections.length === 1;
    const playerId: PlayerId = isHost ? "PLAYER_A" : "PLAYER_B";
    connection.send(JSON.stringify({ type: "ROLE_ASSIGNED", playerId, isHost }));

    // broadcast() only reaches connections open at send time, so a PLAYER_READY sent by
    // the host before this connection existed would otherwise be lost forever, leaving
    // this client stuck waiting even though the other player already signaled ready.
    for (const readyPlayerId of this.readyPlayerIds) {
      connection.send(JSON.stringify({ type: "PLAYER_READY", playerId: readyPlayerId }));
    }
  }

  onMessage(message: string, sender: Party.Connection): void {
    const event = JSON.parse(message) as { type: string; playerId?: PlayerId };
    if (event.type === "PLAYER_READY" && event.playerId) {
      this.readyPlayerIds.add(event.playerId);
    }
    this.room.broadcast(message, [sender.id]);
  }

  onClose(connection: Party.Connection): void {
    // A connection rejected for being the 3rd in the room never joins acceptedConnectionIds,
    // so its close must not be mistaken for the real peer leaving.
    if (!this.acceptedConnectionIds.delete(connection.id)) return;
    this.readyPlayerIds.clear();
    this.room.broadcast(JSON.stringify({ type: "PEER_LEFT" }), [connection.id]);
  }
}
