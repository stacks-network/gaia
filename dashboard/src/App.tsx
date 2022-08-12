import React from "react";
import logo from "./logo.svg";
import "./App.css";
import Admin from "./forms/Admin";
import styled from "styled-components";

function App() {
    return (
        <div className="App">
            <Grid>
                <Admin />
            </Grid>
        </div>
    );
}

export default App;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(24, 1fr);
`;
