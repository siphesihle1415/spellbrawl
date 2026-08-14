import type * as Party from "partykit/server";

type PlayerId = "PLAYER_A" | "PLAYER_B";

const ROOM_CAPACITY = 2;

export default class RoomServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection): void {
    const connections = [...this.room.getConnections()];
    if (connections.length > ROOM_CAPACITY) {
      connection.close(4000, "Room full");
      return;
    }

    const isHost = connections.length === 1;
    const playerId: PlayerId = isHost ? "PLAYER_A" : "PLAYER_B";
    connection.send(JSON.stringify({ type: "ROLE_ASSIGNED", playerId, isHost }));
  }

  onMessage(message: string, sender: Party.Connection): void {
    this.room.broadcast(message, [sender.id]);
  }

  onClose(connection: Party.Connection): void {
    this.room.broadcast(JSON.stringify({ type: "PEER_LEFT" }), [connection.id]);
  }
}
