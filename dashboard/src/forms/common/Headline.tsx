import styled from "styled-components";
import { Field } from "forms/ConfigForm";
import { Container, Description } from "forms/common/common.styled";

interface HeadlineProps {
    field: Field;
    headline: string;
}

const Headline: React.FC<HeadlineProps> = ({ field, headline }) => {
    return (
        <Container>
            <H2>{headline}</H2>
            <Description>{field.description}</Description>
        </Container>
    );
};

export default Headline;

const H2 = styled.h2`
    ${({ theme }) => theme.fonts.headline.main};
    color: ${({ theme }) => theme.palette.main};
`;
