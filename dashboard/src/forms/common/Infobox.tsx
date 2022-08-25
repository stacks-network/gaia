import styled from "styled-components";
import React from "react";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Button } from "@mui/material";

const Infobox: React.FC = () => {
    const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
    const [infoContent, setInfoContent] = React.useState<string>("");
    const COLLAPSE_CLASS = "collapse";

    const toggleConfig = () => {
        const config = window.localStorage.getItem("config");

        if (config) {
            setInfoContent(config);
        }

        const form = document.getElementById("form");
        const button = document.getElementById("gaia-menu-button");
        const info = document.getElementById("gaia-menu-info");

        if (form && button && info) {
            form.style.transform = `translateX(${!menuOpen ? "20vw" : "0"})`;

            if (button.classList.contains(COLLAPSE_CLASS) && info.classList.contains(COLLAPSE_CLASS)) {
                button.classList.remove(COLLAPSE_CLASS);
                info.classList.remove(COLLAPSE_CLASS);
            } else {
                button.classList.add(COLLAPSE_CLASS);
                info.classList.add(COLLAPSE_CLASS);
            }

            setMenuOpen(!menuOpen);
        }
    };

    return (
        <Container>
            <Info id="gaia-menu-info">
                <InfoContent>
                    <InfoHeadline>Your Gaia Hub Configuration</InfoHeadline>
                    <pre>{infoContent}</pre>
                    <Buttons>
                        <Button variant="contained">Copy</Button>
                        <Button variant="contained">Download</Button>
                    </Buttons>
                </InfoContent>
            </Info>
            <MenuButton id="gaia-menu-button">
                <div>
                    <GaiaMenu onClick={() => toggleConfig()} style={{ display: menuOpen ? "none" : "initial" }} />
                    <GaiaClose onClick={() => toggleConfig()} style={{ display: !menuOpen ? "none" : "initial" }} />
                </div>
            </MenuButton>
        </Container>
    );
};

export default Infobox;

const Info = styled.div`
    height: 100vh;
    background: ${({ theme }) => theme.palette.infoBackground};
    max-width: 0;
    min-width: 0;
    transition: max-width 1s ease, min-width 1s ease;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    &.collapse {
        max-width: 30vw !important;
        min-width: 30vw !important;
    }
`;

const InfoContent = styled.div`
    height: 95%;
    width: 80%;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    overflow-y: scroll;
    position: relative;

    pre {
        margin: 10px;
    }

    ::-webkit-scrollbar {
        display: none;
    }
`;

const Buttons = styled.div`
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    min-width: 20vw;
    height: 70px;

    button {
        height: 45px;
        width: 100px;

        :not(:disabled) {
            background-color: ${({ theme }) => theme.palette.main} !important;

            &:nth-child(2) {
                background-color: ${({ theme }) => theme.palette.yellow} !important;
                color: ${({ theme }) => theme.palette.main} !important;
            }
        }

        :disabled {
            background-color: ${({ theme }) => theme.palette.darkGrey} !important;
        }
    }
`;

const InfoHeadline = styled.h3`
    min-width: 30vw;
    margin: 10px;
    color: ${({ theme }) => theme.palette.main};
    ${({ theme }) => theme.fonts.headline.label};
`;

const Container = styled.div`
    grid-column: 1 / span 2;
    position: fixed;
    height: 100vh;
    display: flex;
    flex-direction: row;
    align-items: center;
    z-index: 60;
`;

const MenuButton = styled.button`
    all: unset;
    min-height: 99vh;
    background: ${({ theme }) => theme.palette.yellow};
    min-width: 100px;
    border-radius: 10px;
    margin-left: 10px;
    margin-top: 0.5vh;
    text-align: center;
    transition: min-height 1s ease, min-width 1s ease, transform 1s ease;

    &.collapse {
        min-height: 0vh !important;
        min-width: 0 !important;
        height: 40px;
        padding: 10px;
        transform: translateX(-40px);
    }
`;

const GaiaMenu = styled(MenuIcon)`
    font-size: 40px !important;
    color: ${({ theme }) => theme.palette.main} !important;
`;

const GaiaClose = styled(CloseIcon)`
    font-size: 40px !important;
    color: ${({ theme }) => theme.palette.main} !important;
`;
