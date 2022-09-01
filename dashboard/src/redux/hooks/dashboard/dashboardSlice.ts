import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import Configuration from "../../../configuration/Configuration";
import { Module } from "../../../forms/types/FormFieldProps";
import type { RootState } from "../../store";

// Define a type for the slice state
interface DashboardState {
  module: Module;
  configuration: Configuration | undefined;
}

// Define the initial state using that type
const initialState: DashboardState = {
  module: Module.HUB,
  configuration: undefined,
};

export const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setModule: (state, action: PayloadAction<Module>) => {
      state.module = action.payload;
    },
    setConfiguration: (state, action: PayloadAction<any>) => {
      Object.assign(action.payload, state.configuration);
    },
  },
});

export const { setModule, setConfiguration } = dashboardSlice.actions;

export const selectModule = (state: RootState) => state.dashboard.module;
export const selectConfiguration = (state: RootState) =>
  state.dashboard.configuration;

export default dashboardSlice.reducer;
