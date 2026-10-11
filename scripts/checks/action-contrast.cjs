const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('src/app/globals.css', 'utf8');
const tokens = block => Object.fromEntries([...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
const base = tokens(css.match(/:root\s*\{([^}]+)\}/)[1]);
const light = { ...base, ...tokens(css.match(/html\.light\s*\{([^}]+)\}/)[1]) };
function resolve(value, theme) {
  const variable = value.match(/^var\(--([\w-]+)\)$/);
  return variable ? resolve(theme[variable[1]], theme) : value;
}
function luminance(hex) {
  hex = hex.slice(1);
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const [name, theme] of [['dark', base], ['light', light]]) {
  const foreground = luminance(resolve(theme['on-action'], theme));
  const background = luminance(resolve(theme.action, theme));
  const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  assert.ok(ratio >= 4.5, `${name} action text contrast is ${ratio.toFixed(2)}:1`);
  console.log(`${name} action text contrast: ${ratio.toFixed(2)}:1`);
}
