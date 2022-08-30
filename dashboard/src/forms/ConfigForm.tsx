import React from "react";
import { useForm } from "react-hook-form";
import { Config, Drivers } from "../configuration/Configuration";
import styled from "styled-components";
import { FieldName } from "./types/Fieldnames";
import { FormConfiguration } from "./types/FormConfiguration";
import Checkbox from "./common/Checkbox";
import Input from "./common/Input";
import Headline from "./common/Headline";
import Dropdown from "./common/Dropdown";
import { Button } from "@mui/material";

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
        watch,
        handleSubmit,
        formState: { errors },
    } = useForm<Config>();

    const [currentDriver, setCurrentDriver] = React.useState<Drivers>(Drivers.AWS);
    const [currentSection, setCurrentSection] = React.useState<number>(0);
    const [formHeight, setFormHeight] = React.useState<number>(0);

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
        window.localStorage.setItem("config", JSON.stringify(data, null, 2));
        window.scrollTo({ top: 0 });
        setFormHeight(getSectionHeight(currentSection + 1));
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

    const getSectionHeight = (index: number = 0): number => {
        const section = document.getElementById(`section_${index}`);

        return section!.scrollHeight + 50;
    };

    React.useEffect(() => {
        setFormHeight(getSectionHeight());
    }, [currentDriver]);

    return (
        <Container style={{ height: formHeight }} id="form">
            {sections.sections?.map(({ sectionFields, sectionName }, index) => {
                return (
                    <Section
                        onSubmit={(e) => {
                            e.preventDefault();
                            onSubmit();
                        }}
                        key={`${index}__${sectionName?.name}`}
                        className={currentSection === index ? "active" : currentSection > index ? "prev" : "next"}
                        id={`section_${index}`}
                    >
                        <SectionHeadline>{sectionName ? sectionName.name : "General Settings"}</SectionHeadline>
                        {sectionFields.map((field) => {
                            field.dependsOn?.forEach((item) => watch(item));

                            if (field.driverConfig && field.driverConfig !== currentDriver) {
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
                                    setFormHeight(getSectionHeight(currentSection - 1));
                                    setCurrentSection(currentSection - 1);
                                }}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                disabled={currentSection === sections.sections!.length - 1}
                                type="submit"
                                form={`section_${index}`}
                            >
                                Next
                            </Button>
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
    transition: 1.5s ease transform;
    top: 0;
    width: 60%;
    position: absolute;

    &.active {
        transform: translateX(0);
    }

    &.prev {
        transform: translateX(-100vw);
    }

    &.next {
        transform: translateX(100vw);
    }
`;

const SectionHeadline = styled.h2`
    ${({ theme }) => theme.fonts.headline.section};
    color: ${({ theme }) => theme.palette.main};
`;
