import "./App.css";
import Form from "./forms/Form";
import styled from "styled-components";

function App() {
    return (
        <Grid>
            <Form />
        </Grid>
    );
}

export default App;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(24, 1fr);
`;
