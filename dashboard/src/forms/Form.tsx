import React from "react";
import styled from "styled-components";
import ConfigForm from "./ConfigForm";
import { config } from "./types/FormConfiguration";

const Form: React.FC = () => {
    return <ConfigForm sections={config} />;
};

export default Form;
