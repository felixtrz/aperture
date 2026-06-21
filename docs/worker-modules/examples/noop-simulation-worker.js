export function createNoopSimulationWorker() {
  return {
    start() {},
    onSnapshot() {
      return () => {};
    },
    onError() {
      return () => {};
    },
    terminate() {},
  };
}
