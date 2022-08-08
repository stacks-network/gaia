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
  acmeConfig?: ACMEConfig;
  argsTransport?: ArgsTranport;
  authTimestampCacheSize?: string;
  awsCredentials?: AWSCredentials;
  azCredentials?: AZCredentials;
  gcCredentials?: GCCredentials;
  diskSettings?: DiskSettings;
  bucket?: string;
  cacheControl?: string;
  enableHttps?: EnableHTTPS;
  httpsPort?: number;
  maxFileUploadSize?: number;
  pageSize?: number;
  proofsConfig?: ProofsConfig;
  readUrl?: string;
  requireCorrectHubUrl?: boolean;
  serverName?: string;
  tlsCertConfig?: TLSCertConfig;
  validHubUrls?: ValidHubUrls;
  whitelist?: Whitelist;
}

export default class Configuration {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  exportToTOML(): Blob {
    const config = `port = ${this.config.port}
driver = ${this.config.driver}
    `;

    return new Blob([config], {
      type: "text/plain",
    });
  }
}
