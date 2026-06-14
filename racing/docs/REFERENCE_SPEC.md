# Reference Racing App — Parity Spec (from references/Starter-Kit-Racing)

Implementation checklist for the Aperture port. All numbers quoted from the reference.

## 1. Renderer & scene
- THREE.WebGLRenderer, antialias true, HalfFloatType, pixelRatio = devicePixelRatio.
- Tone mapping: ACESFilmic, exposure 1.0. Shadow map enabled (default type).
- Background 0xadb2ba. Fog: linear, color 0xadb2ba, near = groundSize*0.4, far = groundSize*0.8.
- Post: UnrealBloomPass strength 0.02, radius 0.02, threshold 0.5.

## 2. Materials (HIGH PRIORITY — road too glossy in port)
- glTF materials used AS-IS (NOT replaced). `side = FrontSide` after load.
- Track/cars/decorations: glTF MeshStandardMaterial, no metalness/roughness override in code.
- Road stays matte because: metallic 0, roughness high (glTF default 1.0), **NO envMap**.
  LightProbeGrid gives subtle indirect light, not mirror reflections.
- GLB `colormap` material (verified): metallicFactor 0, roughnessFactor ABSENT → glTF default 1.0.
- castShadow + receiveShadow = true on track, cars, decorations.

## 3. Lighting
- DirectionalLight: color 0xffffff, intensity 3.0, pos (11.4,15,-5.3) (follows car: x+11.4,15,z-5.3),
  shadow mapSize 4096, near 0.5, far 60, radius 4, ortho bounds = max(halfW,halfD)+10 per track.
- HemisphereLight: sky 0xc8d8e8, ground 0x7a8a5a, intensity 2.0, pos copies dir light.
- LightProbeGrid: cubemap 32px, probeHeight 6, gridY probeHeight/2, subdiv max(4,round(hw/4))×2×max(4,round(hd/4)).

## 4. Decorations (grid CELL_RAW 9.99, GRID_SCALE 0.75, cell center (g+0.5)*CELL_RAW*GRID_SCALE)
- THREE.InstancedMesh per type (forest/empty/tents), material from glTF, cast+receive shadow.
- Types/counts: forest ~95 cells (perimeter + ring), empty ~20 (track-adjacent), tents ~6 explicit + ~15% procedural.
- Placement: explicit DECO_CELLS first; then procedural via deterministic hash:
  hash(gx,gz) = ((gx*374761393 + gz*668265263) ^ (>>13)) * 1274126177;
  dist = max(distX,distZ) to track bounds; dist<=1 → 15% (hash%7==0) tents else empty; dist>1 → forest.
- Per-instance rotation index 0..3 → *(π/2). Position Y 0.5. decoGroup scaled 0.75.

## 5. Lap timer
- Finish line at first track-finish cell (else spawn). Basis: forward = spawn angle, right ⟂.
- Crossing: fwd = dot(pos-center, fwd), lat = |dot(pos-center, right)|.
  Lap when lat ≤ cellSize*0.5 AND |fwd-prevFwd|<5 (no teleport) AND prevFwd<0 && fwd>=0 AND all non-finish cells visited.
- Cell visited: gx=floor(pos.x/cellSize), gz=floor(pos.z/cellSize).
- formatTime(t): m=floor(t/60); s=t-m*60; `${m}:${s.toFixed(2).padStart(5,'0')}` → 1:23.45.
- Best lap in localStorage key `racing.bestLap.${trackId||'default'}`; green #5af168 / red #ff6e6e flash 1200ms ease-out.

## 6. Particles (smoke)
- Pool 1280, emit 3/wheel/frame from wheelBL+wheelBR when driftIntensity>0.7. MAX_LIFE 2.5s.
- Pos = back wheel world, y = container.y+0.05; jitter XZ ±0.075, Y +0..0.15.
- Vel: XZ ±0.1*rand, Y 0.5+0.5*rand; damped vel*=(1-dt).
- size0 = 1.0*(0.5+0.5*rand); size(t)=size0*(0.5+tn*2.5), tn=1-(life/MAX). opacity(t)=(1-tn)*0.25.
- PointsMaterial: texture sprites/smoke.png, color 0x5E5F6B, sizeAttenuation true, transparent, depthWrite false.

## 7. Drift marks
- Max 4096 segments, 6 verts/seg, width 0.08, groundY +0.05, minSegLen 0.02.
- MeshBasicMaterial: color 0x111111, transparent, opacity 0.5, vertexColors, depthWrite false, DoubleSide,
  polygonOffset true factor/units -4.
- Emit when driftIntensity>0.5 AND |linearSpeed|>0.15; per rear wheel.
- alpha = clamp((intensity-0.5)/(2.0-0.5),0,1). Persist localStorage `racing.driftMarks.${trackId||'default'}` (quant 1000).

## 8. Audio
- engine.ogg (layered loops), skid.ogg (loop), impact.ogg (pool 3). Listener on camera. Muted until first input gesture.
- Engine: 3 gears, upshift rpm 0.92, downshift 0.35, shift cooldown 0.35s.
  pitchLow [1.05,1.25,1.4], pitchHigh [3.5,2.9,2.3]. pitch=lerp(low,high,rpm).
  gearWindow=1/3; inGear=clamp((absSpeed-gearStart)/gearWindow,0,1); targetRPM=clamp(inGear*0.85+throttle*0.2,0,1.05).
  rate = targetRPM>rpm ? 4*(0.3+throttle) : 4; rpm=lerp(rpm,targetRPM,min(1,dt*rate)).
  vol: targetVol=remap(absSpeed+throttle*0.5,0,1.5,0.02,0.25); layer vol *0.4. lerp dt*5.
  lowpass biquad Q 0.7, cutoff=remap(throttle,0,1,700,7000), setTargetAtTime(...,0.05).
- Skid: when driftIntensity>0.5; vol=remap(clamp(drift,0.5,2.5),0.5,2.5,0.05,0.3); pitch=clamp(absSpeed,1,3).
- Impact: vol=clamp(remap(impactVel,0,6,0.01,1.0),0.01,1.0).

## 9. Vehicle & camera (mostly ported)
- SPEED_SCALE 12.5, LINEAR_DAMP 0.1, MAX_SPEED 1.5; steering grip clamp(absSpeed,0.2,1.0), steer rate 4 rad/s;
  accel lerp 1.5, brake lerp 8 (fwd) / 2 (rev). driftIntensity = abs(linearSpeed-accel) + |body.rot.z|*2.
- Camera: fov 40, near 0.1, far 60, offset (9.27,9.18,9.27), lead 3.0, smoothing 2.0, deadzone 5.0, screenShiftUp 1.0.
- Dir light + hemi light FOLLOW the car (position offset tracks vehicle).

## 10. Track grid
- CELL_RAW 9.99, GRID_SCALE 0.75, cell size 7.4925. Track group scale 0.75, y -0.5.
- 16 track cells, 6 explicit tents, ~95 forest, ~20 empty, 3 NPC trucks.
