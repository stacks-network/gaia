import { Description, FormInputBody, FormInputContainer, LabelHeadline } from "./common.styled";
import { Checkbox as MUICheckbox } from "@mui/material";
import { FormFieldProps } from "../types/FormFieldProps";
import { ErrorMessage } from "@hookform/error-message";

const Checkbox: React.FC<FormFieldProps> = ({ headline, field, handleDependantFields, errors, register }) => {
    return (
        <FormInputContainer>
            <LabelHeadline>{headline}</LabelHeadline>
            <ErrorMessage errors={errors} name={field.name} render={() => <p>This Field is required</p>} />
            <FormInputBody>
                <MUICheckbox
                    id={`${field.name}_checkbox`}
                    {...register(field.name, {
                        required: field.required,
                        validate: (value: boolean) => (field.dependsOn && handleDependantFields(field.dependsOn) ? value === true : true),
                    })}
                />
                <Description htmlFor={`${field.name}_checkbox`}>{field.description}</Description>
            </FormInputBody>
        </FormInputContainer>
    );
};

export default Checkbox;
