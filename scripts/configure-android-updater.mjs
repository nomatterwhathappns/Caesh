import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const applicationId = "com.caesh.finance";
const packagePath = applicationId.replaceAll(".", "/");
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");

if (!manifest.includes('android:name="android.permission.REQUEST_INSTALL_PACKAGES"')) {
  manifest = manifest.replace(
    "</manifest>",
    '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n</manifest>',
  );
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
  if (!manifest.includes("</application>")) {
    throw new Error("AndroidManifest.xml does not contain an application element.");
  }
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

const javaDir = `android/app/src/main/java/${packagePath}`;
await mkdir(javaDir, { recursive: true });
await writeFile(`${javaDir}/AppInstallPlugin.java`, `package ${applicationId};

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AppInstallPlugin")
public class AppInstallPlugin extends Plugin {
    @PluginMethod
    public void canInstallUnknownApps(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallUnknownAppsSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void verifyApkSha256(PluginCall call) {
        String filePath = call.getString("filePath");
        String expectedSha256 = call.getString("expectedSha256");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("Lokasi file APK tidak diberikan.");
            return;
        }
        if (expectedSha256 == null || !expectedSha256.matches("(?i)[0-9a-f]{64}")) {
            call.reject("Hash SHA-256 pada manifest tidak valid.");
            return;
        }

        File apkFile = new File(filePath);
        if (!apkFile.isFile()) {
            call.reject("File APK pembaruan tidak ditemukan.");
            return;
        }

        try (FileInputStream input = new FileInputStream(apkFile)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }

            StringBuilder actualSha256 = new StringBuilder(64);
            for (byte value : digest.digest()) {
                actualSha256.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
            }

            boolean valid = MessageDigest.isEqual(
                expectedSha256.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.US_ASCII),
                actualSha256.toString().getBytes(StandardCharsets.US_ASCII)
            );
            JSObject result = new JSObject();
            result.put("valid", valid);
            result.put("actualSha256", actualSha256.toString());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Gagal memverifikasi integritas APK.", error);
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("Lokasi file APK tidak diberikan.");
            return;
        }
        File apkFile = new File(filePath);
        if (!apkFile.isFile()) {
            call.reject("File APK tidak ditemukan: " + filePath);
            return;
        }
        try {
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
            );
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(apkUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("completed", true);
            result.put("message", "Installer Android berhasil dibuka.");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Gagal membuka installer Android.", error);
        }
    }
}
`);

await writeFile(`${javaDir}/MainActivity.java`, `package ${applicationId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppInstallPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

console.log("Configured CAESH native APK installer, permission, and FileProvider.");
