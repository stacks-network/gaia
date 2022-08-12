import React from "react";

export enum FieldType {
    CHECKBOX,
    INPUT,
    TEXTFIELD,
    DROPDOWN,
}

export interface Field {
    type: FieldType;
    description?: string;
    // if type is dropdown
    values?: string[];
}

interface ConfigFormProps {
    fields: Field[];
    children: React.ReactNode;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ fields }) => {
    return <div></div>;
};

export default ConfigForm;
