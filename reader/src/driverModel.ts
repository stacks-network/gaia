import {Readable} from "stream";

export interface PerformStatArgs {
  path: string;
  storageTopLevel: string;
}

export interface PerformReadArgs {
  path: string;
  storageTopLevel: string;
}

export interface StatResult {
  exists: boolean;
  lastModifiedDate: number;
  etag: string;
  contentLength: number;
  contentType: string;
}

export interface ReadResult extends StatResult {
  data: Readable;
  exists: true
}

export interface DriverModel {
  performStat(args: PerformStatArgs): Promise<StatResult>;
  performRead(args: PerformReadArgs): Promise<ReadResult>;
}

export interface DriverConstructor {
  new (config: any): DriverModel;
}
