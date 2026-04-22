import { EventEmitter } from "events";

export interface IInstanceProcessRuntimeState {
  pid?: number | string;
  rootPid?: number | string;
  childPid?: number | string;
  rootState?: string;
  childState?: string;
  sessionAlive?: boolean;
  healthy?: boolean;
}

// Instance specific process interface
export interface IInstanceProcess extends EventEmitter {
  pid?: number | string;
  rootPid?: number | string;
  childPid?: number | string;
  getRuntimeState?: () => IInstanceProcessRuntimeState;
  kill: (signal?: any) => any;
  destroy: () => void;
  write: (data?: any) => any;
}
