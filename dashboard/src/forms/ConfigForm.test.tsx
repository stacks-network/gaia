import React from "react";
import { render, screen } from "@testing-library/react";
import ConfigForm, { FieldType } from "./ConfigForm";
import { FormConfiguration } from "./types/FormConfiguration";
import { FieldName } from "./types/Fieldnames";
import { Drivers } from "../configuration/Configuration";
import { ThemeProvider } from "styled-components";
import theme from "../theme";

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

test("renders dropdown component", () => {
    const sections: FormConfiguration = {
        sections: [
            {
                sectionFields: [
                    {
                        type: FieldType.DROPDOWN,
                        name: FieldName.DRIVER,
                        values: Object.keys(Drivers).map((key: string) => Drivers[key as keyof typeof Drivers]),
                        required: true,
                    },
                ],
            },
        ],
    };

    render(
        <ThemeProvider theme={theme}>
            <ConfigForm sections={sections} />
        </ThemeProvider>,
    );

    const dropdownElement = screen.getByText(getHeadline(FieldName.DRIVER));
    expect(dropdownElement).toBeInTheDocument();
});

test("renders input component", () => {
    const sections: FormConfiguration = {
        sections: [
            {
                sectionFields: [
                    {
                        type: FieldType.INPUT,
                        name: FieldName.ACME_CONFIG_CONFIG_DIR,
                    },
                ],
            },
        ],
    };

    render(
        <ThemeProvider theme={theme}>
            <ConfigForm sections={sections} />
        </ThemeProvider>,
    );

    const inputElement = screen.getByText(getHeadline(FieldName.ACME_CONFIG_CONFIG_DIR));
    expect(inputElement).toBeInTheDocument();
});

test("renders checkbox component", () => {
    const sections: FormConfiguration = {
        sections: [
            {
                sectionFields: [
                    {
                        type: FieldType.CHECKBOX,
                        name: FieldName.ARGS_TRANSPORT_JSON,
                    },
                ],
            },
        ],
    };

    render(
        <ThemeProvider theme={theme}>
            <ConfigForm sections={sections} />
        </ThemeProvider>,
    );

    const checkboxElement = screen.getByText(getHeadline(FieldName.ARGS_TRANSPORT_JSON));
    expect(checkboxElement).toBeInTheDocument();
});
