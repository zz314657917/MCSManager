declare module "sql.js" {
  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface Statement {
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): void;
  }

  export interface Database {
    run(sql: string, params?: any[]): void;
    prepare(sql: string, params?: any[]): Statement;
    export(): Uint8Array;
    exec(sql: string): QueryExecResult[];
  }

  export interface SqlJsStatic {
    Database: {
      new (data?: Buffer | Uint8Array | number[]): Database;
    };
  }

  export default function initSqlJs(config?: Record<string, any>): Promise<SqlJsStatic>;
}
