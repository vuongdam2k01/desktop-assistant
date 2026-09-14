import { runUnitTests } from "./unit-evaluator.test.js";

try {
  runUnitTests();
} catch (err: any) {
  console.error("Unit test execution failed:", err);
  process.exit(1);
}
