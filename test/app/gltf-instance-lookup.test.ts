import { describe, expect, it } from "vitest";
import {
  AppEntitySource,
  createApertureSystemContext,
  type GltfNodeRecord,
} from "@aperture-engine/app/systems";
import {
  AssetRegistry,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createLocalTransform,
  createParent,
  createWorld,
  resolveWorldTransforms,
  setParent,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

describe("GLTF instance node lookup", () => {
  it("finds exactly one named node in a spawned root subtree", () => {
    const fixture = createVehicleFixture();

    const result = fixture.context.gltf.node(fixture.root, "body");

    expect(result.ok).toBe(true);
    expect(result.entity).toBe(fixture.body);
    expect(result.node).toMatchObject({
      name: "body",
      assetId: "vehicle",
      nodeIndex: 1,
      nodePath: "nodes[1]",
    });
  });

  it("reports missing and duplicate node names", () => {
    const fixture = createVehicleFixture();

    const missing = fixture.context.gltf.node(fixture.root, "spoiler");
    expect(missing.ok).toBe(false);
    expect(missing.diagnostic?.code).toBe("aperture.gltf.nodeMissing");

    const duplicate = fixture.context.gltf.node(fixture.root, "wheel-front");
    expect(duplicate.ok).toBe(false);
    expect(duplicate.diagnostic?.code).toBe("aperture.gltf.nodeDuplicate");
    expect(duplicate.matches).toHaveLength(3);
  });

  it("filters nodes by name fragment and asset id inside one root subtree", () => {
    const fixture = createVehicleFixture();

    const wheels = fixture.context.gltf.nodes(fixture.root, {
      nameIncludes: "wheel",
      assetId: "vehicle",
    });
    const names = wheels.map((node) => node.name);

    expect(wheels).toHaveLength(4);
    expect(names).toEqual(
      expect.arrayContaining([
        "wheel-front",
        "wheel-front",
        "wheel-back-left",
        "wheel-back-right",
      ]),
    );
    expect(
      fixture.context.gltf.nodes(fixture.root, { assetId: "npc" }),
    ).toHaveLength(1);
  });

  it("walks raw Parent links when GLTF replay has no Children index", () => {
    const fixture = createVehicleFixture({ useSetParent: false });

    expect(
      fixture.context.gltf.node(fixture.root, "wheel-back-left", {
        assetId: "vehicle",
      }).entity,
    ).not.toBeNull();
    expect(
      fixture.context.gltf.nodes(fixture.root, {
        nameIncludes: "wheel",
        assetId: "vehicle",
      }),
    ).toHaveLength(4);
  });

  it("does not walk outside the requested root subtree", () => {
    const fixture = createVehicleFixture();

    expect(fixture.context.gltf.node(fixture.otherRoot, "body").entity).toBe(
      fixture.otherBody,
    );
    expect(fixture.context.gltf.nodes(fixture.otherRoot)).toHaveLength(2);
  });
});

interface VehicleFixture {
  readonly context: ReturnType<typeof createApertureSystemContext>;
  readonly root: Entity;
  readonly body: Entity;
  readonly otherRoot: Entity;
  readonly otherBody: Entity;
}

function createVehicleFixture(
  options: { readonly useSetParent?: boolean } = {},
): VehicleFixture {
  const world = createWorld({ entityCapacity: 16 });
  const context = createApertureSystemContext({
    world,
    assetsRegistry: new AssetRegistry(),
  });

  const root = makeGltfNode(world, {
    name: "vehicle-root",
    assetId: "vehicle",
    nodeIndex: 0,
    nodePath: "scene[0]",
  });
  const body = makeGltfNode(world, {
    name: "body",
    assetId: "vehicle",
    nodeIndex: 1,
    nodePath: "nodes[1]",
  });
  const frontLeft = makeGltfNode(world, {
    name: "wheel-front",
    assetId: "vehicle",
    nodeIndex: 2,
    nodePath: "nodes[2]",
  });
  const frontRight = makeGltfNode(world, {
    name: "wheel-front",
    assetId: "vehicle",
    nodeIndex: 3,
    nodePath: "nodes[3]",
  });
  const backLeft = makeGltfNode(world, {
    name: "wheel-back-left",
    assetId: "vehicle",
    nodeIndex: 4,
    nodePath: "nodes[4]",
  });
  const backRight = makeGltfNode(world, {
    name: "wheel-back-right",
    assetId: "vehicle",
    nodeIndex: 5,
    nodePath: "nodes[5]",
  });
  const bodyPrimitive = makeGltfNode(world, {
    name: "body.Primitive0",
    assetId: "vehicle",
    nodeIndex: 1,
    nodePath: "nodes[1].mesh[0].primitives[0]",
  });
  const frontLeftPrimitive = makeGltfNode(world, {
    name: "wheel-front.Primitive0",
    assetId: "vehicle",
    nodeIndex: 2,
    nodePath: "nodes[2].mesh[0].primitives[0]",
  });
  const frontRightPrimitive = makeGltfNode(world, {
    name: "wheel-front.Primitive0",
    assetId: "vehicle",
    nodeIndex: 3,
    nodePath: "nodes[3].mesh[0].primitives[0]",
  });
  const backLeftPrimitive = makeGltfNode(world, {
    name: "wheel-back-left.Primitive0",
    assetId: "vehicle",
    nodeIndex: 4,
    nodePath: "nodes[4].mesh[0].primitives[0]",
  });
  const backRightPrimitive = makeGltfNode(world, {
    name: "wheel-back-right.Primitive0",
    assetId: "vehicle",
    nodeIndex: 5,
    nodePath: "nodes[5].mesh[0].primitives[0]",
  });
  const npcWheel = makeGltfNode(world, {
    name: "wheel-front",
    assetId: "npc",
    nodeIndex: 6,
    nodePath: "nodes[6]",
  });
  const otherRoot = makeGltfNode(world, {
    name: "other-root",
    assetId: "other",
    nodeIndex: 0,
    nodePath: "scene[1]",
  });
  const otherBody = makeGltfNode(world, {
    name: "body",
    assetId: "other",
    nodeIndex: 1,
    nodePath: "nodes[1]",
  });

  const useSetParent = options.useSetParent ?? true;
  resolveWorldTransforms(world);
  for (const child of [
    body,
    frontLeft,
    frontRight,
    backLeft,
    backRight,
    npcWheel,
  ]) {
    parentChild(world, child, root, useSetParent);
  }
  parentChild(world, bodyPrimitive, body, useSetParent);
  parentChild(world, frontLeftPrimitive, frontLeft, useSetParent);
  parentChild(world, frontRightPrimitive, frontRight, useSetParent);
  parentChild(world, backLeftPrimitive, backLeft, useSetParent);
  parentChild(world, backRightPrimitive, backRight, useSetParent);
  parentChild(world, otherBody, otherRoot, useSetParent);
  resolveWorldTransforms(world);

  return { context, root, body, otherRoot, otherBody };
}

function parentChild(
  world: EcsWorld,
  child: Entity,
  parent: Entity,
  useSetParent: boolean,
): void {
  if (useSetParent) {
    setParent(world, child, parent);
    return;
  }

  child.setValue(Parent, "entity", parent);
}

function makeGltfNode(
  world: EcsWorld,
  record: Omit<GltfNodeRecord, "entity">,
): Entity {
  const entity = world.createEntity();
  entity.addComponent(Name, { value: record.name });
  entity.addComponent(AppEntitySource, {
    kind: "gltf",
    assetId: record.assetId,
    gltfNodeIndex: record.nodeIndex,
    gltfNodePath: record.nodePath,
  });
  entity.addComponent(LocalTransform, createLocalTransform());
  entity.addComponent(Parent, createParent(null));
  entity.addComponent(WorldTransform);
  return entity;
}
