import React from "react";
import Configuration, { Config, Drivers } from "../configuration/Configuration";
import ConfigForm, { Field, FieldName, FieldType } from "./ConfigForm";

const dummyConfig: Config = {
    driver: Drivers.AWS,
    port: 3000,
};

const formFields: Field[] = [
    {
        type: FieldType.HEADLINE,
        name: FieldName.ACME_CONFIG,
        description:
            "Options for Automatic Certificate Management Environment client. \nRequires `enableHttps` to be set to `acme`. \nSee https://www.npmjs.com/package/greenlock-express \nSee https://tools.ietf.org/html/rfc8555 \nSee https://github.com/ietf-wg-acme/acme",
        required: true,
    },
    {
        type: FieldType.CHECKBOX,
        name: FieldName.ACME_CONFIG_AGREETOS,
        description:
            "Accept Let's Encrypt(TM) v2 Agreement. You must accept the ToS as the host which handles the certs. \nSee the subscriber agreement at https://letsencrypt.org/repository/",
        required: true,
    },
];

const Admin: React.FC = () => {
    const [config, setConfig] = React.useState<Config>(dummyConfig);

    const onClick = (): void => {
        Configuration.config = config;
        const element = document.createElement("a");
        const fileBlob = Configuration.exportToTOML();
        element.href = URL.createObjectURL(fileBlob);
        element.download = "config.toml";
        document.body.append(element);
        element.click();
    };

    return <ConfigForm fields={formFields} />;
};

export default Admin;
