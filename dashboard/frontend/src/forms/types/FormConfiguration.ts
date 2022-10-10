import {
  ArgsTransportLevel,
  Drivers,
  EnableHTTPS,
} from "configuration/Configuration";
import { Field, FieldType } from "forms/ConfigForm";
import { FieldName } from "./Fieldnames";

interface Section {
  sectionName?: Field;
  sectionFields: Field[];
}

export interface FormConfiguration {
  sections?: Section[];
}

export const testConfig: FormConfiguration = {
  sections: [
    {
      sectionFields: [
        {
          type: FieldType.INPUT,
          name: FieldName.WHITELIST_ITEMS,
          description:
            "List of ID addresses allowed to use this hub. Specifying this makes the hub private \nand only accessible to the specified addresses. Leaving this unspecified makes the hub \npublicly usable by any ID.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AUTH_TIMESTAMP_CACHE_SIZE,
          description:
            "Time in seconds for how long to cache client authentication tokens. The timestamp is written to a bucket-specific file (/{address}-auth). This becomes the oldest valid iat timestamp for authentication tokens that write to the /{address}/ bucket. Cache is used to decrease latency when determining write access.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.BUCKET,
          description:
            "Only applicable to object store drivers (gcs/s3/azure), this setting is the name of the object store, i.e. an s3 bucket of `s3://mybucket` means the value here would be `mybucket`",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.CACHE_CONTROL,
          description:
            "Only applicable to object store drivers (gcs/s3/azure), this setting applies cache-control settings to files in the bucket",
        },

        {
          type: FieldType.INPUT,
          name: FieldName.HTTPS_PORT,
          description:
            "Requires `enableHttps` set to true, as well as `tlsCertConfig` configured with an installed SSL certificate. This option configures the port to serve https traffic on (default: 443)",
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
          description: "The number of items to return when listing files",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.READ_URL,
          description:
            "Route/domain to use to read - this would be the fqdn to where the files are stored for reading. Typically this would be used when using a CDN to cache files where the read/write URL's would be different.",
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.REQUIRE_CORRECT_HUB_URL,
          description:
            "Domain name used for auth/signing challenges. If this is true, `serverName` must match the hub url in an auth payload.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.VALID_HUB_URLS_ITEMS,
          dependsOn: [FieldName.REQUIRE_CORRECT_HUB_URL],
          description:
            "If `requireCorrectHubUrl` is true then the hub specified in an auth payload can also be\ncontained within in array.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.SERVERNAME,
          dependsOn: [FieldName.REQUIRE_CORRECT_HUB_URL],
        },
      ],
    },
    {
      sectionFields: [
        {
          type: FieldType.INPUT,
          name: FieldName.ACME_CONFIG_APPROVE_DOMAIN,
        },
      ],
    },
  ],
};

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
          description:
            "only required when using the disk driver. The path defined here must be an absolute path, ex: `/opt/storage/gaia-files`",
        },
      ],
    },
    {
      sectionFields: [
        {
          type: FieldType.INPUT,
          name: FieldName.WHITELIST_ITEMS,
          description:
            "List of ID addresses allowed to use this hub. Specifying this makes the hub private \nand only accessible to the specified addresses. Leaving this unspecified makes the hub \npublicly usable by any ID.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AUTH_TIMESTAMP_CACHE_SIZE,
          description:
            "Time in seconds for how long to cache client authentication tokens. The timestamp is written to a bucket-specific file (/{address}-auth). This becomes the oldest valid iat timestamp for authentication tokens that write to the /{address}/ bucket. Cache is used to decrease latency when determining write access.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.BUCKET,
          description:
            "Only applicable to object store drivers (gcs/s3/azure), this setting is the name of the object store, i.e. an s3 bucket of `s3://mybucket` means the value here would be `mybucket`",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.CACHE_CONTROL,
          description:
            "Only applicable to object store drivers (gcs/s3/azure), this setting applies cache-control settings to files in the bucket",
        },

        {
          type: FieldType.INPUT,
          name: FieldName.HTTPS_PORT,
          description:
            "Requires `enableHttps` set to true, as well as `tlsCertConfig` configured with an installed SSL certificate. This option configures the port to serve https traffic on (default: 443)",
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
          description: "The number of items to return when listing files",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.READ_URL,
          description:
            "Route/domain to use to read - this would be the fqdn to where the files are stored for reading. Typically this would be used when using a CDN to cache files where the read/write URL's would be different.",
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.REQUIRE_CORRECT_HUB_URL,
          description:
            "Domain name used for auth/signing challenges. If this is true, `serverName` must match the hub url in an auth payload.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.VALID_HUB_URLS_ITEMS,
          dependsOn: [FieldName.REQUIRE_CORRECT_HUB_URL],
          description:
            "If `requireCorrectHubUrl` is true then the hub specified in an auth payload can also be\ncontained within in array.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.SERVERNAME,
          dependsOn: [FieldName.REQUIRE_CORRECT_HUB_URL],
        },
      ],
    },
    {
      sectionName: {
        name: FieldName.ARGS_TRANSPORT,
        type: FieldType.HEADLINE,
      },
      sectionFields: [
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ARGS_TRANSPORT_COLORIZE,
          description:
            "Colorize logging output, useful when tailing logs to spot errors/warnings etc",
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ARGS_TRANSPORT_HANDLE_EXCEPTION,
          description:
            "Option to leave server running if an exception is encountered",
          defaultValue: true,
          disabled: true,
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ARGS_TRANSPORT_JSON,
          description:
            "option to display logging output to json format (typically for use with logging aggregators)",
        },
        {
          type: FieldType.DROPDOWN,
          name: FieldName.ARGS_TRANSPORT_LEVEL,
          values: Object.keys(ArgsTransportLevel).map(
            (key: string) =>
              ArgsTransportLevel[key as keyof typeof ArgsTransportLevel]
          ),
          description: "Logging level based on RFC-5424 (default: warn)",
        },
        {
          type: FieldType.CHECKBOX,
          name: FieldName.ARGS_TRANSPORT_TIMESTAMP,
          description: "Include timestamp in the log message",
          defaultValue: true,
          disabled: true,
        },
        {
          type: FieldType.INPUT,
          name: FieldName.AUTH_TIMESTAMP_CACHE_SIZE,
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
          type: FieldType.CHECKBOX,
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
    {
      sectionName: {
        name: FieldName.TLS_CERT_CONFIG,
        type: FieldType.HEADLINE,
      },

      sectionFields: [
        {
          type: FieldType.DROPDOWN,
          name: FieldName.ENABLE_HTTPS,
          values: Object.keys(EnableHTTPS).map(
            (key: string) => EnableHTTPS[key as keyof typeof EnableHTTPS]
          ),
          description:
            "Disabled by default. \nIf set to `cert_files` then `tlsCertConfig` must be set. \nIf set to `acme` then `acmeConfig` must be set.",
        },
        {
          type: FieldType.INPUT,
          name: FieldName.TLS_CERT_CONFIG_CERTFILE,
          description:
            'Either the path to the PEM formatted certification chain file, or the string content of the file. \nThe file usually has the extension `.cert`, `.cer`, `.crt`, or `.pem`. \nIf the content string is specified, it should include the escaped EOL characters, e.g. \n`"-----BEGIN CERTIFICATE-----\\n{lines of base64 data}\\n-----END CERTIFICATE-----"`.',
          dependsOn: [FieldName.TLS_CERT_CONFIG_KEYFILE],
        },
        {
          type: FieldType.INPUT,
          name: FieldName.TLS_CERT_CONFIG_KEYFILE,
          description:
            'Either the path to the PEM formatted private key file, or the string content of the file. \nThe file usually has the extension `.key` or `.pem`. \nIf the content string is specified, it should include the escaped EOL characters, e.g. \n`"-----BEGIN RSA PRIVATE KEY-----\\n{lines of base64 data}\\n-----END RSA PRIVATE KEY-----"`.',
          dependsOn: [FieldName.TLS_CERT_CONFIG_CERTFILE],
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
          dependsOn: [FieldName.TLS_CERT_CONFIG_KEYPASSPHRASE],
        },
        {
          type: FieldType.INPUT,
          name: FieldName.TLS_CERT_CONFIG_PFXPASSPHRASE,
          description:
            "The string passphrase for the key file. If provided, the passphrase is used to decrypt the file. \nIf not provided, the key is assumed to be unencrypted.",
          dependsOn: [FieldName.TLS_CERT_CONFIG_PFXFILE],
        },
      ],
    },
  ],
};
