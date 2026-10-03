import { verifyCloudTestEnvironment } from '../../scripts/test-cloud.mjs';
try {
  await verifyCloudTestEnvironment();
  console.log('Preflight passed; no runner or browser launched.');
} catch (error) {
  console.error(`Preflight rejected before execution: ${error.message}`);
  process.exitCode = 1;
}
