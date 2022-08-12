interface ACMEConfig {
  agreeTos: boolean;
  email: string;
  securityUpdates: boolean;
  approveDomain?: string;
  communityMember?: boolean;
  configDir?: string;
  debug?: boolean;
  servername?: string;
  telemetry?: boolean;
  version?: string;
}

export enum ArgsTransportEnum {
  DEBUG = "debug",
  ERROR = "error",
  VERBOSE = "verbose",
  WARN = "warn",
}

interface ArgsTranport {
  colorize: boolean;
  handleExceptions: boolean;
  json: boolean;
  level: ArgsTransportEnum;
  timestamp: boolean;
}

export enum Drivers {
  AWS = "aws",
  AZURE = "azure",
  DISK = "disk",
  GOOGLE_CLOUD = "google-cloud",
}

interface AWSCredentials {
  accessKeyId: string;
  endpoint: string;
  secretAccessKey: string;
  sessionToken: string;
}

interface AZCredentials {
  accountKey: string;
  accountName: string;
}

interface GCCredentialsCredentials {
  client_email: string;
  private_key: string;
}

interface GCCredentials {
  credentials: GCCredentialsCredentials;
  email: string;
  keyFilename: string;
  projectId: string;
}

interface DiskSettings {
  storageRootDirectory: string;
}

interface ProofsConfig {
  proofsRequired: string;
}

export enum EnableHTTPS {
  ACME = "acme",
  CERT_FILES = "cert_files",
}

interface TLSCertConfig {
  certFile: string;
  keyFile: string;
  keyPassphrase?: string;
  pfxFile?: string;
  pfxPassphrase?: string;
}

interface ValidHubUrls {
  items: string[];
}

interface Whitelist {
  items: string[];
}

export interface Config {
  driver: Drivers;
  port: number;
  bucket?: string;
  httpsPort?: number;
  cacheControl?: string;
  maxFileUploadSize?: number;
  pageSize?: number;
  readUrl?: string;
  requireCorrectHubUrl?: boolean;
  serverName?: string;
  acmeConfig?: ACMEConfig;
  argsTransport?: ArgsTranport;
  authTimestampCacheSize?: string;
  awsCredentials?: AWSCredentials;
  azCredentials?: AZCredentials;
  gcCredentials?: GCCredentials;
  diskSettings?: DiskSettings;
  enableHttps?: EnableHTTPS;
  proofsConfig?: ProofsConfig;
  tlsCertConfig?: TLSCertConfig;
  validHubUrls?: ValidHubUrls;
  whitelist?: Whitelist;
}

export default class Configuration {
  config: Config | undefined = undefined;

  private static _instance: Configuration;

  private constructor() {}

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  public static set config(config: Config) {
    if (this._instance.config === undefined) {
      this._instance.config = config;
    } else {
      this._instance.config = {
        ...this._instance.config,
        ...config,
      };
    }
  }

  static exportToTOML(): Blob {
    const config = `port = ${this._instance.config?.port}
driver = ${this._instance.config?.driver}
    `;

    return new Blob([config], {
      type: "text/plain",
    });
  }
}
