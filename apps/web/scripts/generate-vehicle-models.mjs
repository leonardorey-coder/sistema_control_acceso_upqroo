import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, "static/models/vehicles");

const materials = {
  body: { baseColorFactor: [1, 0.55, 0.08, 1], metallicFactor: 0.08, roughnessFactor: 0.58 },
  bodyDark: { baseColorFactor: [0.95, 0.42, 0.04, 1], metallicFactor: 0.08, roughnessFactor: 0.62 },
  glass: { baseColorFactor: [0.16, 0.22, 0.28, 0.82], metallicFactor: 0, roughnessFactor: 0.22 },
  tire: { baseColorFactor: [0.03, 0.03, 0.03, 1], metallicFactor: 0, roughnessFactor: 0.72 },
  rim: { baseColorFactor: [0.78, 0.78, 0.74, 1], metallicFactor: 0.35, roughnessFactor: 0.36 },
  light: { baseColorFactor: [1, 0.95, 0.72, 1], metallicFactor: 0, roughnessFactor: 0.18 },
  redLight: { baseColorFactor: [0.85, 0.04, 0.03, 1], metallicFactor: 0, roughnessFactor: 0.22 },
  dark: { baseColorFactor: [0.11, 0.11, 0.1, 1], metallicFactor: 0, roughnessFactor: 0.7 }
};

function pad(length) {
  return (4 - (length % 4)) % 4;
}

function box(name, center, size, material) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const x = sx / 2;
  const y = sy / 2;
  const z = sz / 2;
  const positions = [
    [cx - x, cy - y, cz + z], [cx + x, cy - y, cz + z], [cx + x, cy + y, cz + z], [cx - x, cy + y, cz + z],
    [cx + x, cy - y, cz - z], [cx - x, cy - y, cz - z], [cx - x, cy + y, cz - z], [cx + x, cy + y, cz - z],
    [cx - x, cy + y, cz + z], [cx + x, cy + y, cz + z], [cx + x, cy + y, cz - z], [cx - x, cy + y, cz - z],
    [cx - x, cy - y, cz - z], [cx + x, cy - y, cz - z], [cx + x, cy - y, cz + z], [cx - x, cy - y, cz + z],
    [cx + x, cy - y, cz + z], [cx + x, cy - y, cz - z], [cx + x, cy + y, cz - z], [cx + x, cy + y, cz + z],
    [cx - x, cy - y, cz - z], [cx - x, cy - y, cz + z], [cx - x, cy + y, cz + z], [cx - x, cy + y, cz - z]
  ];
  const indices = [];
  for (let face = 0; face < 6; face += 1) {
    const offset = face * 4;
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  return { name, positions, indices, material };
}

function wedge(name, center, size, material, slope = "front") {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const x = sx / 2;
  const y = sy / 2;
  const z = sz / 2;
  const frontTop = slope === "front" ? y * 0.45 : y;
  const rearTop = slope === "rear" ? y * 0.45 : y;
  const vertices = [
    [cx - x, cy - y, cz - z], [cx + x, cy - y, cz - z], [cx + x, cy - y, cz + z], [cx - x, cy - y, cz + z],
    [cx - x, cy + rearTop, cz - z], [cx + x, cy + frontTop, cz - z], [cx + x, cy + frontTop, cz + z], [cx - x, cy + rearTop, cz + z]
  ];
  const faces = [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [3, 2, 6, 7],
    [1, 0, 4, 5],
    [1, 5, 6, 2],
    [0, 3, 7, 4]
  ];
  const positions = [];
  const indices = [];
  for (const face of faces) {
    const base = positions.length;
    for (const index of face) positions.push(vertices[index]);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { name, positions, indices, material };
}

function cylinder(name, center, radius, depth, material, segments = 28, axis = "z") {
  const [cx, cy, cz] = center;
  const positions = [];
  const indices = [];
  const half = depth / 2;

  function point(offset, angle) {
    const a = (angle / segments) * Math.PI * 2;
    const u = Math.cos(a) * radius;
    const v = Math.sin(a) * radius;
    if (axis === "z") return [cx + u, cy + v, cz + offset];
    if (axis === "x") return [cx + offset, cy + u, cz + v];
    return [cx + u, cy + offset, cz + v];
  }

  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const base = positions.length;
    positions.push(point(-half, i), point(-half, next), point(half, next), point(half, i));
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const frontCenter = positions.length;
  positions.push(axis === "z" ? [cx, cy, cz + half] : axis === "x" ? [cx + half, cy, cz] : [cx, cy + half, cz]);
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const base = positions.length;
    positions.push(point(half, i), point(half, next));
    indices.push(frontCenter, base, base + 1);
  }

  const backCenter = positions.length;
  positions.push(axis === "z" ? [cx, cy, cz - half] : axis === "x" ? [cx - half, cy, cz] : [cx, cy - half, cz]);
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const base = positions.length;
    positions.push(point(-half, next), point(-half, i));
    indices.push(backCenter, base, base + 1);
  }

  return { name, positions, indices, material };
}

function sedanParts() {
  const parts = [
    wedge("hood", [1.0, 0.48, 0], [1.25, 0.42, 1.28], "body", "front"),
    box("cabin", [-0.2, 0.78, 0], [1.45, 0.78, 1.12], "body"),
    wedge("trunk", [-1.15, 0.48, 0], [1.05, 0.38, 1.22], "bodyDark", "rear"),
    box("lower-body", [0, 0.22, 0], [3.35, 0.54, 1.36], "body"),
    box("front-windshield", [0.58, 0.92, 0.01], [0.12, 0.48, 1.0], "glass"),
    box("rear-windshield", [-0.9, 0.9, 0.01], [0.12, 0.44, 0.98], "glass"),
    box("side-window-left", [-0.18, 0.93, 0.58], [1.0, 0.34, 0.08], "glass"),
    box("side-window-right", [-0.18, 0.93, -0.58], [1.0, 0.34, 0.08], "glass"),
    box("front-light-left", [1.72, 0.32, 0.36], [0.06, 0.13, 0.24], "light"),
    box("front-light-right", [1.72, 0.32, -0.36], [0.06, 0.13, 0.24], "light"),
    box("tail-light-left", [-1.72, 0.32, 0.38], [0.06, 0.13, 0.22], "redLight"),
    box("tail-light-right", [-1.72, 0.32, -0.38], [0.06, 0.13, 0.22], "redLight")
  ];
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.72, 0.72]) {
      parts.push(cylinder("tire", [x, -0.05, z], 0.28, 0.22, "tire", 32, "z"));
      parts.push(cylinder("rim", [x, -0.05, z], 0.15, 0.235, "rim", 24, "z"));
    }
  }
  return parts;
}

function pickupParts() {
  return [
    ...sedanParts().filter((part) => !part.name.includes("trunk") && !part.name.includes("rear-windshield")),
    box("bed", [-1.18, 0.47, 0], [1.45, 0.5, 1.32], "bodyDark"),
    box("bed-top", [-1.18, 0.76, 0], [1.35, 0.08, 1.22], "dark")
  ];
}

function motorcycleParts() {
  return [
    cylinder("front-tire", [0.9, 0, 0], 0.34, 0.16, "tire", 32, "z"),
    cylinder("rear-tire", [-0.9, 0, 0], 0.34, 0.16, "tire", 32, "z"),
    box("frame", [0, 0.34, 0], [1.45, 0.14, 0.18], "body"),
    wedge("seat", [-0.35, 0.55, 0], [0.75, 0.18, 0.28], "dark", "rear"),
    box("tank", [0.25, 0.55, 0], [0.58, 0.26, 0.34], "bodyDark"),
    box("fork", [0.72, 0.34, 0], [0.08, 0.72, 0.08], "rim"),
    box("handlebar", [0.88, 0.75, 0], [0.08, 0.08, 0.68], "dark")
  ];
}

function bicycleParts() {
  return [
    cylinder("front-wheel", [0.82, 0, 0], 0.36, 0.08, "tire", 32, "z"),
    cylinder("rear-wheel", [-0.82, 0, 0], 0.36, 0.08, "tire", 32, "z"),
    box("top-tube", [0, 0.46, 0], [1.25, 0.06, 0.06], "body"),
    box("down-tube", [0.18, 0.3, 0], [1.05, 0.06, 0.06], "body"),
    box("seat", [-0.35, 0.72, 0], [0.34, 0.08, 0.22], "dark"),
    box("handlebar", [0.84, 0.7, 0], [0.08, 0.08, 0.52], "dark")
  ];
}

function buildGlb(parts, outputName) {
  const materialNames = Object.keys(materials);
  const positions = [];
  const indices = [];
  const primitives = [];

  for (const part of parts) {
    const vertexOffset = positions.length / 3;
    const indexOffset = indices.length;
    for (const vertex of part.positions) positions.push(...vertex);
    for (const index of part.indices) indices.push(vertexOffset + index);
    primitives.push({
      attributes: { POSITION: 0 },
      indices: 1,
      material: materialNames.indexOf(part.material)
    });
    primitives[primitives.length - 1].indexOffset = indexOffset;
    primitives[primitives.length - 1].indexCount = part.indices.length;
  }

  const positionBuffer = Buffer.alloc(positions.length * 4);
  positions.forEach((value, index) => positionBuffer.writeFloatLE(value, index * 4));
  const indexBuffer = Buffer.alloc(indices.length * 2);
  indices.forEach((value, index) => indexBuffer.writeUInt16LE(value, index * 2));
  const binary = Buffer.concat([
    positionBuffer,
    Buffer.alloc(pad(positionBuffer.length)),
    indexBuffer,
    Buffer.alloc(pad(indexBuffer.length))
  ]);

  const indexByteOffset = positionBuffer.length + pad(positionBuffer.length);
  const jsonPrimitives = primitives.map((primitive, primitiveIndex) => ({
    attributes: primitive.attributes,
    indices: primitiveIndex + 1,
    material: primitive.material
  }));

  const json = {
    asset: { version: "2.0", generator: "control-acceso-upqroo vehicle asset generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, rotation: [0.18, 0.12, 0, 0.98] }],
    meshes: [{ primitives: jsonPrimitives }],
    materials: materialNames.map((name) => ({
      name,
      pbrMetallicRoughness: materials[name]
    })),
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: indexByteOffset, byteLength: indexBuffer.length, target: 34963 }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min: [
          Math.min(...positions.filter((_, index) => index % 3 === 0)),
          Math.min(...positions.filter((_, index) => index % 3 === 1)),
          Math.min(...positions.filter((_, index) => index % 3 === 2))
        ],
        max: [
          Math.max(...positions.filter((_, index) => index % 3 === 0)),
          Math.max(...positions.filter((_, index) => index % 3 === 1)),
          Math.max(...positions.filter((_, index) => index % 3 === 2))
        ]
      },
      ...primitives.map((primitive) => ({
        bufferView: 1,
        byteOffset: primitive.indexOffset * 2,
        componentType: 5123,
        count: primitive.indexCount,
        type: "SCALAR"
      }))
    ]
  };

  let jsonBuffer = Buffer.from(JSON.stringify(json));
  jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(pad(jsonBuffer.length), 0x20)]);
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);

  writeFileSync(join(outputDir, outputName), Buffer.concat([header, jsonHeader, jsonBuffer, binaryHeader, binary]));
}

mkdirSync(outputDir, { recursive: true });
buildGlb(sedanParts(), "car.glb");
buildGlb(pickupParts(), "truck.glb");
buildGlb(motorcycleParts(), "motorcycle.glb");
buildGlb(bicycleParts(), "bicycle.glb");
buildGlb(motorcycleParts(), "electric-scooter.glb");
buildGlb(pickupParts(), "official.glb");
buildGlb(pickupParts(), "university-transport.glb");
buildGlb(sedanParts(), "visitor.glb");
buildGlb(sedanParts(), "other.glb");
