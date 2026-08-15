import { RoomDurableObject } from "./RoomDurableObject";

export { RoomDurableObject };

export interface Env {
  ROOMS: DurableObjectNamespace<RoomDurableObject>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // partysocket builds URLs as `/parties/<party>/<room>?...`; the room code is always
    // the last path segment regardless of the party/prefix name in front of it.
    const roomCode = url.pathname.split("/").filter(Boolean).pop();
    if (!roomCode) {
      return new Response("Missing room code", { status: 400 });
    }

    const id = env.ROOMS.idFromName(roomCode.toUpperCase());
    const stub = env.ROOMS.get(id);
    return stub.fetch(request);
  },
};
