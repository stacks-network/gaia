import React from "react";
import { useForm } from "react-hook-form";
import { Config, ConfigurationFormat, Drivers } from "configuration/Configuration";
import styled from "styled-components";
import { FieldName } from "./types/Fieldnames";
import { FormConfiguration } from "forms/types/FormConfiguration";
import Checkbox from "forms/common/Checkbox";
import Input from "forms/common/Input";
import Headline from "forms/common/Headline";
import Dropdown from "forms/common/Dropdown";
import { Button } from "@mui/material";
import { Module } from "forms/types/FormFieldProps";
import { useAppDispatch, useAppSelector } from "redux/hooks";
import { setConfiguration, setModule } from "redux/hooks/dashboard/dashboardSlice";
import { useConfiguration } from "./customHook/configuration";

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
    // if type is dropdown
    values?: string[];
    required?: boolean;
    dependsOn?: FieldName[];
    driverConfig?: Drivers;
}

interface ConfigFormProps {
    sections: FormConfiguration;
    children?: React.ReactNode;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ sections }) => {
    const {
        register,
        getValues,
        handleSubmit,
        unregister,
        formState: { errors },
    } = useForm<Config>();

    const [currentDriver, setCurrentDriver] = React.useState<Drivers>(Drivers.AWS);
    const [currentSection, setCurrentSection] = React.useState<number>(0);
    const [activeModule, setActiveModule] = React.useState<number>(0);
    const fileFormat = useAppSelector((state) => state.dashboard.format);
    const dispatch = useAppDispatch();
    const configuration = useConfiguration();

    const handleDependantFields = (dependsOn: FieldName[]): boolean => {
        for (let i = 0; i < dependsOn.length; i++) {
            const field = getValues(dependsOn[i]);
            if (field !== undefined) {
                if (typeof field === "boolean") {
                    return field;
                } else if (field.toString().length > 0) {
                    return true;
                }
            }
        }

        return false;
    };

    const onSubmit = handleSubmit((data) => {
        dispatch(setConfiguration(data));
        window.scrollTo({ top: 0 });
        setCurrentSection(currentSection + 1);
    });

    const getHeadline = (name: string): string => {
        if (name.includes(".")) {
            if (name.split(".")[2]) {
                return name.split(".")[2];
            } else {
                return name.split(".")[1];
            }
        }

        return name;
    };

    const getFormField = (field: Field): React.ReactElement<any, any> => {
        const headline = getHeadline(field.name);

        if (field.type === FieldType.INPUT) {
            return (
                <Input
                    key={field.name}
                    field={field}
                    handleDependantFields={handleDependantFields}
                    errors={errors}
                    headline={headline}
                    register={register}
                    currentDriver={currentDriver}
                />
            );
        } else if (field.type === FieldType.CHECKBOX) {
            return (
                <Checkbox
                    key={field.name}
                    field={field}
                    handleDependantFields={handleDependantFields}
                    errors={errors}
                    headline={headline}
                    register={register}
                />
            );
        } else if (field.type === FieldType.HEADLINE) {
            return <Headline key={field.name} headline={headline} field={field} />;
        } else if (field.type === FieldType.DROPDOWN) {
            return (
                <Dropdown
                    key={field.name}
                    field={field}
                    handleDependantFields={handleDependantFields}
                    errors={errors}
                    headline={headline}
                    register={register}
                    setCurrentDriver={setCurrentDriver}
                />
            );
        } else {
            return <></>;
        }
    };

    const onButtonClick = (button: number, module: Module) => {
        setActiveModule(button);
        dispatch(setModule(module));
        window.localStorage.setItem("config", "");
        setCurrentSection(0);
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
            {sections.sections?.map(({ sectionFields, sectionName }, index) => {
                return (
                    <Section
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSubmit();
                        }}
                        key={`${index}__${sectionName?.name}`}
                        className={currentSection === index ? "active" : ""}
                        id={`section_${index}`}
                    >
                        <SectionHeadline>{sectionName ? sectionName.name : "General Settings"}</SectionHeadline>
                        {sectionFields.map((field) => {
                            if (field.driverConfig && field.driverConfig !== currentDriver) {
                                if (getValues(field.name)) {
                                    unregister(field.name);
                                }

                                return <></>;
                            }

                            return getFormField(field);
                        })}
                        <Buttons>
                            <Button
                                variant="contained"
                                disabled={currentSection === 0}
                                onClick={() => {
                                    window.scrollTo({ top: 0 });
                                    setCurrentSection(currentSection - 1);
                                }}
                            >
                                Back
                            </Button>
                            {currentSection < sections.sections!.length - 1 ? (
                                <Button
                                    variant="contained"
                                    disabled={currentSection === sections.sections!.length - 1}
                                    type="submit"
                                    form={`section_${index}`}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button onClick={() => downloadFile()} variant="contained" type="submit" form={`section_${index}`}>
                                    Download
                                </Button>
                            )}
                        </Buttons>
                    </Section>
                );
            })}
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

const Buttons = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    height: 70px;

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

const Section = styled.form`
    width: 60%;
    display: none;
    padding: 0 0 50px 0;

    &.active {
        display: initial;
    }
`;

const SectionHeadline = styled.h2`
    ${({ theme }) => theme.fonts.headline.section};
    color: ${({ theme }) => theme.palette.main};
`;
