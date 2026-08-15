/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_HOST?: string;
  readonly VITE_ROOM_CONNECT_TIMEOUT_MS?: string;
  readonly VITE_DIRECTOR_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
