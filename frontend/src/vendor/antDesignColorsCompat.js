export * from "@ant-design/colors/dist/index.esm.js";

import { generate, presetPrimaryColors } from "@ant-design/colors/dist/index.esm.js";

const makeColorPalette = (name, fallbackPrimary) => {
  const primary = presetPrimaryColors[name] || fallbackPrimary;
  const palette = generate(primary);
  palette.primary = primary;
  return palette;
};

export const blue = makeColorPalette("blue", "#1890ff");
export const purple = makeColorPalette("purple", "#722ed1");
export const cyan = makeColorPalette("cyan", "#13c2c2");
export const green = makeColorPalette("green", "#52c41a");
export const magenta = makeColorPalette("magenta", "#eb2f96");
export const pink = magenta;
export const red = makeColorPalette("red", "#f5222d");
export const orange = makeColorPalette("orange", "#fa8c16");
export const yellow = makeColorPalette("yellow", "#fadb14");
export const volcano = makeColorPalette("volcano", "#fa541c");
export const geekblue = makeColorPalette("geekblue", "#2f54eb");
export const gold = makeColorPalette("gold", "#faad14");
export const lime = makeColorPalette("lime", "#a0d911");
