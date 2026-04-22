import { ProcessConfig } from "../instance/process_config";
import pidusage from "pidusage";
import InstanceCommand from "./base/command";
import Instance from "../instance/instance";

export default class ProcessInfoCommand extends InstanceCommand {
  constructor() {
    super("ProcessInfo");
  }
  async exec(instance: Instance): Promise<Object> {
    let info: any = {
      cpu: 0, // percentage (from 0 to 100*vcore)
      memory: 0, // bytes
      ppid: 0, // PPID
      pid: 0, // PID
      ctime: 0, // ms user + system time
      elapsed: 0, // ms since the start of the process
      timestamp: 0 // ms since epoch
    };
    const runtimePid = instance.process?.getRuntimeState?.().pid ?? instance.process?.pid;
    if (instance.process && runtimePid) {
      info = await pidusage(runtimePid);
    }
    return info;
  }
}
