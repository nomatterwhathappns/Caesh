import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const resRoot = "android/app/src/main/res";
const source = "caesh-icon.png";

// Preserve the uploaded PNG artwork: no redraw, recolor, crop, or stretching.
// The same square source is used for legacy launchers and the adaptive foreground.
const mipmapDir = `${resRoot}/mipmap-nodpi`;
const adaptiveDir = `${resRoot}/mipmap-anydpi-v26`;
const foregroundDir = `${resRoot}/drawable-nodpi`;
const valuesDir = `${resRoot}/values`;

for (const entry of await readdir(resRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^mipmap(?:-.+)?$/.test(entry.name)) continue;
  const dir = `${resRoot}/${entry.name}`;
  for (const file of await readdir(dir)) {
    if (/^ic_launcher(?:_round)?\.(png|webp|xml)$/.test(file)) {
      await rm(`${dir}/${file}`, { force: true });
    }
  }
}

await Promise.all([mipmapDir, adaptiveDir, foregroundDir, valuesDir].map((dir) => mkdir(dir, { recursive: true })));
await copyFile(source, `${mipmapDir}/ic_launcher.png`);
await copyFile(source, `${mipmapDir}/ic_launcher_round.png`);
await copyFile(source, `${foregroundDir}/ic_caesh_launcher_foreground.png`);

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
    <color name="caesh_icon_background">#ffffff</color>
</resources>
`);

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");
const match = manifest.match(/<application\b[^>]*>/s);
if (!match) throw new Error("AndroidManifest.xml application element not found.");
let appTag = match[0];
for (const [name, value] of [["android:icon", "@mipmap/ic_launcher"], ["android:roundIcon", "@mipmap/ic_launcher_round"]]) {
  const escaped = name.replace(":", "\\:");
  const pattern = new RegExp("\\s" + escaped + '="[^"]*"');
  appTag = pattern.test(appTag)
    ? appTag.replace(pattern, " " + name + '="' + value + '"')
    : appTag.replace(/>$/, " " + name + '="' + value + '">');
}
manifest = manifest.replace(match[0], appTag);
await writeFile(manifestPath, manifest);
console.log("Configured CAESH launcher icons from the original caesh-icon.png.");
