import { nestedRecord, numberArg, stringArg } from "./args.js";
import { readGeneratedStatus, type AperturePage } from "./browser.js";

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

  await page.mouse.click(point.x, point.y);
  return { ok: true, point, page: await readGeneratedStatus(page) };
}

export async function inputDrag(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const from = await canvasPoint(page, nestedRecord(args, "from") ?? args);
  const to = await canvasPoint(page, nestedRecord(args, "to") ?? args);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();

  return { ok: true, from, to, page: await readGeneratedStatus(page) };
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
