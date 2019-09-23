declare module 'greenlock-express' {
  import { Application } from 'express'

  /**
   * 
   */
  export function create(opts: {
    /** The email address of the ACME user / hosting provider */
    email: string;
    /** You must accept the ToS as the host which handles the certs */
    agreeTos: boolean;
    /** Writable directory where certs will be saved */
    configDir: string;
    /** Get (rare) non-mandatory updates about cool greenlock-related stuff (default false) */
    communityMember: boolean;
    /** Important and mandatory notices related to security or breaking API changes (default true) */
    securityUpdates: boolean;
    /** Contribute telemetry data to the project */
    telemetry: boolean;

    /**
     * 'draft-12' or 'v01'
     * 'draft-12' is for Let's Encrypt v2 otherwise known as ACME draft 12
     * 'v02' is an alias for 'draft-12'
     * 'v01' is for the pre-spec Let's Encrypt v1
     */
    version?: string;

    /**
     * staging API: 'https://acme-staging-v02.api.letsencrypt.org/directory'
     * production API: 'https://acme-v02.api.letsencrypt.org/directory'
     */
    server?: string;

    /** default to 'http-01' */
    challengeType?: string;

    debug?: boolean;

    /**
     * The default servername to use when the client doesn't specify.
     * Example: "example.com"
     */
    servername?: string;
    
    /**
     * Array of allowed domains such as `[ "example.com", "www.example.com" ]`
     */
    approveDomains?: string[];

    /** An express app instance */
    app: Application;

  }): Application

}

