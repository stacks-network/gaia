import { Button } from "@mui/material";
import { Config, Drivers } from "configuration/Configuration";
import { Buttons, Field, FieldType, Section } from "forms/ConfigForm";
import { FieldName } from "forms/types/Fieldnames";
import React from "react";
import { useForm } from "react-hook-form";
import { useAppDispatch, useAppSelector } from "redux/hooks";
import { setConfiguration, setCurrentSection } from "redux/hooks/dashboard/dashboardSlice";
import styled from "styled-components";
import Checkbox from "./Checkbox";
import Dropdown from "./Dropdown";
import Headline from "./Headline";
import Input from "./Input";

interface FormStepProps {
    index: number;
    sectionFields: Field[];
    sectionName?: Field;
}

const FormStep: React.FC<FormStepProps> = ({ sectionName, sectionFields, index }) => {
    const {
        register,
        getValues,
        handleSubmit,
        unregister,
        formState: { errors },
    } = useForm<Config>();
    const [currentDriver, setCurrentDriver] = React.useState<Drivers>(Drivers.AWS);
    const currentSection = useAppSelector((state) => state.dashboard.currentSection);
    const dispatch = useAppDispatch();

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
        console.log(data);
        dispatch(setConfiguration(data));
        window.scrollTo({ top: 0 });
        dispatch(setCurrentSection(1));
    });

    const getHeadline = (name: string): string => {
        if (name.includes(".")) {
            if (name.split(".")[2]) {
                return name.split(".")[2];
            } else if (name.split(".")[1]) {
                if (name.split(".")[1] !== "items") {
                    return name.split(".")[1];
                } else {
                    return name.split(".")[0];
                }
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
                        dispatch(setCurrentSection(1));
                    }}
                >
                    Back
                </Button>
                <Button variant="contained" type="submit" form={`section_${index}`}>
                    Next
                </Button>
            </Buttons>
        </Section>
    );
};

export default FormStep;

const SectionHeadline = styled.h2`
    ${({ theme }) => theme.fonts.headline.section};
    color: ${({ theme }) => theme.palette.main};
`;
