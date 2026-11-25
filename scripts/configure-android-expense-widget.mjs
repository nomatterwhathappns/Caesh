import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const appId = "com.caesh.finance";
const javaDir = `android/app/src/main/java/${appId.replaceAll(".", "/")}`;
const resDir = "android/app/src/main/res";
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");

const receiver = `
        <receiver
            android:name=".ExpenseWidgetProvider"
            android:exported="true"
            android:label="CAESH Pengeluaran">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/expense_widget_info" />
        </receiver>
`;
if (!manifest.includes('android:name=".ExpenseWidgetProvider"')) {
  if (!manifest.includes("</application>")) throw new Error("AndroidManifest.xml application element is missing.");
  manifest = manifest.replace("</application>", receiver + "    </application>");
  await writeFile(manifestPath, manifest);
}

await mkdir(javaDir, { recursive: true });
await mkdir(`${resDir}/layout`, { recursive: true });
await mkdir(`${resDir}/xml`, { recursive: true });
await writeFile(`${resDir}/layout/expense_widget.xml`, `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#24352B"
    android:padding="0dp">
    <ImageView
        android:id="@+id/expense_widget_background"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:scaleType="centerCrop"
        android:contentDescription="@null" />
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:gravity="bottom"
        android:padding="16dp"
        android:background="#990D1711">
        <TextView
            android:id="@+id/expense_widget_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Pengeluaran Bulanan"
            android:textColor="#FFFFFF"
            android:textSize="13sp"
            android:maxLines="2"
            android:ellipsize="end"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/expense_widget_amount"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="7dp"
            android:text="Rp0"
            android:textColor="#FFFFFF"
            android:textSize="22sp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/expense_widget_caption"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="5dp"
            android:text="Bulan ini"
            android:textColor="#E6FFFFFF"
            android:textSize="10sp"
            android:maxLines="2"
            android:ellipsize="end" />
    </LinearLayout>
</FrameLayout>
`);

await writeFile(`${resDir}/xml/expense_widget_info.xml`, `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/expense_widget"
    android:resizeMode="none"
    android:widgetCategory="home_screen"
    android:description="@string/app_name" />
`);

await writeFile(`${javaDir}/ExpenseWidgetProvider.java`, `package ${appId};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.widget.RemoteViews;
import java.nio.charset.StandardCharsets;\nimport java.text.SimpleDateFormat;\nimport java.util.Calendar;\nimport java.util.Locale;

public class ExpenseWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "caesh_expense_widget";
    static final String KEY_DATA = "payload";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        int[] allIds = manager.getAppWidgetIds(new ComponentName(context, ExpenseWidgetProvider.class));
        if (allIds.length > 1) {
            for (int i = 1; i < allIds.length; i++) {
                manager.deleteAppWidgetId(allIds[i]);
            }
            ids = new int[] { allIds[0] };
        }
        for (int id : ids) updateOne(context, manager, id);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ExpenseWidgetProvider.class));
        if (ids.length == 0) return;
        if (ids.length > 1) {
            for (int i = 1; i < ids.length; i++) manager.deleteAppWidgetId(ids[i]);
            ids = new int[] { ids[0] };
        }
        for (int id : ids) updateOne(context, manager, id);
    }

    private static void refreshPeriodIfNeeded(SharedPreferences prefs) {
        String period = prefs.getString("period", "monthly");
        if ("custom".equals(period)) return;
        String currentKey = getCurrentPeriodKey(period);
        String previousKey = prefs.getString("periodKey", currentKey);
        if (currentKey.equals(previousKey)) return;
        String label = "monthly".equals(period) ? "Bulan ini" : "yearly".equals(period) ? "Tahun ini" : "weekly".equals(period) ? "Minggu ini" : "Hari ini";
        String beforeImage = prefs.getString("beforeImage", "");
        String baseImage = prefs.getString("baseImage", "");
        String image = beforeImage.isEmpty() ? baseImage : beforeImage;
        prefs.edit()
            .putString("periodKey", currentKey)
            .putString("amount", "Rp0")
            .putString("caption", label + " · 0 transaksi")
            .putString("image", image)
            .putBoolean("overLimit", false)
            .apply();
    }

    private static String getCurrentPeriodKey(String period) {
        Calendar calendar = Calendar.getInstance();
        if ("daily".equals(period)) return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(calendar.getTime());
        if ("weekly".equals(period)) {
            int daysSinceMonday = (calendar.get(Calendar.DAY_OF_WEEK) + 5) % 7;
            calendar.add(Calendar.DAY_OF_MONTH, -daysSinceMonday);
            return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(calendar.getTime());
        }
        if ("yearly".equals(period)) return new SimpleDateFormat("yyyy", Locale.ROOT).format(calendar.getTime());
        return new SimpleDateFormat("yyyy-MM", Locale.ROOT).format(calendar.getTime());
    }

    private static void updateOne(Context context, AppWidgetManager manager, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        refreshPeriodIfNeeded(prefs);
        String title = prefs.getString("title", "Pengeluaran Bulanan");
        String amount = prefs.getString("amount", "Rp0");
        String caption = prefs.getString("caption", "Bulan ini");
        String image = prefs.getString("image", "");
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.expense_widget);
        views.setTextViewText(R.id.expense_widget_title, title);
        views.setTextViewText(R.id.expense_widget_amount, amount);
        views.setTextViewText(R.id.expense_widget_caption, caption);
        Bitmap bitmap = decodeImage(image);
        if (bitmap != null) views.setImageViewBitmap(R.id.expense_widget_background, bitmap);
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.expense_widget_root, pending);\n            views.setOnClickPendingIntent(R.id.expense_widget_title, pending);
            views.setOnClickPendingIntent(R.id.expense_widget_amount, pending);
            views.setOnClickPendingIntent(R.id.expense_widget_caption, pending);
        }
        manager.updateAppWidget(id, views);
    }

    private static Bitmap decodeImage(String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:image/")) return null;
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) return null;
            byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception ignored) {
            return null;
        }
    }
}
`);

await writeFile(`${javaDir}/ExpenseWidgetPlugin.java`, `package ${appId};

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExpenseWidgetPlugin")
public class ExpenseWidgetPlugin extends Plugin {
    private boolean isInstalled() {
        int[] ids = AppWidgetManager.getInstance(getContext())
            .getAppWidgetIds(new ComponentName(getContext(), ExpenseWidgetProvider.class));
        return ids.length > 0;
    }

    @PluginMethod
    public void syncExpenseWidget(PluginCall call) {
        String title = call.getString("title", "Pengeluaran Bulanan");
        String amount = call.getString("amount", "Rp0");
        String periodLabel = call.getString("periodLabel", "Bulan ini");
        String transactionCount = String.valueOf(call.getInt("transactionCount", 0));
        boolean overLimit = call.getBoolean("overLimit", false);
        boolean enabled = call.getBoolean("enabled", true);
        String period = call.getString("period", "monthly");
        String periodKey = call.getString("periodKey", "");
        String baseImage = call.getString("baseImage", "");
        String beforeImage = call.getString("beforeImage", "");
        String afterImage = call.getString("afterImage", "");
        boolean limitEnabled = call.getBoolean("limitEnabled", false);
        String image = overLimit && !afterImage.isEmpty() ? afterImage : limitEnabled && !beforeImage.isEmpty() ? beforeImage : baseImage;
        if (!enabled) image = "";
        String caption = periodLabel + " · " + transactionCount + " transaksi";
        if (overLimit) caption = "Batas pengeluaran terlampaui";
        getContext().getSharedPreferences(ExpenseWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("title", title)
            .putString("amount", amount)
            .putString("caption", caption)
            .putString("image", image)
            .putString("period", period)
            .putString("periodKey", periodKey)
            .putString("periodLabel", periodLabel)
            .putString("baseImage", baseImage)
            .putString("beforeImage", beforeImage)
            .putString("afterImage", afterImage)
            .putBoolean("limitEnabled", limitEnabled)
            .putBoolean("overLimit", overLimit)
            .apply();
        ExpenseWidgetProvider.updateAll(getContext());
        JSObject result = new JSObject();
        result.put("installed", isInstalled());
        call.resolve(result);
    }

    @PluginMethod
    public void getExpenseWidgetStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("installed", isInstalled());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPinExpenseWidget(PluginCall call) {
        if (isInstalled()) {
            JSObject result = new JSObject();
            result.put("requested", false);
            result.put("installed", true);
            call.resolve(result);
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || !AppWidgetManager.getInstance(getContext()).isRequestPinAppWidgetSupported()) {
            call.reject("Peluncur Android ini belum mendukung pemasangan widget dari aplikasi. Tambahkan CAESH melalui menu Widget di home screen.");
            return;
        }
        AppWidgetManager.getInstance(getContext()).requestPinAppWidget(
            new ComponentName(getContext(), ExpenseWidgetProvider.class), null, null);
        JSObject result = new JSObject();
        result.put("requested", true);
        result.put("installed", false);
        call.resolve(result);
    }
}
`);

const activityPath = `${javaDir}/MainActivity.java`;
let activity = await readFile(activityPath, "utf8");
if (!activity.includes("ExpenseWidgetPlugin.class")) {
  activity = activity.replace("registerPlugin(AppInstallPlugin.class);", "registerPlugin(AppInstallPlugin.class);\n        registerPlugin(ExpenseWidgetPlugin.class);");
  await writeFile(activityPath, activity);
}
console.log("Configured CAESH Android home-screen expense widget.");
