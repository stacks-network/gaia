import styled from "styled-components";

export const Container = styled.div`
    margin: 20px 0;
`;

export const FormInputContainer = styled.div`
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.palette.grey};
    padding: 40px 30px;
    margin: 20px 0;
`;

export const FormInputBody = styled.span`
    display: flex;
    align-items: center;
    flex-direction: row;
`;

export const LabelHeadline = styled.h2`
    ${({ theme }) => theme.fonts.headline.label};
    color: ${({ theme }) => theme.palette.black};
`;

export const Description = styled.label`
    cursor: pointer;
    color: ${({ theme }) => theme.palette.black};
    margin: 0;
    ${({ theme }) => theme.fonts.paragraph};
`;

export const Error = styled.span`
    padding-left: 10px;
`;
