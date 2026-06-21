import { advanceFixedStepClock, createFixedStepClock, resetFixedStepClock, } from "/aperture/worker-modules/packages/physics/dist/index.js";
const DISABLED_FIXED_STEP_REPORT = Object.freeze({
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
export function createSimulationFixedStepRunner(options, context) {
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
        };
    }
    const clock = createFixedStepClock(options);
    const tasks = [];
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
            const entry = {
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
    };
}
function runFixedSubsteps(options) {
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
function sortFixedStepTasks(tasks) {
    tasks.sort((a, b) => a.priority - b.priority || a.order - b.order);
}
function normalizeTaskPriority(priority) {
    const normalized = priority ?? 0;
    if (!Number.isFinite(normalized)) {
        throw new TypeError("Fixed-step task priority must be a finite number.");
    }
    return normalized;
}
function fixedStepFrameReport(advance) {
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
//# sourceMappingURL=fixed-step-schedule.js.map