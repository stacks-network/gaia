/* @flow */

import { Readable } from 'stream'

export type ListFilesResult = { entries: Array<string>, page: ?string };
export type PerformWriteArgs = { 
  path: string,
  storageTopLevel: string,
  stream: Readable,
  contentLength: number,
  contentType: string };

export interface DriverModel {
  getReadURLPrefix(): string;
  performWrite(args: PerformWriteArgs): Promise<string>;
  listFiles(storageTopLevel: string, page: ?string):
             Promise<ListFilesResult>;
  constructor(config: any) : void
}

export interface DriverStatics {
  getConfigInformation(): { defaults: Object,
                            envVars: Object }
}
