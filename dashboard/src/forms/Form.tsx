import React from "react";
import ConfigForm from "./ConfigForm";
import { config } from "./types/FormConfiguration";

const Form: React.FC = () => {
    return <ConfigForm sections={config} />;
};

export default Form;
