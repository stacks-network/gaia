import Configuration, { Config } from "configuration/Configuration";
import React from "react";
import { useAppSelector } from "redux/hooks";

export function useConfiguration() {
    const configuration = useAppSelector((state) => state.dashboard.configuration) as Config;
    const [config, setConfig] = React.useState<Configuration>();

    React.useEffect(() => {
        const conf = new Configuration(configuration as Config);
        console.log(conf);
        setConfig(conf);
    }, [configuration]);

    return config;
}
