module.exports = {
  "extends": [
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "tsconfigRootDir": __dirname,
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "env": {
    "browser": false,
    "node": true,
    "es6": true
  },
  "rules": {
    "comma-dangle": ["error", "never"],
    "quotes": [2, "single"],
    "eol-last": 2,
    "no-debugger": 1,
    "no-mixed-requires": 0,
    "no-underscore-dangle": 0,
    "no-multi-spaces": 0,
    "no-trailing-spaces": 0,
    "no-extra-boolean-cast": 0,
    "no-undef": 2,
    "no-var": 2,
    "no-param-reassign": 0,
    "no-else-return": 0,
    "no-console": 0,
    "prefer-const": 2,
    "new-cap": 0,
    "brace-style": 2,
    "semi": [2, "never"],
    "valid-jsdoc": ["error"],

    "@typescript-eslint/indent": [2, 2, {
      "FunctionDeclaration": { "parameters": "first" },
      "FunctionExpression": { "parameters": "first" },
      "ObjectExpression": "first",
      "ArrayExpression": "first",
      "ImportDeclaration": "first",
      "CallExpression": { "arguments": "first" }
    }],

    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/class-name-casing": "off",
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/member-delimiter-style": "off",
    "@typescript-eslint/no-angle-bracket-type-assertion": "off",
    "@typescript-eslint/prefer-interface": "off",
    "@typescript-eslint/no-use-before-define": "off",

    // TODO: enable this when reasonable
    "@typescript-eslint/no-explicit-any": "off",
  }
};
