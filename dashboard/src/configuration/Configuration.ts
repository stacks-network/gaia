import json2toml from "json2toml";

interface ACMEConfig {
  agreeTos: boolean;
  email: string;
  securityUpdates: boolean;
  approveDomain?: string;
  communityMember?: boolean;
  configDir?: string;
  debug?: boolean;
  server?: string;
  servername?: string;
  telemetry?: boolean;
  version?: string;
}

export enum ArgsTransportLevel {
  DEBUG = "debug",
  ERROR = "error",
  VERBOSE = "verbose",
  WARN = "warn",
}

interface ArgsTranport {
  colorize: boolean;
  handleExceptions: boolean;
  json: boolean;
  level: ArgsTransportLevel;
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

export enum ConfigurationFormat {
  JSON = "JSON",
  TOML = "TOML",
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

  constructor(config: Config) {
    this.config = config;
  }

  exportToJSON(): Blob {
    if (this.config === undefined) {
      throw Error("Configuration is empty");
    }

    return new Blob([JSON.stringify(this.config)], {
      type: "text/plain",
    });
  }

  exportToTOML(): Blob {
    if (this.config === undefined) {
      throw Error("Configuration is empty");
    }

    const tomlConfig = json2toml(this.config);

    return new Blob([tomlConfig], {
      type: "text/plain",
    });
  }

  toTOML(): string {
    return json2toml(this.config);
  }
}
