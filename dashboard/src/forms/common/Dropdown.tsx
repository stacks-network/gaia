import { Container, Error, FormInputBody, LabelHeadline } from "./common.styled";
import { FormControl, MenuItem, Select } from "@mui/material";
import { FormFieldProps } from "../types/FormFieldProps";
import { ErrorMessage } from "@hookform/error-message";
import { FieldName } from "../types/Fieldnames";

interface DropdownProps {
    setCurrentDriver: Function;
}

const Dropdown: React.FC<FormFieldProps & DropdownProps> = ({ headline, field, handleDependantFields, errors, register, setCurrentDriver }) => {
    return (
        <Container>
            <FormInputBody>
                <LabelHeadline>{headline}</LabelHeadline>
                <ErrorMessage errors={errors} name={field.name} render={() => <Error>This Field is required</Error>} />
            </FormInputBody>{" "}
            <ErrorMessage errors={errors} name={field.name} render={() => <p>This Field is required</p>} />
            <FormControl fullWidth>
                <Select
                    labelId={`${field.name}_dropdown`}
                    {...register(field.name, {
                        required: field.required,
                        validate: (value: string) => (field.dependsOn && handleDependantFields(field.dependsOn) && value ? value.length > 0 : true),
                    })}
                    onChange={(event) => {
                        if (field.name === FieldName.DRIVER) {
                            setCurrentDriver(event.target.value);
                        }
                    }}
                    defaultValue={field.values && field.values[0]}
                >
                    {field.values?.map((val, index) => (
                        <MenuItem key={val} value={val}>
                            {val}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Container>
    );
};

export default Dropdown;
