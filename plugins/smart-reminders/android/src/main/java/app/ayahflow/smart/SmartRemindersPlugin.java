package app.ayahflow.smart;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Web-layer API for SmartEngine. Permissions are requested only from these calls, after the user enables a feature. */
@CapacitorPlugin(
    name = "AyahFlowSmart",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "background", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class SmartRemindersPlugin extends Plugin {
    @Override
    public void load() { SmartEngine.apply(getContext()); }

    private JSObject statusObject() {
        JSObject s = new JSObject();
        boolean fine = SmartEngine.has(getContext(), Manifest.permission.ACCESS_FINE_LOCATION);
        s.put("location", SmartEngine.backgroundLocation(getContext()) ? "always" : fine ? "whenInUse" : getPermissionState("location") == PermissionState.DENIED ? "denied" : "prompt");
        s.put("motion", SmartEngine.activityRecognition(getContext()) ? "granted" : getPermissionState("activity") == PermissionState.DENIED ? "denied" : "prompt");
        JSONObject cfg = SmartEngine.config(getContext());
        JSArray monitoring = new JSArray();
        if (cfg != null && cfg.optBoolean("location") && SmartEngine.backgroundLocation(getContext())) {
            JSONArray r = cfg.optJSONArray("regions");
            for (int i = 0; r != null && i < r.length(); i++) monitoring.put(r.optJSONObject(i).optString("id"));
        }
        s.put("monitoring", monitoring);
        s.put("precise", fine);
        return s;
    }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(statusObject()); }

    @PluginMethod
    public void currentPosition(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { requestPermissionForAlias("location", call, "positionPermission"); return; }
        locate(call);
    }

    @PermissionCallback
    private void positionPermission(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) locate(call); else call.reject("denied");
    }

    @SuppressLint("MissingPermission")
    private void locate(PluginCall call) {
        LocationServices.getFusedLocationProviderClient(getContext()).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener(loc -> {
                if (loc == null) { call.reject("unavailable"); return; }
                JSObject o = new JSObject();
                o.put("lat", loc.getLatitude()); o.put("lng", loc.getLongitude()); o.put("accuracy", loc.getAccuracy());
                call.resolve(o);
            })
            .addOnFailureListener(e -> call.reject(e.getMessage()));
    }

    /** Foreground location first, then background ("Allow all the time"), as Android requires separate requests. */
    @PluginMethod
    public void requestAlways(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { requestPermissionForAlias("location", call, "alwaysAfterForeground"); return; }
        alwaysAfterForeground(call);
    }

    @PermissionCallback
    private void alwaysAfterForeground(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED || Build.VERSION.SDK_INT < 29 || SmartEngine.backgroundLocation(getContext())) { SmartEngine.apply(getContext()); call.resolve(statusObject()); return; }
        requestPermissionForAlias("background", call, "afterBackground");
    }

    @PermissionCallback
    private void afterBackground(PluginCall call) { SmartEngine.apply(getContext()); call.resolve(statusObject()); }

    @PluginMethod
    public void requestMotion(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29 || SmartEngine.activityRecognition(getContext())) { SmartEngine.apply(getContext()); call.resolve(statusObject()); return; }
        requestPermissionForAlias("activity", call, "afterBackground");
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String json = call.getString("config");
        if (json == null) { call.reject("config required"); return; }
        try { new JSONObject(json); } catch (JSONException e) { call.reject("invalid config"); return; }
        SmartEngine.prefs(getContext()).edit().putString(SmartEngine.CONFIG, json).apply();
        SmartEngine.apply(getContext());
        call.resolve(statusObject());
    }

    @PluginMethod
    public void takeEvents(PluginCall call) {
        String log = SmartEngine.prefs(getContext()).getString(SmartEngine.LOG, "[]");
        SmartEngine.prefs(getContext()).edit().remove(SmartEngine.LOG).apply();
        JSObject o = new JSObject();
        try { o.put("events", new JSArray(log)); } catch (JSONException e) { o.put("events", new JSArray()); }
        call.resolve(o);
    }

    @PluginMethod
    public void simulate(PluginCall call) {
        String event = call.getString("event");
        if (event == null) { call.reject("event required"); return; }
        List<String> moments = SmartEngine.handle(getContext(), Collections.singletonList(event), System.currentTimeMillis());
        JSObject o = new JSObject();
        o.put("moments", new JSArray(new ArrayList<>(moments)));
        call.resolve(o);
    }

    @PluginMethod
    public void reset(PluginCall call) {
        SmartEngine.prefs(getContext()).edit().clear().apply();
        SmartEngine.apply(getContext());
        PrayerWidgetProvider.refresh(getContext());
        call.resolve();
    }

    /** Widget timeline JSON from src/smart.ts (prayer times and labels); "null" clears it. */
    @PluginMethod
    public void setWidgetData(PluginCall call) {
        String json = call.getString("data");
        if (json == null || json.equals("null")) SmartEngine.prefs(getContext()).edit().remove(PrayerWidgetProvider.DATA).apply();
        else SmartEngine.prefs(getContext()).edit().putString(PrayerWidgetProvider.DATA, json).apply();
        PrayerWidgetProvider.refresh(getContext());
        call.resolve();
    }

    /** Creates the notification channel for an imported athan (files/ayahflow/athan/...). Channel sounds are fixed once
     * created, so each import gets a new channel id; older custom channels are removed. */
    @PluginMethod
    public void athanChannel(PluginCall call) {
        String path = call.getString("path"), id = call.getString("id"), name = call.getString("name", "Athan");
        boolean custom = id != null && id.startsWith("ayahflow-athan-custom-");
        if (path == null || id == null || !(custom || id.startsWith("ayahflow-athan-online-")) || path.contains("..")) { call.reject("path and id required"); return; }
        if (android.os.Build.VERSION.SDK_INT < 26) { call.resolve(); return; }
        java.io.File file = new java.io.File(getContext().getFilesDir(), path);
        if (!file.exists()) { call.reject("file missing"); return; }
        Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        getContext().grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if (custom) for (android.app.NotificationChannel c : nm.getNotificationChannels()) if (c.getId().startsWith("ayahflow-athan-custom-") && !c.getId().equals(id)) nm.deleteNotificationChannel(c.getId());
        android.app.NotificationChannel channel = new android.app.NotificationChannel(id, name, android.app.NotificationManager.IMPORTANCE_HIGH);
        channel.setSound(uri, new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
        call.resolve();
    }

    /** Downloads an athan the user asked for: HTTPS from cdn.aladhan.com only, at most 12 MB, verified against the pinned
     * SHA-256, saved only under files/ayahflow/athan/online/ (Capacitor's Directory.Data). */
    @PluginMethod
    public void downloadAthan(PluginCall call) {
        String url = call.getString("url"), sha = call.getString("sha256"), path = call.getString("path");
        if (url == null || !url.startsWith("https://cdn.aladhan.com/") || sha == null || sha.length() != 64 || path == null || !path.matches("^ayahflow/athan/online/[a-z0-9-]+\\.mp3$")) { call.reject("not allowed"); return; }
        new Thread(() -> {
            java.net.HttpURLConnection conn = null;
            try {
                conn = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                conn.setConnectTimeout(15000); conn.setReadTimeout(60000);
                if (conn.getResponseCode() != 200) { call.reject("download failed"); return; }
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                try (java.io.InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 12000000) { call.reject("too large"); return; } }
                }
                byte[] data = out.toByteArray();
                byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(data);
                StringBuilder hex = new StringBuilder();
                for (byte b : digest) hex.append(String.format("%02x", b));
                if (!hex.toString().equalsIgnoreCase(sha)) { call.reject("checksum mismatch"); return; }
                java.io.File target = new java.io.File(getContext().getFilesDir(), path);
                target.getParentFile().mkdirs();
                try (java.io.FileOutputStream f = new java.io.FileOutputStream(target)) { f.write(data); }
                JSObject o = new JSObject(); o.put("path", path); o.put("bytes", data.length);
                call.resolve(o);
            } catch (Exception e) { call.reject("download failed"); }
            finally { if (conn != null) conn.disconnect(); }
        }).start();
    }

    /** Steps for the last 7 days from the step-counter sensor (see StepLog). Needs ACTIVITY_RECOGNITION on Android 10+,
     * which the app requests through requestMotion when the user turns the step tracker on. */
    @PluginMethod
    public void steps(PluginCall call) {
        android.hardware.SensorManager sm = (android.hardware.SensorManager) getContext().getSystemService(android.content.Context.SENSOR_SERVICE);
        android.hardware.Sensor sensor = sm == null ? null : sm.getDefaultSensor(android.hardware.Sensor.TYPE_STEP_COUNTER);
        if (sensor == null) { call.resolve(stepResult(new JSONObject(), "unavailable", false)); return; }
        if (Build.VERSION.SDK_INT >= 29 && !SmartEngine.activityRecognition(getContext())) {
            call.resolve(stepResult(StepLog.read(getContext(), System.currentTimeMillis()), getPermissionState("activity") == PermissionState.DENIED ? "denied" : "prompt", true));
            return;
        }
        android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
        final boolean[] done = { false };
        android.hardware.SensorEventListener listener = new android.hardware.SensorEventListener() {
            @Override public void onSensorChanged(android.hardware.SensorEvent e) {
                if (done[0]) return;
                done[0] = true; sm.unregisterListener(this);
                call.resolve(stepResult(StepLog.record(getContext(), (long) e.values[0], System.currentTimeMillis()), "granted", true));
            }
            @Override public void onAccuracyChanged(android.hardware.Sensor s, int a) { }
        };
        sm.registerListener(listener, sensor, android.hardware.SensorManager.SENSOR_DELAY_NORMAL);
        // Some sensors report only on the next step: answer with what is already logged after a short wait.
        main.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true; sm.unregisterListener(listener);
            call.resolve(stepResult(StepLog.read(getContext(), System.currentTimeMillis()), "granted", true));
        }, 3000);
    }

    private JSObject stepResult(JSONObject days, String permission, boolean available) {
        JSObject o = new JSObject();
        o.put("available", available && !permission.equals("unavailable"));
        o.put("permission", permission);
        o.put("approximate", true);
        try { o.put("days", new JSArray(days.optJSONArray("days") == null ? "[]" : days.getJSONArray("days").toString())); } catch (JSONException e) { o.put("days", new JSArray()); }
        return o;
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
