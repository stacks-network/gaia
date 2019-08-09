import fetch from 'cross-fetch';

const API_ENDPOINT = 'https://desec.io/api/v1';
const USER_AGENT = 'blockstack-gaia-desec';

type HttpMethod = 'POST' | 'GET' | 'DELETE' | 'PUT' | 'PATCH';
type ValidContentType = 'application/json';

function getDefaultFetchOpts(opts: {
  method: HttpMethod;
  headers?: HeadersInit;
  authToken?: string;
  contentType?: ValidContentType;
  body?: BodyInit;
}): RequestInit {
  const paramHeaders: { [key: string]: string; } = {};
  if (opts.authToken) {
    paramHeaders['Authorization'] = `Token ${opts.authToken}`;
  }
  if (opts.contentType) {
    paramHeaders['Content-Type'] = opts.contentType;
  }
  const optsResult: RequestInit = {
    method: opts.method,
    mode: 'cors',
    cache: 'no-cache',
    redirect: 'follow',
    referrer: 'no-referrer',
    headers: Object.assign({
      'User-Agent': USER_AGENT
    }, paramHeaders, opts.headers)
  };
  if (opts.body !== undefined && opts.body !== null) {
    optsResult.body = opts.body;
  }
  return optsResult;
};

export interface AccountInfoResult {
  /** 
   * Email address associated with the account. This address must be valid in
   * order to submit support requests to deSEC.
   */
  email: string;
  /**
   * Maximum number of DNS zones the user can create.
   */
  limit_domains: number;
  /**
   * Indicates whether the account is locked. If so, domains put in read-only mode. 
   * Changes are not propagated in the DNS system.
   */
  locked: boolean;
}

export async function getAccountInfo(authToken: string): Promise<AccountInfoResult> {
  const url = `${API_ENDPOINT}/auth/me/`;
  const opts = getDefaultFetchOpts({
    method: 'GET',
    authToken: authToken
  });
  const response = await fetch(url, opts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const accountInfo: AccountInfoResult = await response.json();
  return accountInfo;
}

export interface RegisterResult {
  email: string;
}

export async function register(email: string, password: string): Promise<RegisterResult> {
  const url = `${API_ENDPOINT}/auth/users/`;
  const data = {
  	'email': email,
    'password': password
  };
  const opts = getDefaultFetchOpts({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
  const response = await fetch(url, opts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    if (apiError.responseJson
      && apiError.responseJson.email
      && typeof apiError.responseJson.email[0] === 'string'
      && apiError.responseJson.email[0].includes('already exists')) {
      throw new EmailAlreadyRegisteredError(apiError);
    }
    throw apiError;
  }
  const loginResult: RegisterResult = await response.json();
  return loginResult;
}

export interface LoginResult {
  auth_token: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const url = `${API_ENDPOINT}/auth/token/login/`;
  const data = {
  	'email': email,
    'password': password
  };
  const opts = getDefaultFetchOpts({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
  const response = await fetch(url, opts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const loginResult: LoginResult = await response.json();
  return loginResult;
}

/** Invalidate an auth token */
export async function logout(authToken: string): Promise<void> {
  const url = `${API_ENDPOINT}/auth/token/logout/`;
  const opts = getDefaultFetchOpts({
    method: 'POST',
    authToken: authToken
  });
  const response = await fetch(url, opts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
}

const DEFAULT_ROOT_DOMAIN = 'dedyn.io';

export interface CreateDomainResult {
  /**
   * Timestamp of domain creation, in ISO 8601 format (e.g. 2013-01-29T12:34:56.000000Z).
   */ 
  created: string;
  /**
   * Array with DNSSEC key information. Each entry contains DNSKEY and DS record contents 
   * (the latter being computed from the former), and some extra information. For delegation 
   * of DNSSEC-secured domains, the parent domain needs to publish these DS records. (This 
   * usually involves telling your registrar/registry about those records, and they will 
   * publish them for you.)
   * Notes: Newly created domains are assigned a key after a short while (usually around one 
   * minute). Until then, this field is empty. The contents of this field are generated from 
   * PowerDNS’ cryptokeys endpoint, see https://doc.powerdns.com/md/httpapi/api_spec/#cryptokeys. 
   * We look at each active cryptokey_resource (active is true) and then use the dnskey, ds, 
   * flags, and keytype fields.
   */
  keys: any[];
  /**
   * Smallest TTL that can be used in an RRset. The value is set automatically by the server. 
   * If you would like to use lower TTL values, you can apply for an exception by contacting 
   * support. We reserve the right to reject applications at our discretion.
   */
  minimum_ttl: number;
  /**
   * Domain name. Restrictions on what is a valid domain name apply on a per-user basis. In 
   * general, a domain name consists of lowercase alphanumeric characters as well as hyphens
   *  - and underscores _ (except at the beginning of the name). The maximum length is 191.
   */
  name: string;
}

export async function createDomain(
  authToken: string, name: string, useDefaultRoot = true
): Promise<CreateDomainResult> {
  let fullDomainName = name;
  if (useDefaultRoot) {
    fullDomainName = `${name}.${DEFAULT_ROOT_DOMAIN}`;
  }
  const url = `${API_ENDPOINT}/domains/`;
  const data = {
    'name': fullDomainName
  };
  const opts = getDefaultFetchOpts({
    method: 'POST',
    authToken: authToken,
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
  const response = await fetch(url, opts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    if (apiError.responseJson
      && apiError.responseJson.code
      && apiError.responseJson.code === 'domain-unavailable') {
      throw new DomainUnavailableError(apiError);
    }
    if (apiError.responseJson
      && apiError.responseJson.name
      && typeof apiError.responseJson.name[0] === 'string'
      && typeof apiError.responseJson.name[0].includes('name already exists')) {
      throw new DomainNameAlreadyExistsError(apiError);
    }
    throw apiError;
  }
  const result = await response.json();
  return result;
}

export interface DomainInfoResult {
  /**
   * Timestamp of domain creation, in ISO 8601 format (e.g. 2013-01-29T12:34:56.000000Z).
   */ 
  created: string;
  /**
   * Array with DNSSEC key information. Each entry contains DNSKEY and DS record contents 
   * (the latter being computed from the former), and some extra information. For delegation 
   * of DNSSEC-secured domains, the parent domain needs to publish these DS records. (This 
   * usually involves telling your registrar/registry about those records, and they will 
   * publish them for you.)
   * Notes: Newly created domains are assigned a key after a short while (usually around one 
   * minute). Until then, this field is empty. The contents of this field are generated from 
   * PowerDNS’ cryptokeys endpoint, see https://doc.powerdns.com/md/httpapi/api_spec/#cryptokeys. 
   * We look at each active cryptokey_resource (active is true) and then use the dnskey, ds, 
   * flags, and keytype fields.
   */
  keys: any[];
  /**
   * Smallest TTL that can be used in an RRset. The value is set automatically by the server. 
   * If you would like to use lower TTL values, you can apply for an exception by contacting 
   * support. We reserve the right to reject applications at our discretion.
   */
  minimum_ttl: number;
  /**
   * Domain name. Restrictions on what is a valid domain name apply on a per-user basis. In 
   * general, a domain name consists of lowercase alphanumeric characters as well as hyphens
   *  - and underscores _ (except at the beginning of the name). The maximum length is 191.
   */
  name: string;
  /**
   * Timestamp of when the domain’s DNS records have last been published, in ISO 8601 format 
   * (e.g. 2013-01-29T12:34:56.000000Z). As we publish record modifications immediately, this 
   * indicates the point in time of the last successful write request to a domain’s rrsets/ 
   * endpoint.
   */
  published: string;
}

export interface ListDomainsResult extends Array<DomainInfoResult> {

}

export async function listDomains(authToken: string): Promise<ListDomainsResult> {
  const url = `${API_ENDPOINT}/domains/`;
  const opts = getDefaultFetchOpts({
    method: 'GET',
    authToken: authToken
  });
  const response = await fetch(url, opts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result: ListDomainsResult = await response.json();
  return result;
}

export class ApiError extends Error {
  httpStatus: number;
  httpStatusText: string;
  responseText?: string;
  responseJson?: any;
  constructor (httpStatus: number, httpStatusText: string, responseText?: string) {
    let message = `${httpStatus}: ${httpStatusText}`;
    let responseJson: any;
    if (responseText) {
      message += ` - ${responseText}`;
      try {
        responseJson = JSON.parse(responseText);
      } catch (_err) { }
    }
    super(message);
    this.name = this.constructor.name;
    this.httpStatus = httpStatus;
    this.httpStatusText = httpStatusText;
    this.responseText = responseText;
    this.responseJson = responseJson;
  }
}

export class EmailAlreadyRegisteredError extends ApiError {
  constructor(error: ApiError) {
    super(error.httpStatus, error.httpStatusText, error.responseText);
    this.name = this.constructor.name;
    this.message = error.responseJson.email[0];
  }
}

export class DomainNameAlreadyExistsError extends ApiError {
  constructor(error: ApiError) {
    super(error.httpStatus, error.httpStatusText, error.responseText);
    this.name = this.constructor.name;
    this.message = error.responseJson.name[0];
  }
}

export class DomainUnavailableError extends ApiError {
  constructor(error: ApiError) {
    super(error.httpStatus, error.httpStatusText, error.responseText);
    this.name = this.constructor.name;
    this.message = error.responseJson.detail || error.responseJson.code;
  }
}

async function checkBadResponse(response: Response): Promise<ApiError | false> {
  if (response.ok) {
    return false;
  }
  let responseString: string | undefined;
  try {
    responseString = await response.text();
  } catch (_err) {
    // ignore
  }
  return new ApiError(response.status, response.statusText, responseString);
}
