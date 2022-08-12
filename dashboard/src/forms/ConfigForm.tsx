import { TextField, TextareaAutosize, Checkbox, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import React from "react";
import { useForm } from "react-hook-form";
import { Config } from "../configuration/Configuration";
import styled from "styled-components";

export enum FieldType {
    CHECKBOX,
    INPUT,
    TEXTAREA,
    DROPDOWN,
    HEADLINE,
}

export enum FieldName {
    ACME_CONFIG = "acmeConfig",
    ACME_CONFIG_AGREETOS = "acmeConfig.agreeTos",
    ACME_CONFIG_APPROVE_DOMAIN = "acmeConfig.approveDomain",
    ACME_CONFIG_COMMUNITY_MEMBER = "acmeConfig.communityMember",
    ACME_CONFIG_CONFIG_DIR = "acmeConfig.configDir",
    ACME_CONFIG_DEBUG = "acmeConfig.debug",
    ACME_CONFIG_EMAIL = "acmeConfig.email",
    ACME_CONFIG_SECURITY_UPDATES = "acmeConfig.securityUpdates",
    ACME_CONFIG_SERVERNAME = "acmeConfig.servername",
    ACME_CONFIG_TELEMETRY = "acmeConfig.telemetry",
    ACME_CONFIG_VERSION = "acmeConfig.version",
    ARGS_TRANSPORT = "argsTransport",
    ARGS_TRANSPORT_COLORIZE = "argsTransport.colorize",
    ARGS_TRANSPORT_HANDLE_EXCEPTION = "argsTransport.handleExceptions",
    ARGS_TRANSPORT_JSON = "argsTransport.json",
    ARGS_TRANSPORT_LEVEL = "argsTransport.level",
    ARGS_TRANSPORT_TIMESTAMP = "argsTransport.timestamp",
    AUTH_TIMESTAMP_CACHE_SIZE = "authTimestampCacheSize",
    AWS_CREDENTIALS = "awsCredentials",
    AWS_CREDENTIALS_ACCESS_KEY_ID = "awsCredentials.accessKeyId",
    AWS_CREDENTIALS_ENDPOINT = "awsCredentials.endpoint",
    AWS_CREDENTIALS_SECRET_ACCESS_KEY = "awsCredentials.secretAccessKey",
    AWS_CREDENTIALS_SESSION_TOKEN = "awsCredentials.sessionToken",
    AZ_CREDENTIALS = "azCredentials",
    AZ_CREDENTIALS_ACCOUNT_KEY = "azCredentials.accountKey",
    AZ_CREDENTIALS_ACCOUNT_NAME = "azCredentials.accountName",
    BUCKET = "bucket",
    CACHE_CONTROL = "cacheControl",
    DISK_SETTINGS = "diskSettings",
    DISK_SETTINGS_STORAGE_ROOT_DIRECTORY = "diskSettings.storageRootDirectory",
    DRIVER = "driver",
    ENABLE_HTTPS = "enableHttps",
    GC_CREDENTIALS = "gcCredentials",
    GC_CREDENTIALS_CREDENTIALS = "gcCredentials.credentials",
    GC_CREDENTIALS_CREDENTIALS_CLIENT_EMAIL = "gcCredentials.credentials.client_email",
    GC_CREDENTIALS_CREDENTIALS_PRIVATE_KEY = "gcCredentials.credentials.private_key",
    GC_CREDENTIALS_EMAIL = "gcCredentials.email",
    GC_CREDENTIALS_KEY_FILENAME = "gcCredentials.keyFilename",
    GC_CREDENTIALS_PROJECT_ID = "gcCredentials.projectId",
    HTTPS_PORT = "httpsPort",
    MAX_FILE_UPLOAD_SIZE = "maxFileUploadSize",
    PAGE_SIZE = "pageSize",
    PORT = "port",
    PROOFS_CONFIG = "proofsConfig",
    PROOFS_CONFIG_PROOFS_REQUIRED = "proofsConfig.proofsRequired",
    READ_URL = "readUrl",
    REQUIRE_CORRECT_HUB_URL = "requireCorrectHubUrl",
    SERVERNAME = "serverName",
    TLS_CERT_CONFIG = "tlsCertConfig",
    TLS_CERT_CONFIG_CERTFILE = "tlsCertConfig.certFile",
    TLS_CERT_CONFIG_KEYFILE = "tlsCertConfig.keyFile",
    TLS_CERT_CONFIG_KEYPASSPHRASE = "tlsCertConfig.keyPassphrase",
    TLS_CERT_CONFIG_PFXFILE = "tlsCertConfig.pfxFile",
    TLS_CERT_CONFIG_PFXPASSPHRASE = "tlsCertConfig.pfxPassphrase",
    VALID_HUB_URLS = "validHubUrls",
    VALID_HUB_URLS_ITEMS = "validHubUrls.items",
    WHITELIST = "whitelist",
    WHITELIST_ITEMS = "whitelist.items",
}

export interface Field {
    type: FieldType;
    name: FieldName;
    description?: string;
    // if type is dropdown
    values?: string[];
    required?: boolean;
}

interface ConfigFormProps {
    fields: Field[];
    children?: React.ReactNode;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ fields }) => {
    const {
        register,
        setValue,
        handleSubmit,
        formState: { errors },
    } = useForm<Config>();

    const onSubmit = handleSubmit((data) => console.log(data));

    return (
        <Form onSubmit={onSubmit}>
            {fields.map((field) => {
                const headline = field.name.includes(".") ? field.name.split(".")[1] : field.name;

                if (field.type === FieldType.INPUT) {
                    return (
                        <TextField required={field.required} defaultValue={"Type here"} {...register(field.name)} variant={"outlined"}></TextField>
                    );
                } else if (field.type === FieldType.CHECKBOX) {
                    return (
                        <FormInputContainer>
                            <LabelHeadline>{headline}</LabelHeadline>
                            <FormInputBody>
                                <Checkbox id={`${field.name}_checkbox`} required={field.required} {...register(field.name)} />
                                <Description htmlFor={`${field.name}_checkbox`}>{field.description}</Description>
                            </FormInputBody>
                        </FormInputContainer>
                    );
                } else if (field.type === FieldType.HEADLINE) {
                    return <Headline>{headline}</Headline>;
                }
            })}
            <button type="submit">Click me!</button>
        </Form>
    );
};

export default ConfigForm;

const Form = styled.form`
    grid-column: 6 / span 12;
`;

const FormInputContainer = styled.div`
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.palette.grey};
    padding: 40px 30px;
`;

const FormInputBody = styled.span`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`;

const LabelHeadline = styled.h2`
    ${({ theme }) => theme.fonts.headline.label};
    color: ${({ theme }) => theme.palette.black};
`;

const Description = styled.label`
    cursor: pointer;
    color: ${({ theme }) => theme.palette.black};
    margin: 0;
    ${({ theme }) => theme.fonts.paragraph};
`;

const Headline = styled.h1`
    ${({ theme }) => theme.fonts.headline.main};
    color: ${({ theme }) => theme.palette.main};
`;
