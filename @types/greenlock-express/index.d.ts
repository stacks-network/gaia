declare module 'redirect-https' {
  import * as http from 'http';

  export default function init(opts?: {
    /** securePort */
    port?: number,
    body?: string,
    /** default is false */
    trustProxy?: boolean,
  }): http.RequestListener;

}

declare module '@root/greenlock-express' {
  import { Application } from 'express';
  import * as http from 'http';
  import * as https from 'https';
  import * as http2 from 'http2';

  export type GreenlockStore = {
    /** Module require path */
    module: string,
    basePath?: string,
  };

  export interface GreenlockOptions {

    /** 
     * This should be the contact who receives critical bug and security notifications. 
     * Optionally, you may receive other (very few) updates, such as important new features.
     */
    maintainerEmail: string;

    /**
     * The contact who agrees to the Let’s Encrypt Subscriber Agreement and the Greenlock 
     * Terms of Service this contact receives renewal failure notifications.
     */
    subscriberEmail?: string;

    /** You must accept the ToS as the host which handles the certs */
    agreeToTerms: boolean;

    /** Used for the RFC 8555 / RFC 7231 ACME client user agent */
    packageAgent?: string;

    /**
     * For use with other (not Let's Encrypt) ACME services, and the Pebble test server
     * Staging API: 'https://acme-staging-v02.api.letsencrypt.org/directory'
     * Production API: 'https://acme-v02.api.letsencrypt.org/directory'
     */
    directoryUrl?: string;

    /**
     * Use the Let's Encrypt staging URL instead of the production URL. 
     */
    staging?: boolean;

    /**
     * Specify a account and domain key storage plugin. 
     * Defaults to using `greenlock-store-fs`. 
     */
    store?: GreenlockStore;

    /**
     * The default servername to use when the client doesn't specify. 
     * The default servername to use for non-sni requests. 
     * Example: "example.com"
     */
    servername?: string;

    /**
     * Directory of the project's `package.json` file.
     */
    packageRoot?: string;

    debug?: boolean;
    
    find?: (options: any) => Promise<[Site]>;

  }

  export interface Site {
    subject: string;
    altnames: string[];
    renewAt: number;
  }

  export interface GreenlockExpressOptions extends GreenlockOptions {
    /** 
     * Use the Node.js `cluster` module to take advantage of multi-core systems with child processes. 
     * @default false
     */
    cluster?: boolean;
  }
  export interface GreenlockExpressInstance {
    http2Server(options: http2.SecureServerOptions, onRequestHandler?: (request: http2.Http2ServerRequest, response: http2.Http2ServerResponse) => void): http2.Http2SecureServer;
    httpServer(requestListener?: http.RequestListener): http.Server;
    httpsServer(options: https.ServerOptions, requestListener?: http.RequestListener): https.Server;
    serveApp(app: Application);
  }

  export interface InitResult {
    ready(onReady: (instance: GreenlockExpressInstance) => void): void
  }

  /**
   * 
   */
  export function init(getConfig: (() => any & GreenlockExpressOptions)): InitResult
}

