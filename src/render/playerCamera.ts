import type { PlayerId } from "../game/types";

export const PLAYER_CAMERA_OFFSET: Record<PlayerId, number> = {
  PLAYER_A: -0.42,
  PLAYER_B: 0.42,
};

export function playerCameraX(roomCenterX: number, playerId: PlayerId, preview: boolean): number {
  return roomCenterX + (preview ? 0 : PLAYER_CAMERA_OFFSET[playerId]);
}
