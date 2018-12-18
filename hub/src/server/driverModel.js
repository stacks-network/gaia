/* @flow */

import type { Readable } from 'stream'

export type ListFilesResult = { entries: Array<string>, page: ?string };

export interface DriverModel {
  getReadURLPrefix(): string;
  performWrite(args: { path: string,
                       storageTopLevel: string,
                       stream: Readable,
                       contentLength: number,
                       contentType: string }): Promise<string>;
  listFiles(storageTopLevel: string, page: ?string):
             Promise<ListFilesResult>;
}

export interface DriverStatics {
  getConfigInformation(): { defaults: Object,
                            envVars: Object }
}
