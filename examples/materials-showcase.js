const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = { r: 0.015, g: 0.02, b: 0.027, a: 1 };
const materialNames = ["unlit", "standard-pbr", "matcap"];
const shaderSource = `
struct SceneUniform {
  viewProjection: mat4x4f,
  lightDirection: vec4f,
  lightColor: vec4f,
  ambientColor: vec4f,
  cameraPosition: vec4f,
};

struct ObjectUniform {
  world: mat4x4f,
};

struct MaterialUniform {
  baseColorFactor: vec4f,
  params: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
};

const MATERIAL_UNLIT: u32 = 0u;
const MATERIAL_STANDARD: u32 = 1u;
const MATERIAL_MATCAP: u32 = 2u;
const PI: f32 = 3.141592653589793;

@group(0) @binding(0) var<uniform> scene: SceneUniform;
@group(1) @binding(0) var<uniform> object: ObjectUniform;
@group(2) @binding(0) var<uniform> material: MaterialUniform;
@group(2) @binding(1) var matcapTexture: texture_2d<f32>;
@group(2) @binding(2) var matcapSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = object.world * vec4f(input.position, 1.0);
  output.clipPosition = scene.viewProjection * worldPosition;
  output.worldPosition = worldPosition.xyz;
  output.worldNormal = normalize((object.world * vec4f(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  return output;
}

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn fresnelSchlick(cosTheta: f32, f0: vec3f) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - saturate(cosTheta), 5.0);
}

fn distributionGGX(normal: vec3f, halfVector: vec3f, roughness: f32) -> f32 {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;
  let nDotH = max(dot(normal, halfVector), 0.0);
  let denomTerm = nDotH * nDotH * (alpha2 - 1.0) + 1.0;
  return alpha2 / max(PI * denomTerm * denomTerm, 0.0001);
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
}

fn geometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {
  let nDotV = max(dot(normal, viewDir), 0.0);
  let nDotL = max(dot(normal, lightDir), 0.0);
  return geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
}

fn directPbr(
  normal: vec3f,
  viewDir: vec3f,
  lightDir: vec3f,
  radiance: vec3f,
  baseColor: vec3f,
  metallic: f32,
  roughness: f32,
) -> vec3f {
  let nDotL = max(dot(normal, lightDir), 0.0);

  if (nDotL <= 0.0) {
    return vec3f(0.0);
  }

  let halfVector = normalize(viewDir + lightDir);
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));
  let fresnel = fresnelSchlick(max(dot(halfVector, viewDir), 0.0), f0);
  let distribution = distributionGGX(normal, halfVector, roughness);
  let visibility = geometrySmith(normal, viewDir, lightDir, roughness);
  let specular = (distribution * visibility * fresnel) /
    max(4.0 * max(dot(normal, viewDir), 0.0) * nDotL, 0.0001);
  let diffuse = ((vec3f(1.0) - fresnel) * (1.0 - metallic) * baseColor) / PI;
  return (diffuse + specular) * radiance * nDotL;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let mode = u32(material.params.x + 0.5);
  let normal = normalize(input.worldNormal);
  let baseColor = material.baseColorFactor.rgb;

  if (mode == MATERIAL_UNLIT) {
    return vec4f(baseColor, material.baseColorFactor.a);
  }

  if (mode == MATERIAL_MATCAP) {
    let matcapUv = clamp(normal.xy * vec2f(0.48, -0.48) + vec2f(0.5), vec2f(0.0), vec2f(1.0));
    let matcap = textureSample(matcapTexture, matcapSampler, matcapUv).rgb;
    return vec4f(matcap * baseColor, material.baseColorFactor.a);
  }

  let viewDir = normalize(scene.cameraPosition.xyz - input.worldPosition);
  let lightDir = normalize(-scene.lightDirection.xyz);
  let metallic = clamp(material.params.y, 0.0, 1.0);
  let roughness = clamp(material.params.z, 0.045, 1.0);
  let direct = directPbr(
    normal,
    viewDir,
    lightDir,
    scene.lightColor.rgb,
    baseColor,
    metallic,
    roughness,
  );
  let ambient = scene.ambientColor.rgb * baseColor * (1.0 - metallic);
  return vec4f(ambient + direct, material.baseColorFactor.a);
}
`;

try {
  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const runtime = await createMaterialShowcase(canvas);

    startAnimation(runtime);
  }
} catch (error) {
  publishStatus(
    failure(
      "showcase-failed",
      error instanceof Error ? error.message : "Material showcase failed.",
    ),
  );
}

async function createMaterialShowcase(targetCanvas) {
  if (navigator.gpu === undefined) {
    throw new Error("WebGPU is not available in this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();

  if (adapter === null) {
    throw new Error("No WebGPU adapter was available.");
  }

  const device = await adapter.requestDevice();
  const context = targetCanvas.getContext("webgpu");

  if (context === null) {
    throw new Error("The canvas could not create a WebGPU context.");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  const geometry = createCubeGeometry();
  const vertexBuffer = createBufferWithData(
    device,
    "materials-showcase/cube-vertices",
    geometry.vertices,
    GPUBufferUsage.VERTEX,
  );
  const indexBuffer = createBufferWithData(
    device,
    "materials-showcase/cube-indices",
    geometry.indices,
    GPUBufferUsage.INDEX,
  );
  const sceneBuffer = createUniformBuffer(device, "materials-showcase/scene");
  const shader = device.createShaderModule({
    label: "materials-showcase/shader",
    code: shaderSource,
  });
  const pipeline = device.createRenderPipeline({
    label: "materials-showcase/pipeline",
    layout: "auto",
    vertex: {
      module: shader,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 32,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            { shaderLocation: 2, offset: 24, format: "float32x2" },
          ],
        },
      ],
    },
    fragment: {
      module: shader,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
      frontFace: "ccw",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
  const matcap = createMatcapTexture(device);
  const sceneBindGroup = device.createBindGroup({
    label: "materials-showcase/scene-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: sceneBuffer } }],
  });
  const cubes = createCubes(device, pipeline, matcap);

  return {
    canvas: targetCanvas,
    context,
    device,
    format,
    pipeline,
    vertexBuffer,
    indexBuffer,
    indexCount: geometry.indices.length,
    sceneBuffer,
    sceneBindGroup,
    cubes,
    depth: null,
    frame: 0,
    startTime: 0,
  };
}

function createCubes(device, pipeline, matcap) {
  return [
    createCubeRuntime(device, pipeline, matcap, {
      name: "unlit",
      mode: 0,
      baseColor: [1, 0.42, 0.18, 1],
      metallic: 0,
      roughness: 1,
      translation: [-2.35, 0, 0],
      spin: [0.65, 1.2],
    }),
    createCubeRuntime(device, pipeline, matcap, {
      name: "standard-pbr",
      mode: 1,
      baseColor: [0.7, 0.84, 1, 1],
      metallic: 0.48,
      roughness: 0.22,
      translation: [0, 0, 0],
      spin: [0.85, 1],
    }),
    createCubeRuntime(device, pipeline, matcap, {
      name: "matcap",
      mode: 2,
      baseColor: [0.88, 0.96, 1, 1],
      metallic: 0,
      roughness: 0,
      translation: [2.35, 0, 0],
      spin: [0.75, 1.35],
    }),
  ];
}

function createCubeRuntime(device, pipeline, matcap, config) {
  const objectBuffer = createUniformBuffer(
    device,
    `materials-showcase/${config.name}/object`,
  );
  const materialBuffer = createUniformBuffer(
    device,
    `materials-showcase/${config.name}/material`,
  );

  device.queue.writeBuffer(
    materialBuffer,
    0,
    new Float32Array([
      ...config.baseColor,
      config.mode,
      config.metallic,
      config.roughness,
      0,
    ]),
  );

  return {
    ...config,
    objectBuffer,
    objectBindGroup: device.createBindGroup({
      label: `materials-showcase/${config.name}/object-bind-group`,
      layout: pipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: objectBuffer } }],
    }),
    materialBindGroup: device.createBindGroup({
      label: `materials-showcase/${config.name}/material-bind-group`,
      layout: pipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: materialBuffer } },
        { binding: 1, resource: matcap.texture.createView() },
        { binding: 2, resource: matcap.sampler },
      ],
    }),
  };
}

function startAnimation(runtime) {
  const render = (timestamp) => {
    if (runtime.startTime === 0) {
      runtime.startTime = timestamp;
    }

    runtime.frame += 1;
    renderFrame(runtime, (timestamp - runtime.startTime) / 1000);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

function renderFrame(runtime, elapsedSeconds) {
  resizeCanvas(runtime);
  updateScene(runtime);

  for (const cube of runtime.cubes) {
    const world = cubeWorldMatrix(cube, elapsedSeconds);
    runtime.device.queue.writeBuffer(cube.objectBuffer, 0, world);
  }

  const encoder = runtime.device.createCommandEncoder({
    label: "materials-showcase/frame",
  });
  const pass = encoder.beginRenderPass({
    label: "materials-showcase/pass",
    colorAttachments: [
      {
        view: runtime.context.getCurrentTexture().createView(),
        clearValue: clearColor,
        loadOp: "clear",
        storeOp: "store",
      },
    ],
    depthStencilAttachment: {
      view: runtime.depth.view,
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });

  pass.setPipeline(runtime.pipeline);
  pass.setBindGroup(0, runtime.sceneBindGroup);
  pass.setVertexBuffer(0, runtime.vertexBuffer);
  pass.setIndexBuffer(runtime.indexBuffer, "uint16");

  for (const cube of runtime.cubes) {
    pass.setBindGroup(1, cube.objectBindGroup);
    pass.setBindGroup(2, cube.materialBindGroup);
    pass.drawIndexed(runtime.indexCount, 1, 0, 0, 0);
  }

  pass.end();
  runtime.device.queue.submit([encoder.finish()]);

  publishStatus({
    example: "materials-showcase",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    materialModels: materialNames,
    frame: runtime.frame,
    animation: {
      elapsedSeconds,
      spinningCubes: runtime.cubes.length,
    },
    draw: {
      cubes: runtime.cubes.length,
      indexedDrawCalls: runtime.cubes.length,
      indexCount: runtime.indexCount,
    },
    canvas: {
      width: runtime.canvas.width,
      height: runtime.canvas.height,
    },
  });
}

function updateScene(runtime) {
  const aspect = runtime.canvas.width / runtime.canvas.height;
  const projection = perspective((55 * Math.PI) / 180, aspect, 0.1, 100);
  const cameraPosition = [0, 1.45, 6.8];
  const view = lookAt(cameraPosition, [0, 0.05, 0], [0, 1, 0]);
  const viewProjection = multiply(projection, view);
  const sceneData = new Float32Array(32);

  sceneData.set(viewProjection, 0);
  sceneData.set(normalize([0.45, -0.8, -0.35]), 16);
  sceneData[19] = 0;
  sceneData.set([5.2, 4.8, 4.1, 1], 20);
  sceneData.set([0.24, 0.28, 0.34, 1], 24);
  sceneData.set([...cameraPosition, 1], 28);
  runtime.device.queue.writeBuffer(runtime.sceneBuffer, 0, sceneData);
}

function resizeCanvas(runtime) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(
    1,
    Math.floor(runtime.canvas.clientWidth * pixelRatio),
  );
  const height = Math.max(
    1,
    Math.floor(runtime.canvas.clientHeight * pixelRatio),
  );

  if (
    runtime.depth !== null &&
    runtime.canvas.width === width &&
    runtime.canvas.height === height
  ) {
    return;
  }

  runtime.canvas.width = width;
  runtime.canvas.height = height;
  runtime.context.configure({
    device: runtime.device,
    format: runtime.format,
    alphaMode: "opaque",
  });

  runtime.depth?.texture.destroy();
  runtime.depth = createDepthTexture(runtime.device, width, height);
}

function createDepthTexture(device, width, height) {
  const texture = device.createTexture({
    label: "materials-showcase/depth",
    size: [width, height, 1],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  return {
    texture,
    view: texture.createView(),
  };
}

function createMatcapTexture(device) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const radius = Math.hypot(nx, ny);
      const z = Math.sqrt(Math.max(0, 1 - radius * radius));
      const rim = Math.pow(Math.max(0, radius), 1.7);
      const highlight = Math.pow(
        Math.max(0, 0.6 * -nx + 0.62 * -ny + 0.5 * z),
        18,
      );
      const stripe = Math.pow(Math.max(0, nx * -0.45 + ny * 0.25 + z), 5);
      const base = mixColor([28, 52, 96], [88, 196, 220], z);
      const warm = mixColor(base, [255, 192, 118], stripe * 0.45);
      const finalColor = mixColor(
        mixColor(warm, [70, 34, 140], rim * 0.55),
        [255, 246, 212],
        highlight,
      );
      const offset = (y * size + x) * 4;

      data[offset] = radius > 1 ? 8 : finalColor[0];
      data[offset + 1] = radius > 1 ? 10 : finalColor[1];
      data[offset + 2] = radius > 1 ? 14 : finalColor[2];
      data[offset + 3] = 255;
    }
  }

  const texture = device.createTexture({
    label: "materials-showcase/matcap-texture",
    size: [size, size, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: size * 4, rowsPerImage: size },
    [size, size, 1],
  );

  return {
    texture,
    sampler: device.createSampler({
      label: "materials-showcase/matcap-sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    }),
  };
}

function createBufferWithData(device, label, data, usage) {
  const buffer = device.createBuffer({
    label,
    size: alignTo(data.byteLength, 4),
    usage: usage | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  const mapped = buffer.getMappedRange();

  if (data instanceof Float32Array) {
    new Float32Array(mapped).set(data);
  } else {
    new Uint16Array(mapped).set(data);
  }

  buffer.unmap();
  return buffer;
}

function createUniformBuffer(device, label) {
  return device.createBuffer({
    label,
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createCubeGeometry() {
  const vertices = [];
  const indices = [];

  addFace(
    vertices,
    indices,
    [0, 0, 1],
    [
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
  );
  addFace(
    vertices,
    indices,
    [0, 0, -1],
    [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
    ],
  );
  addFace(
    vertices,
    indices,
    [1, 0, 0],
    [
      [1, -1, 1],
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
    ],
  );
  addFace(
    vertices,
    indices,
    [-1, 0, 0],
    [
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
    ],
  );
  addFace(
    vertices,
    indices,
    [0, 1, 0],
    [
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
  );
  addFace(
    vertices,
    indices,
    [0, -1, 0],
    [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
  );

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

function addFace(vertices, indices, normal, corners) {
  const start = vertices.length / 8;
  const uvs = [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0],
  ];

  for (let i = 0; i < corners.length; i += 1) {
    const corner = corners[i];
    const uv = uvs[i];

    vertices.push(
      corner[0],
      corner[1],
      corner[2],
      normal[0],
      normal[1],
      normal[2],
      uv[0],
      uv[1],
    );
  }

  indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function cubeWorldMatrix(cube, elapsedSeconds) {
  const scale = scaling(0.78, 0.78, 0.78);
  const rotateY = rotationY(elapsedSeconds * cube.spin[1]);
  const rotateX = rotationX(elapsedSeconds * cube.spin[0] + 0.35);
  const translate = translation(
    cube.translation[0],
    cube.translation[1],
    cube.translation[2],
  );

  return multiply(translate, multiply(rotateY, multiply(rotateX, scale)));
}

function perspective(fovyRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovyRadians / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    far * nf,
    -1,
    0,
    0,
    far * near * nf,
    0,
  ]);
}

function lookAt(eye, target, up) {
  const z = normalize(subtract(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);

  return new Float32Array([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, eye),
    -dot(y, eye),
    -dot(z, eye),
    1,
  ]);
}

function multiply(a, b) {
  const out = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }

  return out;
}

function translation(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function scaling(x, y, z) {
  return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
}

function rotationX(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);

  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function rotationY(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);

  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function normalize(vector) {
  const length = Math.hypot(...vector);

  if (length === 0) {
    return [0, 0, 0];
  }

  return vector.map((value) => value / length);
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function mixColor(a, b, amount) {
  const t = Math.max(0, Math.min(1, amount));

  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ];
}

function alignTo(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    example: "materials-showcase",
    ok: false,
    phase: "initialize",
    reason,
    message,
  };
}
