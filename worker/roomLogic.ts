export interface Connection {
  readonly id: string;
  send(message: string): void;
  close(code: number, reason: string): void;
}

export interface Room {
  getConnections(): Iterable<Connection>;
  broadcast(message: string, without?: string[]): void;
}

export type PlayerId = "PLAYER_A" | "PLAYER_B";

const ROOM_CAPACITY = 2;

export class RoomLogic {
  private readonly playerIdByConnectionId = new Map<string, PlayerId>();
  private readonly readyPlayerIds = new Set<PlayerId>();

  constructor(private readonly room: Room) {}

  onConnect(connection: Connection): void {
    const connections = [...this.room.getConnections()];
    if (connections.length > ROOM_CAPACITY) {
      connection.close(4000, "Room full");
      return;
    }

    const isHost = connections.length === 1;
    const playerId: PlayerId = isHost ? "PLAYER_A" : "PLAYER_B";
    this.playerIdByConnectionId.set(connection.id, playerId);
    connection.send(JSON.stringify({ type: "ROLE_ASSIGNED", playerId, isHost }));

    // broadcast() only reaches connections open at send time, so a PLAYER_READY sent by
    // the host before this connection existed would otherwise be lost forever, leaving
    // this client stuck waiting even though the other player already signaled ready.
    for (const readyPlayerId of this.readyPlayerIds) {
      connection.send(JSON.stringify({ type: "PLAYER_READY", playerId: readyPlayerId }));
    }
  }

  onMessage(message: string, sender: Connection): void {
    const senderPlayerId = this.playerIdByConnectionId.get(sender.id);
    if (senderPlayerId === undefined) return; // never accepted (e.g. rejected 3rd connection)

    let event: { type: string; playerId?: PlayerId };
    try {
      event = JSON.parse(message) as { type: string; playerId?: PlayerId };
    } catch {
      return; // tolerate a malformed/binary frame instead of throwing out of the relay
    }

    // ROLE_ASSIGNED and PEER_LEFT are server-to-client only (emitted from onConnect/onClose
    // above); a client sending one is either buggy or forging the other player's role/
    // disconnect state, so drop it instead of relaying it as if the server said it.
    if (event.type === "ROLE_ASSIGNED" || event.type === "PEER_LEFT") return;

    // STATE_SYNC replaces the receiving client's entire game state, so only the host - the
    // single source of truth for game state - may publish it; otherwise a guest could forge
    // an arbitrary win/loss or HP value straight into the host's reducer.
    if (event.type === "STATE_SYNC" && senderPlayerId !== "PLAYER_A") return;

    // The server is the source of truth for identity: bind any player-scoped message to the
    // sender's assigned role so a client can't drive the other player's inputs (or fabricate
    // solo "co-op" combos) by putting a foreign playerId in the payload.
    let outgoing = message;
    if (event.playerId !== undefined) {
      event.playerId = senderPlayerId;
      outgoing = JSON.stringify(event);
    }
    if (event.type === "PLAYER_READY") {
      this.readyPlayerIds.add(senderPlayerId);
    }
    this.room.broadcast(outgoing, [sender.id]);
  }

  onClose(connection: Connection): void {
    // A connection rejected for being the 3rd in the room never gets a playerId, so its
    // close must not be mistaken for the real peer leaving.
    const playerId = this.playerIdByConnectionId.get(connection.id);
    if (playerId === undefined) return;
    this.playerIdByConnectionId.delete(connection.id);
    // Clear only the leaving player's ready flag, not the surviving peer's — the onConnect
    // replay relies on the survivor's flag to re-signal ready to a rejoining player.
    this.readyPlayerIds.delete(playerId);
    this.room.broadcast(JSON.stringify({ type: "PEER_LEFT" }), [connection.id]);
  }
}
