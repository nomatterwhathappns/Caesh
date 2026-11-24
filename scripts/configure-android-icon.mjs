import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const resRoot = "android/app/src/main/res";
const iconBytes = await readFile("assets/caesh-icon-option-6.png");
const background = "#090812";

// Remove generated or previous CAESH launcher icon variants so Android cannot
// accidentally select an older resource from another density bucket.
for (const directory of ["mipmap", "mipmap-anydpi-v26", "mipmap-nodpi"]) {
  const dirPath = `${resRoot}/${directory}`;
  try {
    for (const entry of await readdir(dirPath)) {
      if (/^ic_launcher(?:_round)?\.(?:xml|png|webp)$/i.test(entry)) {
        await rm(`${dirPath}/${entry}`, { force: true });
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const mipmapDir = `${resRoot}/mipmap-nodpi`;
const adaptiveDir = `${resRoot}/mipmap-anydpi-v26`;
const foregroundDir = `${resRoot}/drawable-nodpi`;
const valuesDir = `${resRoot}/values`;
await Promise.all([mipmapDir, adaptiveDir, foregroundDir, valuesDir].map((dir) => mkdir(dir, { recursive: true })));

await writeFile(`${mipmapDir}/ic_launcher.png`, iconBytes);
await writeFile(`${mipmapDir}/ic_launcher_round.png`, iconBytes);
await writeFile(`${foregroundDir}/ic_caesh_launcher_foreground.png`, iconBytes);

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

console.log("Configured CAESH Android launcher icon from option 6.");
