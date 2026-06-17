import { nestedRecord, numberArg, stringArg } from "./args.js";
import {
  readGeneratedStatus,
  type AperturePage,
  type AperturePointerButton,
} from "./browser.js";

export async function inputKey(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const key = stringArg(args, "key") ?? "Enter";
  const action = stringArg(args, "action") ?? "press";

  if (action === "down") {
    await page.keyboard.down(key);
  } else if (action === "up") {
    await page.keyboard.up(key);
  } else {
    await page.keyboard.press(key);
  }

  return { ok: true, page: await readGeneratedStatus(page) };
}

export async function inputPointerMove(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const point = await canvasPoint(page, args);

  await page.mouse.move(point.x, point.y);
  return { ok: true, point, page: await readGeneratedStatus(page) };
}

export async function inputPointerClick(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const point = await canvasPoint(page, args);
  const button = pointerButtonFromArgs(args);
  const pointerLockDispatch = await dispatchPointerLockedCanvasClick(
    page,
    point,
    button,
  );

  if (!pointerLockDispatch.dispatched) {
    await page.mouse.click(point.x, point.y, { button });
  }

  return {
    ok: true,
    point,
    button,
    pointerLockDispatch,
    page: await readGeneratedStatus(page),
  };
}

export async function inputDrag(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const from = await canvasPoint(page, nestedRecord(args, "from") ?? args);
  const to = await canvasPoint(page, nestedRecord(args, "to") ?? args);
  const button = pointerButtonFromArgs(args);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y);
  await page.mouse.up({ button });

  return { ok: true, from, to, button, page: await readGeneratedStatus(page) };
}

export function pointerButtonFromArgs(
  args: Record<string, unknown>,
): AperturePointerButton {
  const value = stringArg(args, "button")?.toLowerCase();
  switch (value) {
    case "left":
    case "primary":
      return "left";
    case "middle":
    case "aux":
    case "auxiliary":
      return "middle";
    case "right":
    case "secondary":
      return "right";
    default:
      return "left";
  }
}

export function domButtonFromPointerButton(
  button: AperturePointerButton,
): 0 | 1 | 2 {
  switch (button) {
    case "middle":
      return 1;
    case "right":
      return 2;
    case "left":
      return 0;
  }
}

export function mouseButtonsMaskFromDomButton(button: 0 | 1 | 2): 1 | 2 | 4 {
  switch (button) {
    case 1:
      return 4;
    case 2:
      return 2;
    case 0:
      return 1;
  }
}

async function dispatchPointerLockedCanvasClick(
  page: AperturePage,
  point: { readonly x: number; readonly y: number },
  button: AperturePointerButton,
): Promise<{ readonly dispatched: boolean; readonly reason?: string }> {
  const domButton = domButtonFromPointerButton(button);
  const buttons = mouseButtonsMaskFromDomButton(domButton);

  return page.evaluate(
    ({ x, y, button, buttons }) => {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        return { dispatched: false, reason: "missing-canvas" };
      }

      if (document.pointerLockElement !== canvas) {
        return { dispatched: false, reason: "not-pointer-locked" };
      }

      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        button,
        buttons,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
      };
      const pointerInit = {
        ...eventInit,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      };
      const PointerEventCtor = globalThis.PointerEvent;

      if (PointerEventCtor !== undefined) {
        canvas.dispatchEvent(new PointerEventCtor("pointerdown", pointerInit));
      }
      canvas.dispatchEvent(new MouseEvent("mousedown", eventInit));

      const releaseEventInit = { ...eventInit, buttons: 0 };
      const releasePointerInit = { ...pointerInit, buttons: 0 };
      if (PointerEventCtor !== undefined) {
        canvas.dispatchEvent(
          new PointerEventCtor("pointerup", releasePointerInit),
        );
      }
      canvas.dispatchEvent(new MouseEvent("mouseup", releaseEventInit));

      const clickType = button === 1 ? "auxclick" : "click";
      canvas.dispatchEvent(new MouseEvent(clickType, releaseEventInit));

      return { dispatched: true };
    },
    { x: point.x, y: point.y, button: domButton, buttons },
  );
}

async function canvasPoint(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<{ readonly x: number; readonly y: number }> {
  const normalizedX = numberArg(args, "x") ?? 0.5;
  const normalizedY = numberArg(args, "y") ?? 0.5;

  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect();

      if (rect === undefined) {
        return { x: 0, y: 0 };
      }

      return {
        x: rect.left + rect.width * Math.min(1, Math.max(0, x)),
        y: rect.top + rect.height * Math.min(1, Math.max(0, y)),
      };
    },
    { x: normalizedX, y: normalizedY },
  );
}
