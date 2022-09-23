import "./App.css";
import { hubConfig } from "./forms/types/FormConfiguration";
import styled from "styled-components";
import ConfigForm from "./forms/ConfigForm";
import Infobox from "./forms/common/Infobox";

function App() {
    return (
        <Grid>
            <Infobox />
            <ConfigForm sections={hubConfig} />
        </Grid>
    );
}

export default App;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(24, 1fr);
    overflow: hidden;
`;
