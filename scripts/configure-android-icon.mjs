import { mkdir, readFile, writeFile } from "node:fs/promises";

const resRoot = "android/app/src/main/res";
const background = "#090812";
const foregroundPaths = [
  '<path android:fillColor="#F8F6FF" android:pathData="M300,82 C270,55 235,42 195,42 C101,42 38,114 38,216 C38,318 108,390 202,390 C244,390 281,376 310,349 L270,309 C251,326 229,335 203,335 C139,335 94,287 94,216 C94,147 140,97 202,97 C229,97 251,107 269,124 Z" />',
  '<path android:fillColor="#B997F8" android:pathData="M94,216 C94,287 139,335 203,335 C229,335 251,326 270,309 L310,349 C281,376 244,390 202,390 C108,390 38,318 38,216 Z" />',
  '<path android:fillColor="#8745F5" android:pathData="M248,172 H344 C354,172 362,180 362,190 V260 C362,270 354,278 344,278 H248 C238,278 230,270 230,260 V190 C230,180 238,172 248,172 Z" />',
  '<path android:fillColor="#090812" android:pathData="M270,203 A11,11 0 1,0 270,225 A11,11 0 1,0 270,203 Z" />'
].join("\n");

function vector(includeBackground, adaptiveForeground) {
  const bg = includeBackground
    ? '<path android:fillColor="' + background + '" android:pathData="M0,0 H432 V432 H0 Z" />'
    : "";
  const paths = adaptiveForeground
    ? '<group android:scaleX="0.78" android:scaleY="0.78" android:translateX="47" android:translateY="47">' + foregroundPaths + '</group>'
    : foregroundPaths;
  return '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="432" android:viewportHeight="432">\n' +
    bg + '\n' + paths + '\n</vector>\n';
}

await mkdir(resRoot + "/mipmap", { recursive: true });
await mkdir(resRoot + "/mipmap-anydpi-v26", { recursive: true });
await mkdir(resRoot + "/drawable", { recursive: true });
await mkdir(resRoot + "/values", { recursive: true });

await writeFile(resRoot + "/mipmap/ic_launcher.xml", vector(true, false));
await writeFile(resRoot + "/mipmap/ic_launcher_round.xml", vector(true, false));
await writeFile(resRoot + "/drawable/ic_caesh_launcher_foreground.xml", vector(false, true));

const adaptiveIcon = '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '    <background android:drawable="@color/caesh_icon_background" />\n' +
  '    <foreground android:drawable="@drawable/ic_caesh_launcher_foreground" />\n' +
  '</adaptive-icon>\n';
await writeFile(resRoot + "/mipmap-anydpi-v26/ic_launcher.xml", adaptiveIcon);
await writeFile(resRoot + "/mipmap-anydpi-v26/ic_launcher_round.xml", adaptiveIcon);
await writeFile(resRoot + "/values/caesh_icon.xml", '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="caesh_icon_background">' + background + '</color>\n</resources>\n');

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let androidManifest = await readFile(manifestPath, "utf8");
const appMatch = androidManifest.match(/<application\b[^>]*>/s);
if (!appMatch) throw new Error("AndroidManifest.xml application element not found.");
let appTag = appMatch[0];
for (const [name, value] of [["android:icon", "@mipmap/ic_launcher"], ["android:roundIcon", "@mipmap/ic_launcher_round"]]) {
  const escaped = name.replace(":", "\\:");
  const re = new RegExp("\\s" + escaped + '="[^"]*"');
  appTag = re.test(appTag) ? appTag.replace(re, " " + name + '="' + value + '"') : appTag.replace(/>$/, " " + name + '="' + value + '">');
}
androidManifest = androidManifest.replace(appMatch[0], appTag);
await writeFile(manifestPath, androidManifest);

console.log("Configured CAESH legacy and adaptive Android launcher icons.");
