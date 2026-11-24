import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = packageJson.version;
const match = /^(\\d+)\\.(\\d+)\\.(\\d+)$/.exec(version);
if (!match) {
  throw new Error(`Invalid CAESH version: ${version}`);
}

const [, major, minor, patch] = match;
const versionCode = Number(major) * 10000 + Number(minor) * 100 + Number(patch);
if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
  throw new Error(`Invalid Android version code for ${version}`);
}

const gradlePath = "android/app/build.gradle";
let gradle = await readFile(gradlePath, "utf8");
if (!/\\bversionCode\\s+\\d+/.test(gradle) || !/\\bversionName\\s+["'][^"']+["']/.test(gradle)) {
  throw new Error("Could not find versionCode and versionName in generated Android Gradle file.");
}
gradle = gradle.replace(/\\bversionCode\\s+\\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/\\bversionName\\s+["'][^"']+["']/, `versionName "${version}"`);
await writeFile(gradlePath, gradle);
console.log(`Configured CAESH Android version ${version} (versionCode ${versionCode}).`);
