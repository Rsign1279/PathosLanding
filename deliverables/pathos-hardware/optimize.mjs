import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { resample, dedup, prune, draco, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';

const [,, input, output, mode] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const doc = await io.read(input);
const KEEP_UV = new Set(['Liquid Retina active display', 'PATHOS dashboard • inset rounded window']);
let stripped = 0;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  if (KEEP_UV.has(node.getName()) || KEEP_UV.has(mesh.getName())) continue;
  for (const prim of mesh.listPrimitives()) {
    for (const sem of prim.listSemantics()) if (sem.startsWith('TEXCOORD')) { prim.setAttribute(sem, null); stripped++; }
  }
}
const steps = [resample({ tolerance: 1e-4 }), dedup(), prune({ keepAttributes: true })];
if (mode === 'mobile') {
  await MeshoptSimplifier.ready;
  steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.0008, lockBorder: true }));
}
steps.push(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
await doc.transform(...steps);
await io.write(output, doc);
let tris = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
console.log(mode || 'desktop', 'stripped uv sets', stripped, 'triangles', Math.round(tris));
