import fetch from 'cross-fetch';

const API_ENDPOINT = 'https://desec.io/api/v1';
const USER_AGENT = 'blockstack-gaia-desec';
const DEFAULT_ROOT_DOMAIN = 'dedyn.io';

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

export async function getAccountInfo(opts: {
  authToken: string;
}): Promise<AccountInfoResult> {
  const url = `${API_ENDPOINT}/auth/me/`;
  const fetchOpts = getDefaultFetchOpts({
    method: 'GET',
    authToken: opts.authToken
  });
  const response = await fetch(url, fetchOpts);
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

export async function register(opts: {
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const url = `${API_ENDPOINT}/auth/users/`;
  const data = {
  	'email': opts.email,
    'password': opts.password
  };
  const fetchOpts = getDefaultFetchOpts({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
  const response = await fetch(url, fetchOpts);
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

export async function login(opts: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const url = `${API_ENDPOINT}/auth/token/login/`;
  const data = {
  	'email': opts.email,
    'password': opts.password
  };
  const fetchOpts = getDefaultFetchOpts({
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const loginResult: LoginResult = await response.json();
  return loginResult;
}

/** Invalidate an auth token */
export async function logout(opts: {
  authToken: string;
}): Promise<void> {
  const url = `${API_ENDPOINT}/auth/token/logout/`;
  const fetchOpts = getDefaultFetchOpts({
    method: 'POST',
    authToken: opts.authToken
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
}

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

export async function createDomain(opts: {
  authToken: string;
  name: string;
  useDefaultRoot?: boolean;
}): Promise<CreateDomainResult> {
  const fullDomainName = getFullDomainName(opts.name, opts.useDefaultRoot);
  const url = `${API_ENDPOINT}/domains/`;
  const data = {
    'name': fullDomainName
  };
  const fetchOpts = getDefaultFetchOpts({
    method: 'POST',
    authToken: opts.authToken,
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
  const response = await fetch(url, fetchOpts);
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

export async function listDomains(opts: {
  authToken: string;
}): Promise<ListDomainsResult> {
  const url = `${API_ENDPOINT}/domains/`;
  const fetchOpts = getDefaultFetchOpts({
    method: 'GET',
    authToken: opts.authToken
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result: ListDomainsResult = await response.json();
  return result;
}

export async function getDomainInfo(opts: {
  authToken: string;
  name: string;
  useDefaultRoot?: boolean;
}): Promise<DomainInfoResult> {
  const fullDomainName = getFullDomainName(opts.name, opts.useDefaultRoot);
  const url = `${API_ENDPOINT}/domains/${fullDomainName}/`;
  const fetchOpts = getDefaultFetchOpts({
    method: 'GET',
    authToken: opts.authToken
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result: DomainInfoResult = await response.json();
  return result;
}

export interface DomainResourceRecord {
  /**
   * Name of the zone to which the RRset belongs. 
   * Note that the zone name does not follow immediately from the RRset name. 
   * For example, the `com` zone contains an RRset of type `NS` for the name 
   * `example.com.`, in order to set up the delegation to `example.com`’s DNS 
   * operator. The DNS operator’s nameserver again has a similar `NS` RRset 
   * which, this time however, belongs to the `example.com` zone.
   */
  domain: string;
  /**
   * The full DNS name of the RRset. If `subname` is empty, this is equal to 
   * `:name.`, otherwise it is equal to `:subname.:name.`.
   */
  name: string;
  /**
   * Array of record content strings. Please note that when a record value contains 
   * a domain name, it is in almost all cases required to add a final dot after 
   * the domain name. This applies, for example, to the CNAME, MX, and SRV record 
   * types. A typical MX value would thus be be 10 mx.example.com. (note the 
   * trailing dot). Please also consider the caveat on the priority field. The 
   * maximum number of array elements is 4091, and the maximum length of the array 
   * is 64,000 (after JSON encoding).
   */
  records: string[];
  /**
   * Subdomain string which, together with domain, defines the RRset name. Typical 
   * examples are www or _443._tcp. In general, a subname consists of lowercase 
   * alphanumeric characters as well as hyphens -, underscores _, and dots .. 
   * Wildcard name components are denoted by *; this is allowed only once at the 
   * beginning of the name (see RFC 4592 for details). The maximum length is 178. 
   * Further restrictions may apply on a per-user basis.
   */
  subname: string;
  /**
   * TTL (time-to-live) value, which dictates for how long resolvers may cache this 
   * RRset, measured in seconds. The smallest acceptable value is given by the 
   * domain’s minimum TTL setting. The maximum value is 604800 (one week).
   */
  ttl: number;
  /**
   * RRset type (uppercase). We support all RRset types supported by PowerDNS, with 
   * the exception of DNSSEC-related types (the backend automagically takes care of 
   * setting those records properly). You also cannot access the SOA, see SOA caveat.
   */
  type: string;
}

interface CreateRecordSetOptions extends 
  Pick<DomainResourceRecord, 'type' | 'records' | 'ttl'>, 
  Partial<Pick<DomainResourceRecord, 'subname'>> { }

interface UpdateRecordSetOptions extends 
  Pick<DomainResourceRecord, 'type'>, 
  Partial<Pick<DomainResourceRecord, 'records' | 'ttl' | 'subname'>> { }

interface DeleteRecordSetOptions extends 
  Pick<DomainResourceRecord, 'type'>,
  Partial<Pick<DomainResourceRecord, 'subname'>> { } { }

function getFullDomainName(name: string, useDefaultRoot = true): string {
  if (useDefaultRoot && !name.endsWith(`.${DEFAULT_ROOT_DOMAIN}`)) {
    return `${name}.${DEFAULT_ROOT_DOMAIN}`;
  }
  return name;
}

export async function getDomainRecordSets(opts: {
  authToken: string;
  name: string;
  useDefaultRoot?: boolean;
  filterType?: string;
}): Promise<DomainResourceRecord[]> {
  const fullDomainName = getFullDomainName(opts.name, opts.useDefaultRoot);
  let url = `${API_ENDPOINT}/domains/${fullDomainName}/rrsets/`;
  if (opts.filterType !== undefined) {
    url += `?type=${opts.filterType}`;
  }
  const fetchOpts = getDefaultFetchOpts({
    method: 'GET',
    authToken: opts.authToken
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result: DomainResourceRecord[] = await response.json();
  return result;
}

export async function createDomainRecordSet(opts: {
  recordSet: CreateRecordSetOptions | CreateRecordSetOptions[];
  authToken: string;
  name: string;
  useDefaultRoot?: boolean;
}): Promise<DomainResourceRecord | DomainResourceRecord[]> {
  const fullDomainName = getFullDomainName(opts.name, opts.useDefaultRoot);
  const url = `${API_ENDPOINT}/domains/${fullDomainName}/rrsets/`;
  const fetchOpts = getDefaultFetchOpts({
    method: 'POST',
    authToken: opts.authToken,
    contentType: 'application/json',
    body: JSON.stringify(opts.recordSet)
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result = await response.json();
  return result;
}

export async function updateDomainRecordSet(opts: {
  recordSet: UpdateRecordSetOptions | UpdateRecordSetOptions[];
  authToken: string;
  name: string;
  useDefaultRoot?: boolean;
}): Promise<DomainResourceRecord[]> {
  const fullDomainName = getFullDomainName(opts.name, opts.useDefaultRoot);
  const url = `${API_ENDPOINT}/domains/${fullDomainName}/rrsets/`;
  let recordSet: UpdateRecordSetOptions[];
  if (Array.isArray(opts.recordSet)) {
    recordSet = opts.recordSet;
  } else {
    recordSet = [opts.recordSet];
  }
  recordSet.forEach(record => {
    if (record.subname === undefined) {
      record.subname = '';
    }
  });
  const fetchOpts = getDefaultFetchOpts({
    method: 'PATCH',
    authToken: opts.authToken,
    contentType: 'application/json',
    body: JSON.stringify(recordSet)
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result = await response.json();
  return result;
}

export async function deleteDomainRecordSet(opts: {
  recordSet: DeleteRecordSetOptions | DeleteRecordSetOptions[];
  authToken: string;
  name: string;
  useDefaultRoot?: boolean;
}): Promise<void> {
  let recordSet: (DeleteRecordSetOptions & { records: string[]; })[];
  if (Array.isArray(opts.recordSet)) {
    recordSet = opts.recordSet.map(item => {
      return Object.assign(item, { records: [] });
    });
  } else {
    recordSet = [Object.assign(opts.recordSet, { records: [] })];
  }
  recordSet.forEach(record => {
    if (record.subname === undefined) {
      record.subname = '';
    }
  });
  const fullDomainName = getFullDomainName(opts.name, opts.useDefaultRoot);
  const url = `${API_ENDPOINT}/domains/${fullDomainName}/rrsets/`;
  const fetchOpts = getDefaultFetchOpts({
    method: 'PATCH',
    authToken: opts.authToken,
    contentType: 'application/json',
    body: JSON.stringify(recordSet)
  });
  const response = await fetch(url, fetchOpts);
  const apiError = await checkBadResponse(response);
  if (apiError) {
    throw apiError;
  }
  const result = await response.json();
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
