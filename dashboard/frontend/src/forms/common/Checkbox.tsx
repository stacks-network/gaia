import { Description, Error, FormInputBody, FormInputContainer, LabelHeadline } from "forms/common/common.styled";
import { Checkbox as MUICheckbox } from "@mui/material";
import { FormFieldProps } from "forms/types/FormFieldProps";
import { ErrorMessage } from "@hookform/error-message";

const Checkbox: React.FC<FormFieldProps> = ({ headline, field, handleDependantFields, errors, register }) => {
    return (
        <FormInputContainer>
            <FormInputBody>
                <LabelHeadline>{headline}</LabelHeadline>
                <ErrorMessage errors={errors} name={field.name} render={() => <Error>* This Field is required</Error>} />
            </FormInputBody>{" "}
            <FormInputBody>
                <MUICheckbox
                    defaultChecked={field.defaultValue}
                    defaultValue={field.defaultValue}
                    disabled={field.disabled}
                    id={`${field.name}_checkbox`}
                    {...register(field.name, {
                        validate: (value: boolean) => (field.dependsOn && handleDependantFields(field.dependsOn) ? value === true : true),
                    })}
                />
                <Description htmlFor={`${field.name}_checkbox`}>{field.description}</Description>
            </FormInputBody>
        </FormInputContainer>
    );
};

export default Checkbox;
