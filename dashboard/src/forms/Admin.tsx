import React from "react";
import Configuration, { Config, Drivers } from "../configuration/Configuration";

const dummyConfig: Config = {
    driver: Drivers.AWS,
    port: 3000,
};

const Admin: React.FC = () => {
    const [config, setConfig] = React.useState<Config>(dummyConfig);

    const onClick = (): void => {
        const configuration = new Configuration(config);
        const element = document.createElement("a");
        const fileBlob = configuration.exportToTOML();
        element.href = URL.createObjectURL(fileBlob);
        element.download = "config.toml";
        document.body.append(element);
        element.click();
    };

    return <button onClick={() => onClick()}>Click me!</button>;
};

export default Admin;
