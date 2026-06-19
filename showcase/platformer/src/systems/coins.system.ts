import {
  AppEntityKey,
  AudioSimulationSpace,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import {
  COINS,
  COIN_BOB_RATE,
  COIN_BOB_VELOCITY,
  COIN_COLLECT_RADIUS,
  COIN_SPIN_RATE,
} from "../lib/platformer-data.js";
import { hoverOffset } from "../lib/platformer-controls.js";
import { PlatformerResource } from "../lib/platformer-resource.js";

const HIDDEN: Vec3 = [0, -1000, 0];
const PLAYER_CENTER_OFFSET = 0.5;

export default class CoinsSystem extends createSystem({
  priority: 25,
  queries: { keyed: { required: [AppEntityKey] } },
}) {
  #time = 0;
  #voice = 0;

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#time += dt;
    const state = this.resources.read(PlatformerResource);

    const grabbed = { ...state.coinGrabbed };
    const player: Vec3 = [
      state.bodyPosition[0],
      state.bodyPosition[1] + PLAYER_CENTER_OFFSET,
      state.bodyPosition[2],
    ];
    let collected = 0;
    const bob = hoverOffset(this.#time, COIN_BOB_RATE, COIN_BOB_VELOCITY);
    const spin = quatFromEulerYXZ(0, this.#time * COIN_SPIN_RATE, 0);

    for (const coin of COINS) {
      const entity = this.#findByKey(coin.key);
      if (entity === null) continue;

      if (grabbed[coin.key] === true) {
        entity.getVectorView(LocalTransform, "translation").set(HIDDEN);
        continue;
      }

      entity
        .getVectorView(LocalTransform, "translation")
        .set([coin.position[0], coin.position[1] + bob, coin.position[2]]);
      entity.getVectorView(LocalTransform, "rotation").set(spin);

      const dx = player[0] - coin.position[0];
      const dy = player[1] - coin.position[1];
      const dz = player[2] - coin.position[2];
      if (Math.hypot(dx, dy, dz) < COIN_COLLECT_RADIUS) {
        grabbed[coin.key] = true;
        collected += 1;
        this.#playCoin();
      }
    }

    if (collected > 0) {
      const total = state.coins + collected;
      this.resources.write(PlatformerResource, (next) => {
        next.coins = total;
        next.coinGrabbed = grabbed;
      });
      const coinsSignal = this.signals.coins;
      if (coinsSignal !== undefined) coinsSignal.value = total;
    } else if (state.coins === 0) {
      // keep the HUD in sync after a reset cleared the count
      const coinsSignal = this.signals.coins;
      if (coinsSignal !== undefined && coinsSignal.value !== 0) {
        coinsSignal.value = 0;
      }
    }
  }

  #playCoin(): void {
    this.audio.playOneShot(`platformer.coin.${this.#voice % 8}`, {
      clip: this.audio.clip("coin-pickup"),
      busId: "sfx",
      gain: 0.6,
      timeScale: 0.9 + Math.random() * 0.2,
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.#voice += 1;
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) return entity;
    }
    return null;
  }
}
