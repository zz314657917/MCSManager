import { v4 } from "uuid";
import { JsonlStorageSubsystem } from "../common/storage/jsonl_storage";

interface IQueryOptions {
  daemonId?: string;
  instanceId?: string;
  playerUuid?: string;
  limit?: number;
}

interface ICreateOptions {
  operatorName: string;
  daemonId: string;
  instanceId: string;
  playerUuid: string;
  playerName: string;
  actionKind: string;
  success: boolean;
  message: string;
  beforeValue?: number;
  afterValue?: number;
}

class GmAuditService {
  private readonly storage = new JsonlStorageSubsystem("/gm_audit", 5000);

  public async append(options: ICreateOptions): Promise<IMcsmGmAuditRecord> {
    const record: IMcsmGmAuditRecord = {
      id: v4(),
      operatorName: options.operatorName,
      daemonId: options.daemonId,
      instanceId: options.instanceId,
      playerUuid: options.playerUuid,
      playerName: options.playerName,
      actionKind: options.actionKind,
      success: options.success,
      message: options.message,
      beforeValue: options.beforeValue,
      afterValue: options.afterValue,
      time: new Date().toISOString()
    };

    await this.storage.append("global", record);
    return record;
  }

  public async query(options: IQueryOptions = {}): Promise<IMcsmGmAuditRecord[]> {
    const all = await this.storage.readAll("global");
    const limit = Math.max(1, Math.min(200, Number(options.limit) || 20));

    return (all as IMcsmGmAuditRecord[])
      .filter((item) => {
        if (options.daemonId && item.daemonId !== options.daemonId) return false;
        if (options.instanceId && item.instanceId !== options.instanceId) return false;
        if (options.playerUuid && item.playerUuid !== options.playerUuid) return false;
        return true;
      })
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, limit);
  }
}

export default new GmAuditService();
