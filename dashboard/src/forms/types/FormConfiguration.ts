import { Drivers } from "../../configuration/Configuration";
import { Field, FieldType } from "../ConfigForm";
import { FieldName } from "./Fieldnames";

interface Section {
  sectionName?: Field;
  sectionFields: Field[];
}

export interface FormConfiguration {
  sections?: Section[];
}

export const config: FormConfiguration = {
  sections: [
    {
      sectionFields: [
        {
          type: FieldType.DROPDOWN,
          name: FieldName.DRIVER,
          values: Object.keys(Drivers).map(
            (key: string) => Drivers[key as keyof typeof Drivers]
          ),
          required: true,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.PORT,
          required: true,
        },
        {
          type: FieldType.HEADLINE,
          name: FieldName.AWS_CREDENTIALS,
          driverConfig: Drivers.AWS,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AWS_CREDENTIALS_ACCESS_KEY_ID,
          driverConfig: Drivers.AWS,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AWS_CREDENTIALS_ENDPOINT,
          driverConfig: Drivers.AWS,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AWS_CREDENTIALS_SECRET_ACCESS_KEY,
          driverConfig: Drivers.AWS,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AWS_CREDENTIALS_SESSION_TOKEN,
          driverConfig: Drivers.AWS,
        },
        {
          type: FieldType.HEADLINE,
          name: FieldName.AZ_CREDENTIALS,
          driverConfig: Drivers.AZURE,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AZ_CREDENTIALS_ACCOUNT_KEY,
          driverConfig: Drivers.AZURE,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AZ_CREDENTIALS_ACCOUNT_NAME,
          driverConfig: Drivers.AZURE,
        },
        {
          type: FieldType.HEADLINE,
          name: FieldName.GC_CREDENTIALS,
          driverConfig: Drivers.GOOGLE_CLOUD,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.GC_CREDENTIALS_CREDENTIALS_CLIENT_EMAIL,
          driverConfig: Drivers.GOOGLE_CLOUD,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.GC_CREDENTIALS_CREDENTIALS_PRIVATE_KEY,
          driverConfig: Drivers.GOOGLE_CLOUD,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.GC_CREDENTIALS_EMAIL,
          driverConfig: Drivers.GOOGLE_CLOUD,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.GC_CREDENTIALS_KEY_FILENAME,
          driverConfig: Drivers.GOOGLE_CLOUD,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.GC_CREDENTIALS_PROJECT_ID,
          driverConfig: Drivers.GOOGLE_CLOUD,
        },
        {
          type: FieldType.HEADLINE,
          name: FieldName.DISK_SETTINGS,
          driverConfig: Drivers.DISK,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.DISK_SETTINGS_STORAGE_ROOT_DIRECTORY,
          driverConfig: Drivers.DISK,
        },
      ],
    },
    {
      sectionName: {
        name: FieldName.ACME_CONFIG,
        type: FieldType.HEADLINE,
      },
      sectionFields: [
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ACME_CONFIG_AGREETOS,
          description:
            "Accept Let's Encrypt(TM) v2 Agreement. You must accept the ToS as the host which handles the certs. \nSee the subscriber agreement at https://letsencrypt.org/repository/",
          dependsOn: [
            FieldName.ACME_CONFIG_APPROVE_DOMAIN,
            FieldName.ACME_CONFIG_COMMUNITY_MEMBER,
            FieldName.ACME_CONFIG_CONFIG_DIR,
            FieldName.ACME_CONFIG_DEBUG,
            FieldName.ACME_CONFIG_EMAIL,
            FieldName.ACME_CONFIG_SECURITY_UPDATES,
            FieldName.ACME_CONFIG_SERVER,
            FieldName.ACME_CONFIG_SERVERNAME,
            FieldName.ACME_CONFIG_TELEMETRY,
            FieldName.ACME_CONFIG_VERSION,
          ],
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_APPROVE_DOMAIN,
          description:
            'Array of allowed domains such as `[ "example.com", "www.example.com" ]`',
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ACME_CONFIG_COMMUNITY_MEMBER,
          description:
            "Join the Greenlock community to get notified of important updates.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_CONFIG_DIR,
          description: "Writable directory where certs will be saved.",
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ACME_CONFIG_DEBUG,
          description:
            "Join the Greenlock community to get notified of important updates.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_EMAIL,
          description: "The email address of the ACME user / hosting provider.",
          dependsOn: [
            FieldName.ACME_CONFIG_APPROVE_DOMAIN,
            FieldName.ACME_CONFIG_COMMUNITY_MEMBER,
            FieldName.ACME_CONFIG_CONFIG_DIR,
            FieldName.ACME_CONFIG_DEBUG,
            FieldName.ACME_CONFIG_EMAIL,
            FieldName.ACME_CONFIG_SECURITY_UPDATES,
            FieldName.ACME_CONFIG_SERVER,
            FieldName.ACME_CONFIG_SERVERNAME,
            FieldName.ACME_CONFIG_TELEMETRY,
            FieldName.ACME_CONFIG_VERSION,
          ],
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_SECURITY_UPDATES,
          description:
            "Important and mandatory notices from Greenlock, related to security or breaking API changes.",
          dependsOn: [
            FieldName.ACME_CONFIG_APPROVE_DOMAIN,
            FieldName.ACME_CONFIG_COMMUNITY_MEMBER,
            FieldName.ACME_CONFIG_CONFIG_DIR,
            FieldName.ACME_CONFIG_DEBUG,
            FieldName.ACME_CONFIG_EMAIL,
            FieldName.ACME_CONFIG_SECURITY_UPDATES,
            FieldName.ACME_CONFIG_SERVER,
            FieldName.ACME_CONFIG_SERVERNAME,
            FieldName.ACME_CONFIG_TELEMETRY,
            FieldName.ACME_CONFIG_VERSION,
          ],
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_SERVER,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_SERVERNAME,
          description:
            'The default servername to use when the client doesn\'t specify.\nExample: "example.com"',
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ACME_CONFIG_TELEMETRY,
          description: "Contribute telemetry data to the project.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_VERSION,
          description:
            "The ACME version to use. `v02`/`draft-12` is for Let's Encrypt v2 otherwise known as ACME draft 12.",
        },
      ],
    },
  ],
};

export const formFields: Field[] = [
  {
    type: FieldType.DROPDOWN,
    name: FieldName.DRIVER,
    values: Object.keys(Drivers).map(
      (key: string) => Drivers[key as keyof typeof Drivers]
    ),
    required: true,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.PORT,
    required: true,
  },
  {
    type: FieldType.HEADLINE,
    name: FieldName.AWS_CREDENTIALS,
    driverConfig: Drivers.AWS,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.AWS_CREDENTIALS_ACCESS_KEY_ID,
    driverConfig: Drivers.AWS,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.AWS_CREDENTIALS_ENDPOINT,
    driverConfig: Drivers.AWS,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.AWS_CREDENTIALS_SECRET_ACCESS_KEY,
    driverConfig: Drivers.AWS,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.AWS_CREDENTIALS_SESSION_TOKEN,
    driverConfig: Drivers.AWS,
  },
  {
    type: FieldType.HEADLINE,
    name: FieldName.AZ_CREDENTIALS,
    driverConfig: Drivers.AZURE,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.AZ_CREDENTIALS_ACCOUNT_KEY,
    driverConfig: Drivers.AZURE,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.AZ_CREDENTIALS_ACCOUNT_NAME,
    driverConfig: Drivers.AZURE,
  },
  {
    type: FieldType.HEADLINE,
    name: FieldName.GC_CREDENTIALS,
    driverConfig: Drivers.GOOGLE_CLOUD,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.GC_CREDENTIALS_CREDENTIALS_CLIENT_EMAIL,
    driverConfig: Drivers.GOOGLE_CLOUD,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.GC_CREDENTIALS_CREDENTIALS_PRIVATE_KEY,
    driverConfig: Drivers.GOOGLE_CLOUD,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.GC_CREDENTIALS_EMAIL,
    driverConfig: Drivers.GOOGLE_CLOUD,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.GC_CREDENTIALS_KEY_FILENAME,
    driverConfig: Drivers.GOOGLE_CLOUD,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.GC_CREDENTIALS_PROJECT_ID,
    driverConfig: Drivers.GOOGLE_CLOUD,
  },
  {
    type: FieldType.HEADLINE,
    name: FieldName.DISK_SETTINGS,
    driverConfig: Drivers.DISK,
  },
  {
    type: FieldType.INPUT,
    name: FieldName.DISK_SETTINGS_STORAGE_ROOT_DIRECTORY,
    driverConfig: Drivers.DISK,
  },
  /*
    {
        type: FieldType.HEADLINE,
        name: FieldName.ACME_CONFIG,
        description:
            "Options for Automatic Certificate Management Environment client. \nRequires `enableHttps` to be set to `acme`. \nSee https://www.npmjs.com/package/greenlock-express \nSee https://tools.ietf.org/html/rfc8555 \nSee https://github.com/ietf-wg-acme/acme",
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ACME_CONFIG_AGREETOS,
        description:
            "Accept Let's Encrypt(TM) v2 Agreement. You must accept the ToS as the host which handles the certs. \nSee the subscriber agreement at https://letsencrypt.org/repository/",
        dependsOn: [
            FieldName.ACME_CONFIG_APPROVE_DOMAIN,
            FieldName.ACME_CONFIG_COMMUNITY_MEMBER,
            FieldName.ACME_CONFIG_CONFIG_DIR,
            FieldName.ACME_CONFIG_DEBUG,
            FieldName.ACME_CONFIG_EMAIL,
            FieldName.ACME_CONFIG_SECURITY_UPDATES,
            FieldName.ACME_CONFIG_SERVER,
            FieldName.ACME_CONFIG_SERVERNAME,
            FieldName.ACME_CONFIG_TELEMETRY,
            FieldName.ACME_CONFIG_VERSION,
        ],
    },
    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_APPROVE_DOMAIN,
        description: 'Array of allowed domains such as `[ "example.com", "www.example.com" ]`',
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ACME_CONFIG_COMMUNITY_MEMBER,
        description: "Join the Greenlock community to get notified of important updates.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_CONFIG_DIR,
        description: "Writable directory where certs will be saved.",
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ACME_CONFIG_DEBUG,
        description: "Join the Greenlock community to get notified of important updates.",
    },import Headline from '../common/Headline';

    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_EMAIL,
        description: "The email address of the ACME user / hosting provider.",
        required: true,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_SECURITY_UPDATES,
        description: "Important and mandatory notices from Greenlock, related to security or breaking API changes.",
        required: true,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_SERVER,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_SERVERNAME,
        description: 'The default servername to use when the client doesn\'t specify.\nExample: "example.com"',
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ACME_CONFIG_TELEMETRY,
        description: "Contribute telemetry data to the project.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.ACME_CONFIG_VERSION,
        description: "The ACME version to use. `v02`/`draft-12` is for Let's Encrypt v2 otherwise known as ACME draft 12.",
    },
    {
        type: FieldType.HEADLINE,
        name: FieldName.ARGS_TRANSPORT,
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ARGS_TRANSPORT_COLORIZE,
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ARGS_TRANSPORT_HANDLE_EXCEPTION,
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ARGS_TRANSPORT_JSON,
    },
    {
        type: FieldType.DROPDOWN,
        name: FieldName.ARGS_TRANSPORT_LEVEL,
        values: Object.keys(ArgsTransportLevel).map((key: string) => ArgsTransportLevel[key as keyof typeof ArgsTransportLevel]),
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ARGS_TRANSPORT_TIMESTAMP,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.AUTH_TIMESTAMP_CACHE_SIZE,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.BUCKET,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.CACHE_CONTROL,
    },
    {
        type: FieldType.DROPDOWN,
        name: FieldName.ENABLE_HTTPS,
        values: Object.keys(EnableHTTPS).map((key: string) => EnableHTTPS[key as keyof typeof EnableHTTPS]),
        description:
            "Disabled by default. \nIf set to `cert_files` then `tlsCertConfig` must be set. \nIf set to `acme` then `acmeConfig` must be set.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.HTTPS_PORT,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.MAX_FILE_UPLOAD_SIZE,
        description:
            "The maximum allowed POST body size in megabytes. \nThe content-size header is checked, and the POST body stream \nis monitoring while streaming from the client. \n[Recommended] Minimum 100KB (or approximately 0.1MB)",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.PAGE_SIZE,
    },
    {
        type: FieldType.HEADLINE,
        name: FieldName.PROOFS_CONFIG,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.PROOFS_CONFIG_PROOFS_REQUIRED,
        description: "Number of required proofs",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.READ_URL,
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.REQUIRE_CORRECT_HUB_URL,
    },
    {
        type: FieldType.INPUT,
        name: FieldName.SERVERNAME,
    },
    {
        type: FieldType.HEADLINE,
        name: FieldName.TLS_CERT_CONFIG,
        description:
            "Options for configuring the Node.js `https` server. \nRequires `enableHttps` to be set to `tlsCertConfig`. \nSee https://nodejs.org/docs/latest-v10.x/api/https.html#https_https_createserver_options_requestlistener \nSee https://nodejs.org/docs/latest-v10.x/api/tls.html#tls_tls_createsecurecontext_options",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.TLS_CERT_CONFIG_CERTFILE,
        description:
            'Either the path to the PEM formatted certification chain file, or the string content of the file. \nThe file usually has the extension `.cert`, `.cer`, `.crt`, or `.pem`. \nIf the content string is specified, it should include the escaped EOL characters, e.g. \n`"-----BEGIN CERTIFICATE-----\\n{lines of base64 data}\\n-----END CERTIFICATE-----"`.',
    },
    {
        type: FieldType.INPUT,
        name: FieldName.TLS_CERT_CONFIG_KEYFILE,
        description:
            'Either the path to the PEM formatted private key file, or the string content of the file. \nThe file usually has the extension `.key` or `.pem`. \nIf the content string is specified, it should include the escaped EOL characters, e.g. \n`"-----BEGIN RSA PRIVATE KEY-----\\n{lines of base64 data}\\n-----END RSA PRIVATE KEY-----"`.',
    },
    {
        type: FieldType.INPUT,
        name: FieldName.TLS_CERT_CONFIG_KEYPASSPHRASE,
        description:
            "The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. \nIf not provided, the key is assumed to be unencrypted.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.TLS_CERT_CONFIG_PFXFILE,
        description:
            "Either the path to the PFX or PKCS12 encoded private key and certificate chain file, \nor the base64 encoded content of the file. \nThe file usually has the extension `.pfx` or `.p12`.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.TLS_CERT_CONFIG_PFXPASSPHRASE,
        description:
            "The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. \nIf not provided, the key is assumed to be unencrypted.",
    },
    {
        type: FieldType.HEADLINE,
        name: FieldName.VALID_HUB_URLS,
        description: "If `requireCorrectHubUrl` is true then the hub specified in an auth payload can also be\ncontained within in array.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.VALID_HUB_URLS_ITEMS,
    },
    {
        type: FieldType.HEADLINE,
        name: FieldName.WHITELIST,
        description:
            "List of ID addresses allowed to use this hub. Specifying this makes the hub private \nand only accessible to the specified addresses. Leaving this unspecified makes the hub \npublicly usable by any ID.",
    },
    {
        type: FieldType.INPUT,
        name: FieldName.WHITELIST_ITEMS,
    },
    */
];
