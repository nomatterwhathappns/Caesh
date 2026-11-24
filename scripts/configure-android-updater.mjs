import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");

if (!manifest.includes('android:name="android.permission.REQUEST_INSTALL_PACKAGES"')) {
  manifest = manifest.replace("</manifest>", '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n</manifest>');
}

if (!manifest.includes('android:name="androidx.core.content.FileProvider"')) {
  const provider = `
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
`;
  manifest = manifest.replace("</application>", provider + "    </application>");
}

await writeFile(manifestPath, manifest);
const pathsPath = "android/app/src/main/res/xml/file_paths.xml";
await mkdir(dirname(pathsPath), { recursive: true });
await writeFile(pathsPath, `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="cache" path="." />
    <files-path name="files" path="." />
</paths>
`);
console.log("Configured Android APK installer FileProvider and permission.");
