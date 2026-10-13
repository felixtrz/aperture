import {
  advanceFixedStepClock,
  createFixedStepClock,
  restoreFixedStepClock,
  resetFixedStepClock,
  snapshotFixedStepClock,
  type FixedStepAdvanceResult,
  type FixedStepClock,
  type FixedStepClockOptions,
  type FixedStepClockState,
} from "@aperture-engine/physics";
import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";

export interface SimulationFixedStepContext {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly fixedDelta: number;
  readonly fixedStep: number;
  readonly substep: number;
  readonly substeps: number;
  readonly frameDelta: number;
  readonly frameTime: number;
  readonly fixedStartTime: number;
  readonly fixedEndTime: number;
  readonly frameOverstepAlpha: number;
}

export type SimulationFixedStepCallback = (
  context: SimulationFixedStepContext,
) => void;

export interface SimulationFixedStepTaskOptions {
  readonly priority?: number;
}

export interface SimulationFixedStepOptions extends FixedStepClockOptions {
  readonly enabled?: boolean;
  readonly update?: SimulationFixedStepCallback;
}

export interface SimulationFixedStepFrameReport {
  readonly enabled: boolean;
  readonly substeps: number;
  readonly fixedDelta: number;
  readonly fixedStepStart: number;
  readonly fixedStepEnd: number;
  readonly overstepAlpha: number;
  readonly consumedTime: number;
  readonly droppedTime: number;
  readonly clamped: boolean;
}

export type SimulationFixedStepClockState = FixedStepClockState;

export interface SimulationFixedStepRunner {
  readonly enabled: boolean;
  registerTask(
    task: SimulationFixedStepCallback,
    options?: SimulationFixedStepTaskOptions,
  ): () => void;
  step(delta: number, time: number): SimulationFixedStepFrameReport;
  reset(): void;
  snapshot(): SimulationFixedStepClockState | null;
  restore(state: SimulationFixedStepClockState | null): boolean;
}

interface SimulationFixedStepRunnerContext {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
}

interface RegisteredFixedStepTask {
  readonly task: SimulationFixedStepCallback;
  readonly priority: number;
  readonly order: number;
}

const DISABLED_FIXED_STEP_REPORT: SimulationFixedStepFrameReport =
  Object.freeze({
    enabled: false,
    substeps: 0,
    fixedDelta: 0,
    fixedStepStart: 0,
    fixedStepEnd: 0,
    overstepAlpha: 0,
    consumedTime: 0,
    droppedTime: 0,
    clamped: false,
  });

export function createSimulationFixedStepRunner(
  options: SimulationFixedStepOptions | false | undefined,
  context: SimulationFixedStepRunnerContext,
): SimulationFixedStepRunner {
  if (options === undefined || options === false || options.enabled === false) {
    return {
      enabled: false,
      registerTask() {
        return () => {
          // No task list exists when fixed stepping is disabled.
        };
      },
      step() {
        return DISABLED_FIXED_STEP_REPORT;
      },
      reset() {
        // No clock state exists when fixed stepping is disabled.
      },
      snapshot() {
        return null;
      },
      restore(state) {
        return state === null;
      },
    };
  }

  const clock = createFixedStepClock(options);
  const tasks: RegisteredFixedStepTask[] = [];
  let nextOrder = 0;

  if (options.update !== undefined) {
    tasks.push({
      task: options.update,
      priority: 0,
      order: nextOrder,
    });
    nextOrder += 1;
  }

  return {
    enabled: true,
    registerTask(task, taskOptions = {}) {
      const entry: RegisteredFixedStepTask = {
        task,
        priority: normalizeTaskPriority(taskOptions.priority),
        order: nextOrder,
      };

      nextOrder += 1;
      tasks.push(entry);
      sortFixedStepTasks(tasks);

      return () => {
        const index = tasks.indexOf(entry);
        if (index >= 0) {
          tasks.splice(index, 1);
        }
      };
    },
    step(delta, time) {
      const advance = advanceFixedStepClock(clock, delta);

      runFixedSubsteps({
        advance,
        clock,
        context,
        tasks,
        frameDelta: delta,
        frameTime: time,
      });

      return fixedStepFrameReport(advance);
    },
    reset() {
      resetFixedStepClock(clock);
    },
    snapshot() {
      return snapshotFixedStepClock(clock);
    },
    restore(state) {
      if (state === null) {
        return false;
      }

      restoreFixedStepClock(clock, state);
      return true;
    },
  };
}

function runFixedSubsteps(options: {
  readonly advance: FixedStepAdvanceResult;
  readonly clock: FixedStepClock;
  readonly context: SimulationFixedStepRunnerContext;
  readonly tasks: readonly RegisteredFixedStepTask[];
  readonly frameDelta: number;
  readonly frameTime: number;
}): void {
  const { advance, clock, context, tasks, frameDelta, frameTime } = options;

  if (tasks.length === 0) {
    return;
  }

  for (let substep = 0; substep < advance.substeps; substep += 1) {
    const fixedStep = advance.fixedStepStart + substep;

    for (const task of tasks) {
      task.task({
        world: context.world,
        assets: context.assets,
        fixedDelta: advance.fixedDelta,
        fixedStep,
        substep,
        substeps: advance.substeps,
        frameDelta,
        frameTime,
        fixedStartTime: fixedStep * advance.fixedDelta,
        fixedEndTime: (fixedStep + 1) * advance.fixedDelta,
        frameOverstepAlpha: clock.overstepAlpha,
      });
    }
  }
}

function sortFixedStepTasks(tasks: RegisteredFixedStepTask[]): void {
  tasks.sort((a, b) => a.priority - b.priority || a.order - b.order);
}

function normalizeTaskPriority(priority: number | undefined): number {
  const normalized = priority ?? 0;

  if (!Number.isFinite(normalized)) {
    throw new TypeError("Fixed-step task priority must be a finite number.");
  }

  return normalized;
}

function fixedStepFrameReport(
  advance: FixedStepAdvanceResult,
): SimulationFixedStepFrameReport {
  return {
    enabled: true,
    substeps: advance.substeps,
    fixedDelta: advance.fixedDelta,
    fixedStepStart: advance.fixedStepStart,
    fixedStepEnd: advance.fixedStepEnd,
    overstepAlpha: advance.overstepAlpha,
    consumedTime: advance.consumedTime,
    droppedTime: advance.droppedTime,
    clamped: advance.clamped,
  };
}
