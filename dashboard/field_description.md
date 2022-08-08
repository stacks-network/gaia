acmeConfig (Sectionname): "Options for Automatic Certificate Management Environment client. \nRequires `enableHttps` to be set to `acme`. \nSee https://www.npmjs.com/package/greenlock-express \nSee https://tools.ietf.org/html/rfc8555 \nSee https://github.com/ietf-wg-acme/acme",
    - [required] agreeTos (Checkbox): "Accept Let's Encrypt(TM) v2 Agreement. You must accept the ToS as the host which handles the certs. \nSee the subscriber agreement at https://letsencrypt.org/repository/",
    - approveDomain (Input): "Array of allowed domains such as `[ \"example.com\", \"www.example.com\" ]`"
    - communityMember (Checkbox): "Join the Greenlock community to get notified of important updates."
    - configDir (Input): "Writable directory where certs will be saved."
    - debug (Checkbox)
    - [required] email (Input): "The email address of the ACME user / hosting provider."
    - [required] securityUpdates (Checkbox): "Important and mandatory notices from Greenlock, related to security or breaking API changes."
    - server (Input)
    - servername (Input): "The default servername to use when the client doesn't specify.\nExample: \"example.com\""
    - telemetry (Checkbox): "Contribute telemetry data to the project."
    - version (Input): "The ACME version to use. `v02`/`draft-12` is for Let's Encrypt v2 otherwise known as ACME draft 12."

argsTransport (Sectionname):
    - colorize (Checkbox)
    - handleExceptions (Checkbox)
    - json (Checkbox)
    - level (Dropdown) [Values: "debug", "error", "info", "verbose", "warn"]
    - timestamp (Checkbox)

authTimestampCacheSize (Input) <- This belongs to no Section

[required] driver (Dropdown) [Values: "aws", "azure", "disk", "google-cloud"]

awsCredentials (Sectionname, only appears if driver is "aws")
    - accessKeyId (Input)
    - endpoint (Input)
    - secretAccessKey (Input)
    - sessionToken (Input)

azCredentials (Sectionname, only appears if driver is "azure")
    - accountKey (Input)
    - accountName (Input)

gcCredentials (Sectionname, only appears if driver is "google-cloud")
    - credentials (Input consists of client_email (Input) and private_key (Input))
    - email (Input)
    - keyFilename (Input)
    - projectId (Input)

diskSettings (Sectionname, only appears if driver is "disk")
    - storageRootDirectory (Input)

bucket (Input, no section)
cacheControl (Input, no section)
enableHttps (Dropdown, no section) [Values: "acme", "cert_files"]: "Disabled by default. \nIf set to `cert_files` then `tlsCertConfig` must be set. \nIf set to `acme` then `acmeConfig` must be set.",
httpsPort (Input, no section, requires enableHttps to be set)
maxFileUploadSize (Input, no section): "The maximum allowed POST body size in megabytes. \nThe content-size header is checked, and the POST body stream \nis monitoring while streaming from the client. \n[Recommended] Minimum 100KB (or approximately 0.1MB)",
pageSize (Input, no section)
[required] port (Input, no section)

proofsConfig (Sectionname):
    - proofsRequired (Input): "Number of required proofs"

readUrl (Input, no section)
requireCorrectHubUrl (Checkbox, no section)
serverName (Input, no section): "Domain name used for auth/signing challenges. \nIf `requireCorrectHubUrl` is true then this must match the hub url in an auth payload."

tlsCertConfig (Sectionname): "Options for configuring the Node.js `https` server. \nRequires `enableHttps` to be set to `tlsCertConfig`. \nSee https://nodejs.org/docs/latest-v10.x/api/https.html#https_https_createserver_options_requestlistener \nSee https://nodejs.org/docs/latest-v10.x/api/tls.html#tls_tls_createsecurecontext_options"

    - [required] certFile (Input): "Either the path to the PEM formatted certification chain file, or the string content of the file. \nThe file usually has the extension `.cert`, `.cer`, `.crt`, or `.pem`. \nIf the content string is specified, it should include the escaped EOL characters, e.g. \n`\"-----BEGIN CERTIFICATE-----\\n{lines of base64 data}\\n-----END CERTIFICATE-----\"`."
    - [required] keyFile (Input): "Either the path to the PEM formatted private key file, or the string content of the file. \nThe file usually has the extension `.key` or `.pem`. \nIf the content string is specified, it should include the escaped EOL characters, e.g. \n`\"-----BEGIN RSA PRIVATE KEY-----\\n{lines of base64 data}\\n-----END RSA PRIVATE KEY-----\"`."
    - keyPassphrase (Input): "The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. \nIf not provided, the key is assumed to be unencrypted."

    - [required] pfxFile (Input): "Either the path to the PFX or PKCS12 encoded private key and certificate chain file, \nor the base64 encoded content of the file. \nThe file usually has the extension `.pfx` or `.p12`."
    - pfxPassphrase (Input): "The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. \nIf not provided, the key is assumed to be unencrypted."

validHubUrls (Sectionname): "If `requireCorrectHubUrl` is true then the hub specified in an auth payload can also be\ncontained within in array."
    - items (Input)

whitelist (Sectionname): "List of ID addresses allowed to use this hub. Specifying this makes the hub private \nand only accessible to the specified addresses. Leaving this unspecified makes the hub \npublicly usable by any ID."
    - items (Input)

