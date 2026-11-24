import { mkdir, readdir, rm, writeFile } from "node:fs/promises";

const resRoot = "android/app/src/main/res";
const background = "#090812";

// Vector version of the selected sixth CAESH concept: a geometric C with
// two centered ledger/card lines. Keeping it vector-based avoids AAPT2 PNG
// decoding/compilation problems and scales cleanly at every launcher size.
const mark = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="432"
    android:viewportHeight="432">
    <path
        android:fillColor="#A979FF"
        android:pathData="M300,82 C270,55 235,42 195,42 C101,42 38,114 38,216 C38,318 108,390 202,390 C244,390 281,376 310,349 L270,309 C251,326 229,335 203,335 C139,335 94,287 94,216 C94,147 140,97 202,97 C229,97 251,107 269,124 Z" />
    <path
        android:fillColor="#7431E8"
        android:pathData="M94,216 C94,287 139,335 203,335 C229,335 251,326 270,309 L310,349 C281,376 244,390 202,390 C108,390 38,318 38,216 C38,202 39,188 42,175 C49,244 101,292 171,300 C211,305 247,292 278,270 L310,349 C281,376 244,390 202,390 C108,390 38,318 38,216 Z" />
    <path
        android:fillColor="#D5BEFF"
        android:pathData="M181,169 H304 C313,169 320,176 320,185 V202 C320,211 313,218 304,218 H181 Z" />
    <path
        android:fillColor="#9A65F5"
        android:pathData="M181,235 H304 C313,235 320,242 320,251 V269 C320,278 313,285 304,285 H197 C188,285 181,278 181,269 Z" />
</vector>
`;

const iconFiles = ["ic_launcher.png", "ic_launcher.webp", "ic_launcher.xml", "ic_launcher_round.png", "ic_launcher_round.webp", "ic_launcher_round.xml"];
for (const entry of await readdir(resRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^mipmap(?:-.+)?$/.test(entry.name)) continue;
  const dirPath = `${resRoot}/${entry.name}`;
  for (const file of await readdir(dirPath)) {
    if (iconFiles.includes(file)) await rm(`${dirPath}/${file}`, { force: true });
  }
}

const mipmapDir = `${resRoot}/mipmap-nodpi`;
const adaptiveDir = `${resRoot}/mipmap-anydpi-v26`;
const foregroundDir = `${resRoot}/drawable-nodpi`;
const valuesDir = `${resRoot}/values`;
await Promise.all([mipmapDir, adaptiveDir, foregroundDir, valuesDir].map((dir) => mkdir(dir, { recursive: true })));

await writeFile(`${mipmapDir}/ic_launcher.xml`, mark);
await writeFile(`${mipmapDir}/ic_launcher_round.xml`, mark);
await writeFile(`${foregroundDir}/ic_caesh_launcher_foreground.xml`, mark);

const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/caesh_icon_background" />
    <foreground android:drawable="@drawable/ic_caesh_launcher_foreground" />
</adaptive-icon>
`;
await writeFile(`${adaptiveDir}/ic_launcher.xml`, adaptiveIcon);
await writeFile(`${adaptiveDir}/ic_launcher_round.xml`, adaptiveIcon);
await writeFile(`${valuesDir}/caesh_icon.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="caesh_icon_background">${background}</color>
</resources>
`);

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let androidManifest = await readFile(manifestPath, "utf8");
const appMatch = androidManifest.match(/<application\b[^>]*>/s);
if (!appMatch) throw new Error("AndroidManifest.xml application element not found.");
let appTag = appMatch[0];
for (const [name, value] of [["android:icon", "@mipmap/ic_launcher"], ["android:roundIcon", "@mipmap/ic_launcher_round"]]) {
  const attribute = name.replace(":", "\\:");
  const pattern = new RegExp("\\s" + attribute + '="[^"]*"');
  appTag = pattern.test(appTag)
    ? appTag.replace(pattern, " " + name + '="' + value + '"')
    : appTag.replace(/>$/, " " + name + '="' + value + '">');
}
androidManifest = androidManifest.replace(appMatch[0], appTag);
await writeFile(manifestPath, androidManifest);

console.log("Configured CAESH Android launcher icon from the sixth option using vector resources.");
