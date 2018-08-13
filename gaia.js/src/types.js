export type GaiaHubConfig = {
  address: string,
  url_prefix: string,
  token: string,
  server: string
}

export type HubInfo = {
  challenge_text: string,
  latest_auth_version?: string,
  read_url_prefix: string
}
