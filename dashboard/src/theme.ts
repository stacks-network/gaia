import { css, FlattenInterpolation, ThemeProps } from "styled-components/macro";

interface Breakpoints {
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

interface Palette {
  white: string;
  black: string;
  grey: string;
  main: string;
  yellow: string;
  darkGrey: string;
  infoBackground: string;
  success: string;
}

interface Fonts {
  headline: {
    main: FlattenInterpolation<ThemeProps<unknown>>;
    label: FlattenInterpolation<ThemeProps<unknown>>;
    section: FlattenInterpolation<ThemeProps<unknown>>;
  };
  paragraph: FlattenInterpolation<ThemeProps<unknown>>;
}

interface Theme {
  breakpoints: Breakpoints;
  palette: Palette;
  fonts: Fonts;
}

const breakpoints: Breakpoints = {
  sm: 600,
  md: 1200,
  lg: 1460,
  xl: 1600,
};

const theme: Theme = {
  breakpoints,
  palette: {
    white: "#FFFFFF",
    black: "#000000",
    grey: "#F8F8F8",
    main: "#27277A",
    yellow: "#FFD99C",
    darkGrey: "#c0bcbc",
    infoBackground: "#F3F3FE",
    success: "#4BB543",
  },
  fonts: {
    headline: {
      main: css`
        font-size: 38px;
        line-height: 45px;
        font-weight: 700;
      `,
      label: css`
        font-size: 20px;
        line-height: 22px;
      `,
      section: css`
        font-size: 50px;
        line-height: 55px;
        font-weight: 700;
      `,
    },
    paragraph: css`
      font-size: 12px;
      line-height: 18px;
    `,
  },
};

export default theme;
