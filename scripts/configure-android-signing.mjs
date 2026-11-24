import { readFile, writeFile } from "node:fs/promises";

const gradlePath = "android/app/build.gradle";
let gradle = await readFile(gradlePath, "utf8");

if (gradle.includes("signingConfigs.caeshRelease")) {
  console.log("CAESH release signing is already configured.");
  process.exit(0);
}

const androidBlock = /android\s*\{/;
if (!androidBlock.test(gradle)) {
  throw new Error("Could not find the Android Gradle configuration block.");
}

gradle = gradle.replace(androidBlock, (match) => `${match}
    signingConfigs {
        caeshRelease {
            def keystorePath = System.getenv("CAESH_KEYSTORE_FILE")
            if (keystorePath == null || keystorePath.isEmpty()) {
                throw new GradleException("CAESH_KEYSTORE_FILE is required for a signed release build.")
            }
            storeFile file(keystorePath)
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`);

const releaseBlock = /(buildTypes\s*\{\s*release\s*\{)/;
if (!releaseBlock.test(gradle)) {
  throw new Error("Could not find the release build type in app/build.gradle.");
}

gradle = gradle.replace(releaseBlock, `$1
            signingConfig signingConfigs.caeshRelease`);

await writeFile(gradlePath, gradle);
console.log("Configured CAESH release APK signing.");
