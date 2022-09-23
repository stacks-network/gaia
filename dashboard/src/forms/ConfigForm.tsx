import React from "react";
import { ConfigurationFormat, Drivers } from "configuration/Configuration";
import styled from "styled-components";
import { FieldName } from "./types/Fieldnames";
import { adminConfig, FormConfiguration, hubConfig, readerConfig } from "forms/types/FormConfiguration";
import { Button } from "@mui/material";
import { Module } from "forms/types/FormFieldProps";
import { useAppDispatch, useAppSelector } from "redux/hooks";
import { setModule, setCurrentSection } from "redux/hooks/dashboard/dashboardSlice";
import { useConfiguration } from "./customHook/configuration";
import FormStep from "./common/FormStep";

export enum FieldType {
    CHECKBOX,
    INPUT,
    DROPDOWN,
    HEADLINE,
}

export interface Field {
    type: FieldType;
    name: FieldName;
    description?: string;
    values?: string[];
    required?: boolean;
    dependsOn?: FieldName[];
    driverConfig?: Drivers;
    defaultValue?: boolean | string;
    disabled?: boolean;
    convertInputToArray?: boolean;
}

interface ConfigFormProps {
    sections: FormConfiguration;
    children?: React.ReactNode;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ sections }) => {
    const [activeModule, setActiveModule] = React.useState<number>(0);
    const fileFormat = useAppSelector((state) => state.dashboard.format);
    const module = useAppSelector((state) => state.dashboard.module);
    const currentSection = useAppSelector((state) => state.dashboard.currentSection);
    const dispatch = useAppDispatch();
    const configuration = useConfiguration();
    const [currentSections, setSections] = React.useState<FormConfiguration>(sections);

    const onButtonClick = (button: number, module: Module) => {
        setActiveModule(button);
        dispatch(setModule(module));
        dispatch(setCurrentSection(-currentSection));

        if (module === Module.ADMIN) {
            setSections(adminConfig);
        } else if (module === Module.HUB) {
            setSections(hubConfig);
        } else {
            setSections(readerConfig);
        }
    };

    const downloadFile = () => {
        const anchor = window.document.createElement("a");
        let blob = configuration?.exportToTOML();

        if (fileFormat === ConfigurationFormat.JSON) {
            blob = configuration?.exportToJSON();
        }

        if (!blob) {
            return;
        }

        anchor.href = window.URL.createObjectURL(blob);
        anchor.download = `${module}_configuration.${fileFormat.toLowerCase()}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(anchor.href);
    };

    return (
        <Container id="form">
            <ModuleSelect>
                <Button variant={`${activeModule === 0 ? "contained" : "outlined"}`} onClick={() => onButtonClick(0, Module.HUB)}>
                    Hub
                </Button>
                <Button variant={`${activeModule === 1 ? "contained" : "outlined"}`} onClick={() => onButtonClick(1, Module.READER)}>
                    Reader
                </Button>
                <Button variant={`${activeModule === 2 ? "contained" : "outlined"}`} onClick={() => onButtonClick(2, Module.ADMIN)}>
                    Admin
                </Button>
            </ModuleSelect>
            {currentSections.sections?.map(({ sectionFields, sectionName }, index) => {
                return <FormStep sectionFields={sectionFields} key={index} index={index} sectionName={sectionName} />;
            })}
            <DownloadSection
                key={`${currentSections.sections?.length}__complete`}
                className={currentSection === currentSections.sections?.length ? "active" : ""}
                id={`section_${currentSections.sections?.length}`}
            >
                <DownloadHeadline>Your Configuration is ready!</DownloadHeadline>
                <Paragraph>You can now proceed to download your configuration or go back and create a configuration for a different module</Paragraph>
                <Buttons width="auto">
                    <Button
                        onClick={() => {
                            dispatch(setCurrentSection(-currentSection));
                        }}
                        variant="contained"
                        form={`section_${currentSections.sections?.length}`}
                    >
                        Back
                    </Button>
                    <Button onClick={() => downloadFile()} variant="contained">
                        Download
                    </Button>
                </Buttons>
            </DownloadSection>
        </Container>
    );
};

export default ConfigForm;

const Container = styled.div`
    transition: all 1s ease;
    grid-column: 1 / span 24;
    overflow: hidden;
    width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 50;
`;

const ModuleSelect = styled.div`
    position: absolute;
    top: 20px;
    right: 20px;

    button {
        margin: 0 5px;
        &.MuiButton-contained {
            background: ${({ theme }) => theme.palette.main} !important;
        }

        &.MuiButton-outlined {
            color: ${({ theme }) => theme.palette.main} !important;
            border-color: ${({ theme }) => theme.palette.main} !important;
        }
    }
`;

interface ButtonsProps {
    width?: string;
}

export const Buttons = styled.div<ButtonsProps>`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: ${({ width }) => (width ? width : "100%")};
    height: 70px;

    button {
        height: 45px;
        width: 100px;
        margin: 0 10px;

        :not(:disabled) {
            background-color: ${({ theme }) => theme.palette.main} !important;
        }

        :disabled {
            background-color: ${({ theme }) => theme.palette.darkGrey} !important;
        }
    }
`;

export const Section = styled.form`
    width: 60%;
    display: none;
    padding: 0 0 50px 0;

    &.active {
        display: initial;
    }
`;

const DownloadSection = styled(Section)`
    height: 100vh;
    flex-direction: column;

    &.active {
        display: flex !important;
        align-items: center !important;
        justify-content: center;
    }

    button {
        height: 45px;
        width: 100px;
        :not(:disabled) {
            background-color: ${({ theme }) => theme.palette.main} !important;
        }

        :disabled {
            background-color: ${({ theme }) => theme.palette.darkGrey} !important;
        }
    }
`;

const Paragraph = styled.p`
    ${({ theme }) => theme.fonts.paragraph}
`;

const DownloadHeadline = styled.h1`
    ${({ theme }) => theme.fonts.headline};
    color: ${({ theme }) => theme.palette.main};
    margin: 0;
`;
