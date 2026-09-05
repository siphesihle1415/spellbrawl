// Shared glTF I/O. The committed GLBs use EXT_meshopt_compression, which a bare NodeIO won't read.
import { writeFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import draco3d from "draco3dgltf";

export async function createIO() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });
}

// NodeIO.write() picks glTF-vs-GLB from the file extension and will silently emit external
// .bin/.webp sidecars. Serialize to GLB explicitly instead.
export function writeBinaryGLB(io, document, filePath) {
  return io.writeBinary(document).then((glb) => writeFileSync(filePath, glb));
}
