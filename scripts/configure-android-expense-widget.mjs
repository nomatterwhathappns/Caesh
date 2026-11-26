import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const appId = "com.caesh.finance";
const javaDir = `android/app/src/main/java/${appId.replaceAll(".", "/")}`;
const resDir = "android/app/src/main/res";
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");

const receiver = `
        <activity
            android:name=".ExpenseWidgetConfigActivity"
            android:exported="true"
            android:theme="@android:style/Theme.Translucent.NoTitleBar" />
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
const layoutXml = (padding, titleSize, amountSize, captionSize) => `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/expense_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/expense_widget_shape"
    android:padding="0dp">
    <ImageView
        android:id="@+id/expense_widget_background"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="@drawable/expense_widget_shape"
        android:clipToOutline="true"
        android:scaleType="centerCrop"
        android:contentDescription="@null" />
    <RelativeLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:padding="${padding}dp"
        android:background="@drawable/expense_widget_overlay"
        android:clipToOutline="true">
        <TextView
            android:id="@+id/expense_widget_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_alignParentTop="true"
            android:text="Pengeluaran Bulanan"
            android:textColor="#FFFFFF"
            android:textSize="${titleSize}sp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textStyle="bold"
            android:shadowColor="#99000000"
            android:shadowRadius="3" />
        <LinearLayout
            android:id="@+id/expense_widget_bottom_group"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_alignParentBottom="true"
            android:orientation="vertical"
            android:gravity="bottom">
        <TextView
            android:id="@+id/expense_widget_amount"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="0dp"
            android:text="Rp0"
            android:textColor="#FFFFFF"
            android:textSize="${amountSize}sp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textStyle="bold"
            android:shadowColor="#99000000"
            android:shadowRadius="4" />
        <TextView
            android:id="@+id/expense_widget_period"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="5dp"
            android:text="Bulan ini"
            android:textColor="#F2FFFFFF"
            android:textSize="${captionSize}sp"
            android:maxLines="1"
            android:ellipsize="end"
            android:shadowColor="#99000000"
            android:shadowRadius="2" />
        <TextView
            android:id="@+id/expense_widget_count"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:text="0 transaksi"
            android:textColor="#F2FFFFFF"
            android:textSize="${captionSize}sp"
            android:maxLines="1"
            android:ellipsize="end"
            android:shadowColor="#99000000"
            android:shadowRadius="2" />
        </LinearLayout>
    </RelativeLayout>
</FrameLayout>
`;
await writeFile(`${resDir}/layout/expense_widget_small.xml`, layoutXml(9, 11, 16, 9));
await writeFile(`${resDir}/layout/expense_widget.xml`, layoutXml(16, 13, 23, 10));
await writeFile(`${resDir}/layout/expense_widget_large.xml`, layoutXml(20, 15, 27, 12));
await writeFile(`${resDir}/drawable/expense_widget_shape.xml`, `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#713B45" />
    <corners android:radius="22dp" />
</shape>
`);
await writeFile(`${resDir}/drawable/expense_widget_overlay.xml`, `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#330D1711" />
    <corners android:radius="22dp" />
</shape>
`);

await writeFile(`${resDir}/xml/expense_widget_info.xml`, `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:configure="com.caesh.finance.ExpenseWidgetConfigActivity"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:minResizeWidth="110dp"
    android:minResizeHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/expense_widget"
    android:resizeMode="horizontal|vertical"
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
import android.os.Bundle;
import android.util.Base64;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class ExpenseWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "caesh_expense_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateOne(context, manager, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        updateOne(context, manager, id);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ExpenseWidgetProvider.class));
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
        boolean useBeforeImage = !beforeImage.isEmpty();
        String image = useBeforeImage ? beforeImage : baseImage;
        String positionX = prefs.getString(useBeforeImage ? "beforeImageX" : "baseImageX", "50");
        String positionY = prefs.getString(useBeforeImage ? "beforeImageY" : "baseImageY", "50");
        String zoom = prefs.getString(useBeforeImage ? "beforeImageZoom" : "baseImageZoom", "1");
        prefs.edit()
            .putString("periodKey", currentKey)
            .putString("amount", "Rp0")
            .putString("caption", label + " · 0 transaksi")
            .putString("periodLabel", label)
            .putString("transactionCount", "0")
            .putString("image", image)
            .putString("imagePositionX", positionX)
            .putString("imagePositionY", positionY)
            .putString("imageZoom", zoom)
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

    private static RemoteViews createViews(Context context, int layoutId, String title, String amount,
            String periodLabel, String transactionCount, Bitmap bitmap, PendingIntent pending) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
        views.setTextViewText(R.id.expense_widget_title, title);
        views.setTextViewText(R.id.expense_widget_amount, amount);
        views.setTextViewText(R.id.expense_widget_period, periodLabel);
        views.setTextViewText(R.id.expense_widget_count, transactionCount + " transaksi");
        if (bitmap != null) views.setImageViewBitmap(R.id.expense_widget_background, bitmap);
        if (pending != null) {
            views.setOnClickPendingIntent(R.id.expense_widget_root, pending);
            views.setOnClickPendingIntent(R.id.expense_widget_title, pending);
            views.setOnClickPendingIntent(R.id.expense_widget_amount, pending);
            views.setOnClickPendingIntent(R.id.expense_widget_period, pending);
            views.setOnClickPendingIntent(R.id.expense_widget_count, pending);
        }
        return views;
    }

    private static void updateOne(Context context, AppWidgetManager manager, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        refreshPeriodIfNeeded(prefs);
        String title = prefs.getString("title", "Pengeluaran Bulanan");
        String amount = prefs.getString("amount", "Rp0");
        String periodLabel = prefs.getString("periodLabel", prefs.getString("caption", "Bulan ini"));
        String transactionCount = prefs.getString("transactionCount", "0");
        if (prefs.getBoolean("overLimit", false)) periodLabel = "Batas pengeluaran terlampaui";
        String image = prefs.getString("image", "");
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent pending = null;
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            pending = PendingIntent.getActivity(context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        Bundle options = manager.getAppWidgetOptions(id);
        int availableWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int availableHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        float density = context.getResources().getDisplayMetrics().density;
        float targetAspect = availableHeight > 0 ? (availableWidth / density) / (float) (availableHeight / density) : 1.5f;
        float positionX = parseFloat(prefs.getString("imagePositionX", "50"), 50f);
        float positionY = parseFloat(prefs.getString("imagePositionY", "50"), 50f);
        float zoom = parseFloat(prefs.getString("imageZoom", "1"), 1f);
        Bitmap bitmap = decodeImage(image, positionX, positionY, zoom, targetAspect);
        int layoutId = R.layout.expense_widget;
        if (availableWidth < 135 || availableHeight < 135) {
            layoutId = R.layout.expense_widget_small;
        } else if (availableWidth >= 220) {
            layoutId = R.layout.expense_widget_large;
        }
        manager.updateAppWidget(id, createViews(context, layoutId, title, amount, periodLabel, transactionCount, bitmap, pending));
    }

    private static float parseFloat(String value, float fallback) {
        try { return Float.parseFloat(value); } catch (Exception ignored) { return fallback; }
    }

    private static Bitmap decodeImage(String dataUrl, float positionX, float positionY, float zoom, float targetAspect) {
        if (dataUrl == null || !dataUrl.startsWith("data:image/")) return null;
        try {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) return null;
            byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            Bitmap source = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (source == null) return null;
            float aspect = targetAspect > 0f ? targetAspect : 1.5f;
            float cropWidth = source.getWidth();
            float cropHeight = source.getHeight();
            if (cropWidth / cropHeight > aspect) cropWidth = cropHeight * aspect;
            else cropHeight = cropWidth / aspect;
            float safeZoom = Math.max(1f, Math.min(2.5f, zoom));
            cropWidth = Math.max(1f, cropWidth / safeZoom);
            cropHeight = Math.max(1f, cropHeight / safeZoom);
            float maxLeft = Math.max(0f, source.getWidth() - cropWidth);
            float maxTop = Math.max(0f, source.getHeight() - cropHeight);
            float left = maxLeft * Math.max(0f, Math.min(100f, positionX)) / 100f;
            float top = maxTop * Math.max(0f, Math.min(100f, positionY)) / 100f;
            Bitmap cropped = Bitmap.createBitmap(source, Math.round(left), Math.round(top),
                Math.min(source.getWidth() - Math.round(left), Math.max(1, Math.round(cropWidth))),
                Math.min(source.getHeight() - Math.round(top), Math.max(1, Math.round(cropHeight))));
            if (cropped != source) source.recycle();
            return cropped;
        } catch (Exception ignored) {
            return null;
        }
    }
}
`);

const configJava = [
  "package " + appId + ";",
  "",
  "import android.app.Activity;",
  "import android.appwidget.AppWidgetManager;",
  "import android.content.ComponentName;",
  "import android.content.Intent;",
  "import android.os.Bundle;",
  "",
  "public class ExpenseWidgetConfigActivity extends Activity {",
  "    @Override",
  "    protected void onCreate(Bundle savedInstanceState) {",
  "        super.onCreate(savedInstanceState);",
  "        setResult(RESULT_CANCELED);",
  "        int widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);",
  "        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }",
  "        int[] existingIds = AppWidgetManager.getInstance(this).getAppWidgetIds(new ComponentName(this, ExpenseWidgetProvider.class));",
  "        if (existingIds.length > 1) { finish(); return; }",
  "        Intent result = new Intent();",
  "        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);",
  "        setResult(RESULT_OK, result);",
  "        ExpenseWidgetProvider.updateAll(this);",
  "        finish();",
  "    }",
  "}"
].join("\n");
await writeFile(javaDir + "/ExpenseWidgetConfigActivity.java", configJava);

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
        boolean useAfterImage = overLimit && !afterImage.isEmpty();
        boolean useBeforeImage = !useAfterImage && limitEnabled && !beforeImage.isEmpty();
        String image = useAfterImage ? afterImage : useBeforeImage ? beforeImage : baseImage;
        String positionX = String.valueOf(call.getInt("imagePositionX", 50));
        String positionY = String.valueOf(call.getInt("imagePositionY", 50));
        String imageZoom = String.valueOf(call.getDouble("imageZoom", 1.0));
        if (!enabled) image = "";
        String caption = periodLabel + " · " + transactionCount + " transaksi";
        if (overLimit) caption = "Batas pengeluaran terlampaui";
        getContext().getSharedPreferences(ExpenseWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("title", title)
            .putString("amount", amount)
            .putString("caption", caption)
            .putString("periodLabel", overLimit ? "Batas pengeluaran terlampaui" : periodLabel)
            .putString("transactionCount", transactionCount)
            .putString("image", image)
            .putString("period", period)
            .putString("periodKey", periodKey)
            .putString("baseImage", baseImage)
            .putString("beforeImage", beforeImage)
            .putString("afterImage", afterImage)
            .putString("baseImageX", String.valueOf(call.getInt("baseImageX", 50)))
            .putString("baseImageY", String.valueOf(call.getInt("baseImageY", 50)))
            .putString("baseImageZoom", String.valueOf(call.getDouble("baseImageZoom", 1.0)))
            .putString("beforeImageX", String.valueOf(call.getInt("beforeImageX", 50)))
            .putString("beforeImageY", String.valueOf(call.getInt("beforeImageY", 50)))
            .putString("beforeImageZoom", String.valueOf(call.getDouble("beforeImageZoom", 1.0)))
            .putString("afterImageX", String.valueOf(call.getInt("afterImageX", 50)))
            .putString("afterImageY", String.valueOf(call.getInt("afterImageY", 50)))
            .putString("afterImageZoom", String.valueOf(call.getDouble("afterImageZoom", 1.0)))
            .putString("imagePositionX", positionX)
            .putString("imagePositionY", positionY)
            .putString("imageZoom", imageZoom)
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
