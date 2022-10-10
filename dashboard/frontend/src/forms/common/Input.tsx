import { Container, Description, Error, FormInputBody, LabelHeadline } from "forms/common/common.styled";
import { TextField } from "@mui/material";
import { FormFieldProps } from "forms/types/FormFieldProps";
import styled from "styled-components";
import { ErrorMessage } from "@hookform/error-message";

const Input: React.FC<FormFieldProps> = ({ headline, field, handleDependantFields, currentDriver, errors, register }) => {
    return (
        <Container>
            <FormInputBody>
                <LabelHeadline>{headline}</LabelHeadline>
                <ErrorMessage errors={errors} name={field.name} render={() => <Error>* This Field is required</Error>} />
            </FormInputBody>
            <Description htmlFor={`${field.name}_input`}>{field.description}</Description>
            <CustomTextField
                defaultValue={field.defaultValue}
                disabled={field.disabled}
                id={`${field.name}_input`}
                label={"Type here"}
                {...register(field.name, {
                    required: field.required,
                    validate: (value: string) =>
                        (field.dependsOn && handleDependantFields(field.dependsOn)) || (field.driverConfig && field.driverConfig === currentDriver)
                            ? value.length > 0
                            : true,
                })}
                variant={"outlined"}
            />
        </Container>
    );
};

export default Input;

export const CustomTextField = styled(TextField)`
    width: 100%;
    margin: 20px 0 !important;
`;
