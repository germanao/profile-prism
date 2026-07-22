import { MountController } from "./mount-controller";

const RUNTIME_KEY = "__profileAuthenticityRuntimeV2";
type RuntimeGlobal = typeof globalThis & {
  [RUNTIME_KEY]?: MountController;
};

const runtimeGlobal = globalThis as RuntimeGlobal;
if (!runtimeGlobal[RUNTIME_KEY]) {
  const controller = new MountController();
  runtimeGlobal[RUNTIME_KEY] = controller;
  void controller.start();
}
