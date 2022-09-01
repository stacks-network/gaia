import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import StageBackground from "assets/background.png";
import Stacks from "assets/stacks.png";

const Landing: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Container>
            <Stage>
                <StacksLogo src={Stacks} alt="Stacks" />
            </Stage>
            <Content>
                <Headline>Welcome to the GAIA Hub Configurator</Headline>
                <Description>
                    The GAIA Dashboard is a feature that we are excited to introduce. This dashboard will be used, to create a visually guided
                    experience for new users to host their own GAIA hub.
                    <br /> <br />
                    We want to make the GAIA Storage System accessible and affordable to everyone. That is why we created this dashboard, which guides
                    you through the entire set-up process and makes sure that everything works smoothly.
                </Description>
                <Button variant="contained" onClick={() => navigate("/configurator")}>
                    Start {">"}
                </Button>
            </Content>
        </Container>
    );
};

export default Landing;

const Container = styled.div`
    display: grid;
    grid-template-columns: repeat(24, 1fr);
`;

const Content = styled.div`
    grid-column: 5 / 21;
    margin-top: 50px;

    button {
        margin-top: 50px;
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

const Headline = styled.h1`
    color: ${({ theme }) => theme.palette.main};
    ${({ theme }) => theme.fonts.headline.main};
    font-weight: bold;
    width: 100%;
`;

const Description = styled.p`
    ${({ theme }) => theme.fonts.headline.label};
    width: 80%;
`;

const Stage = styled.div`
    grid-column: 1 / span 24;
    height: 30vh;
    background: url(${StageBackground});
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    position: relative;
`;

const StacksLogo = styled.img`
    background: ${({ theme }) => theme.palette.white};
    border-radius: 50%;
    padding: 10px;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: -35px;
`;
