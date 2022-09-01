import styled from "styled-components";
import React from "react";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Button, SelectChangeEvent } from "@mui/material";
import Configuration, { Config, ConfigurationFormat } from "../../configuration/Configuration";
import { MenuItem, Select } from "@mui/material";

const Infobox: React.FC = () => {
    const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
    const [configuration, setConfiguration] = React.useState<Configuration>();
    const [copied, setCopied] = React.useState<boolean>(false);
    const [infoContent, setInfoContent] = React.useState<string>("");
    const [fileFormat, setFileFormat] = React.useState<ConfigurationFormat>(ConfigurationFormat.TOML);
    const COLLAPSE_CLASS = "collapse";

    const toggleConfig = () => {
        const config = window.localStorage.getItem("config");

        if (config && config.length > 0) {
            const conf = new Configuration(JSON.parse(config) as Config);
            setConfiguration(conf);
            const tomlConfig = conf?.toTOML();
            if (tomlConfig) {
                setInfoContent(tomlConfig);
            }
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

    const copyToClipboard = () => {
        if (!configuration) return;
        window.navigator.clipboard.writeText(configuration?.toTOML());
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 5000);
    };

    const handleToTOML = () => {
        const tomlConfig = configuration?.toTOML();

        if (tomlConfig) {
            setInfoContent(tomlConfig);
        }
    };

    const handleDropdown = (event: SelectChangeEvent<ConfigurationFormat>) => {
        if (event.target.value === ConfigurationFormat.JSON) {
            setInfoContent(JSON.stringify(configuration?.config, null, 2));
            setFileFormat(ConfigurationFormat.JSON);
        } else {
            handleToTOML();
            setFileFormat(ConfigurationFormat.TOML);
        }
    };

    const downloadFile = () => {
        let module = window.localStorage.get("module");
        const anchor = window.document.createElement("a");
        if (!module) {
            module = "hub";
        }

        let blob = configuration?.exportToTOML();

        if (fileFormat === ConfigurationFormat.JSON) {
            blob = configuration?.exportToJSON();
        }

        console.log(blob);

        if (!blob) {
            return;
        }

        anchor.href = window.URL.createObjectURL(blob);
        anchor.download = `${module}_configuration.${fileFormat.toLowerCase()}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(anchor.href);
    };

    return (
        <Container>
            <Info id="gaia-menu-info">
                <InfoContent>
                    <HeadlineContainer>
                        <InfoHeadline>Your Gaia Hub Configuration</InfoHeadline>
                        <Select labelId={`format_dropdown`} onChange={(event) => handleDropdown(event)} defaultValue={ConfigurationFormat.TOML}>
                            <MenuItem key={ConfigurationFormat.TOML} value={ConfigurationFormat.TOML}>
                                {ConfigurationFormat.TOML}
                            </MenuItem>
                            <MenuItem key={ConfigurationFormat.JSON} value={ConfigurationFormat.JSON}>
                                {ConfigurationFormat.JSON}
                            </MenuItem>
                        </Select>
                    </HeadlineContainer>
                    <pre>{infoContent}</pre>
                    <Buttons>
                        <Button variant="contained" className={`${copied ? "copied" : ""}`} onClick={copyToClipboard}>
                            {copied ? "Copied" : "Copy"}
                        </Button>
                        <Button variant="contained" onClick={() => downloadFile()}>
                            Download
                        </Button>
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

        &.copied {
            background-color: ${({ theme }) => theme.palette.success} !important;
        }
    }
`;

const InfoHeadline = styled.h3`
    min-width: 15vw;
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
    cursor: pointer;
    font-size: 40px !important;
    color: ${({ theme }) => theme.palette.main} !important;
`;

const GaiaClose = styled(CloseIcon)`
    cursor: pointer;
    font-size: 40px !important;
    color: ${({ theme }) => theme.palette.main} !important;
`;

const HeadlineContainer = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin: 10px;
`;
