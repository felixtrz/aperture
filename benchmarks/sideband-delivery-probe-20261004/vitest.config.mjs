import base from "../../vitest.config.ts";
export default {
  ...base,
  test: {
    ...base.test,
    include: ["benchmarks/sideband-delivery-probe-20261004/probe.test.mjs"],
    exclude: ["node_modules/**"],
    maxWorkers: 1,
    testTimeout: 20000,
    cache: false,
  },
};
