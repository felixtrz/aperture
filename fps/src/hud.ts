import {
  dispatchApertureInputAction,
  type GeneratedSignalSummary,
  subscribeGeneratedSignals,
} from "@aperture-engine/app/browser";

const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
const healthEl = document.querySelector<HTMLElement>("#health");
const weaponEl = document.querySelector<HTMLElement>("#weapon");
const enemiesEl = document.querySelector<HTMLElement>("#enemies");
const crosshairEl = document.querySelector<HTMLImageElement>("#crosshair");

const MOUSE_LOOK_PIXELS_PER_UNIT = 26;
const DAMAGE_FLASH_MS = 180;
const HIT_FLASH_MS = 130;
const DESTROY_FLASH_MS = 240;
let pendingLookX = 0;
let pendingLookY = 0;
let lookActionActive = false;
let lastDamagePulse = 0;
let lastHits = 0;
let lastEnemyDestroyedPulse = 0;
let damageFlashTimer: number | undefined;
let hitFlashTimer: number | undefined;
let enemyDestroyedFlashTimer: number | undefined;

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function writeText(el: HTMLElement | null, value: string): void {
  if (el !== null && el.textContent !== value) el.textContent = value;
}

function render(signals: GeneratedSignalSummary | null): void {
  const health = Math.max(0, Math.round(readNumber(signals?.health, 100)));
  const weaponName = readString(signals?.weaponName, "Blaster");
  const enemies = Math.max(0, readNumber(signals?.enemiesRemaining, 4));
  const gameStatus = readString(signals?.gameStatus, "active");
  const crosshair = readString(signals?.crosshair, "/sprites/crosshair.png");
  const hits = Math.max(0, Math.round(readNumber(signals?.hits, 0)));
  const damagePulse = Math.max(
    0,
    Math.round(readNumber(signals?.damagePulse, 0)),
  );
  const enemyDestroyedPulse = Math.max(
    0,
    Math.round(readNumber(signals?.enemyDestroyedPulse, 0)),
  );

  writeText(healthEl, `${health}%`);
  writeText(weaponEl, weaponName);
  writeText(enemiesEl, gameStatus === "cleared" ? "CLEAR" : String(enemies));

  if (crosshairEl !== null && crosshairEl.getAttribute("src") !== crosshair) {
    crosshairEl.setAttribute("src", crosshair);
  }

  document.body.dataset.grounded =
    signals?.grounded === false ? "false" : "true";
  document.body.dataset.lowHealth = health <= 30 ? "true" : "false";
  document.body.dataset.gameStatus =
    gameStatus === "cleared" ? "cleared" : "active";

  if (hits !== lastHits) {
    if (hits > lastHits) triggerHitFlash();
    lastHits = hits;
  }

  if (damagePulse !== lastDamagePulse) {
    lastDamagePulse = damagePulse;
    if (damagePulse > 0) triggerDamageFlash();
  }

  if (enemyDestroyedPulse !== lastEnemyDestroyedPulse) {
    if (enemyDestroyedPulse > lastEnemyDestroyedPulse) {
      triggerEnemyDestroyedFlash();
    }
    lastEnemyDestroyedPulse = enemyDestroyedPulse;
  }
}

render(null);
subscribeGeneratedSignals(render);

canvas?.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    void canvas.requestPointerLock();
  }
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  pendingLookX += event.movementX;
  pendingLookY += event.movementY;
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) {
    pendingLookX = 0;
    pendingLookY = 0;
    dispatchApertureInputAction("look", { x: 0, y: 0, source: "pointer-lock" });
    lookActionActive = false;
  }
});

function dispatchPendingLook(): void {
  if (pendingLookX !== 0 || pendingLookY !== 0) {
    dispatchApertureInputAction("look", {
      x: clampAxis(pendingLookX / MOUSE_LOOK_PIXELS_PER_UNIT),
      y: clampAxis(-pendingLookY / MOUSE_LOOK_PIXELS_PER_UNIT),
      source: "pointer-lock",
    });
    pendingLookX = 0;
    pendingLookY = 0;
    lookActionActive = true;
  } else if (lookActionActive) {
    dispatchApertureInputAction("look", {
      x: 0,
      y: 0,
      source: "pointer-lock",
    });
    lookActionActive = false;
  }

  requestAnimationFrame(dispatchPendingLook);
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

requestAnimationFrame(dispatchPendingLook);

function triggerDamageFlash(): void {
  document.body.dataset.damageFlash = "true";
  if (damageFlashTimer !== undefined) window.clearTimeout(damageFlashTimer);
  damageFlashTimer = window.setTimeout(() => {
    document.body.dataset.damageFlash = "false";
    damageFlashTimer = undefined;
  }, DAMAGE_FLASH_MS);
}

function triggerHitFlash(): void {
  document.body.dataset.hitFlash = "true";
  if (hitFlashTimer !== undefined) window.clearTimeout(hitFlashTimer);
  hitFlashTimer = window.setTimeout(() => {
    document.body.dataset.hitFlash = "false";
    hitFlashTimer = undefined;
  }, HIT_FLASH_MS);
}

function triggerEnemyDestroyedFlash(): void {
  document.body.dataset.enemyDestroyedFlash = "true";
  if (enemyDestroyedFlashTimer !== undefined) {
    window.clearTimeout(enemyDestroyedFlashTimer);
  }
  enemyDestroyedFlashTimer = window.setTimeout(() => {
    document.body.dataset.enemyDestroyedFlash = "false";
    enemyDestroyedFlashTimer = undefined;
  }, DESTROY_FLASH_MS);
}
