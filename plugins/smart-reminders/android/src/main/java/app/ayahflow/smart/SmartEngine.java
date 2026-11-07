package app.ayahflow.smart;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Android counterpart of SmartReminders.swift. The configuration comes from src/smart.ts; the decision steps mirror
 * src/adhkar.ts decide(), which is the tested reference. Saved coordinates stay in this app's private preferences.
 */
public final class SmartEngine {
    static final String PREFS = "ayahflow.smart", CONFIG = "config", HISTORY = "history", LOG = "log";
    static final String CHANNEL = "ayahflow.adhkar";
    static final String ACTION_GEOFENCE = "app.ayahflow.smart.GEOFENCE", ACTION_ACTIVITY = "app.ayahflow.smart.ACTIVITY";
    private SmartEngine() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static JSONObject config(Context c) {
        try { String s = prefs(c).getString(CONFIG, null); return s == null ? null : new JSONObject(s); } catch (JSONException e) { return null; }
    }

    static boolean has(Context c, String permission) { return ContextCompat.checkSelfPermission(c, permission) == PackageManager.PERMISSION_GRANTED; }

    static boolean backgroundLocation(Context c) {
        boolean fine = has(c, Manifest.permission.ACCESS_FINE_LOCATION);
        return Build.VERSION.SDK_INT >= 29 ? fine && has(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION) : fine;
    }

    static boolean activityRecognition(Context c) { return Build.VERSION.SDK_INT < 29 || has(c, Manifest.permission.ACTIVITY_RECOGNITION); }

    private static PendingIntent pending(Context c, String action, int code) {
        Intent i = new Intent(c, SmartReceiver.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(c, code, i, flags);
    }

    /** Registers or removes geofences and vehicle transitions to match the saved configuration. */
    @SuppressLint("MissingPermission")
    static void apply(Context c) {
        JSONObject cfg = config(c);
        PendingIntent geo = pending(c, ACTION_GEOFENCE, 1), act = pending(c, ACTION_ACTIVITY, 2);
        LocationServices.getGeofencingClient(c).removeGeofences(geo);
        ActivityRecognition.getClient(c).removeActivityTransitionUpdates(act);
        if (cfg == null) return;
        JSONArray regions = cfg.optJSONArray("regions");
        if (cfg.optBoolean("location") && backgroundLocation(c) && regions != null && regions.length() > 0) {
            List<Geofence> fences = new ArrayList<>();
            for (int i = 0; i < regions.length(); i++) {
                JSONObject r = regions.optJSONObject(i);
                fences.add(new Geofence.Builder().setRequestId(r.optString("id"))
                    .setCircularRegion(r.optDouble("lat"), r.optDouble("lng"), (float) Math.max(100, r.optDouble("radius", 150)))
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT).build());
            }
            GeofencingRequest request = new GeofencingRequest.Builder().setInitialTrigger(0).addGeofences(fences).build();
            LocationServices.getGeofencingClient(c).addGeofences(request, geo);
        }
        if (cfg.optBoolean("vehicle") && activityRecognition(c)) {
            List<ActivityTransition> transitions = Collections.singletonList(new ActivityTransition.Builder()
                .setActivityType(DetectedActivity.IN_VEHICLE).setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build());
            ActivityRecognition.getClient(c).requestActivityTransitionUpdates(new ActivityTransitionRequest(transitions), act);
        }
    }

    static String dayKey(long ms) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(ms)); }

    private static boolean inWindow(JSONArray w, long now) { return w != null && w.length() == 2 && now >= w.optDouble(0) && now < w.optDouble(1); }

    /** Same steps as decide(): cooldowns, once-per-day, grouping with an open morning/evening window. */
    static synchronized List<String> handle(Context c, List<String> events, long now) {
        List<String> moments = new ArrayList<>();
        JSONObject cfg = config(c);
        if (cfg == null) return moments;
        try {
            SharedPreferences p = prefs(c);
            JSONObject history = new JSONObject(p.getString(HISTORY, "{\"last\":{},\"lastDay\":{}}"));
            JSONObject last = history.getJSONObject("last"), lastDay = history.getJSONObject("lastDay");
            String day = dayKey(now);
            JSONObject windows = null;
            JSONArray ws = cfg.optJSONArray("windows");
            for (int i = 0; ws != null && i < ws.length(); i++) if (day.equals(ws.getJSONObject(i).optString("day"))) windows = ws.getJSONObject(i);
            List<String> enabled = strings(cfg.optJSONArray("enabled")), oncePerDay = strings(cfg.optJSONArray("oncePerDay"));
            JSONObject completed = cfg.optJSONObject("completedDay"), timedAt = cfg.optJSONObject("timedAt");
            JSONArray rules = cfg.optJSONArray("rules");
            for (String event : events) {
                for (int i = 0; rules != null && i < rules.length(); i++) {
                    JSONObject rule = rules.getJSONObject(i);
                    if (!event.equals(rule.optString("event"))) continue;
                    // A crossing this soon after the opposite reminder is location jitter at the edge of the place.
                    JSONObject quiet = rule.optJSONObject("quietAfter");
                    if (quiet != null && last.has(quiet.optString("moment"))) { double l = last.optDouble(quiet.optString("moment")); if (now >= l && now - l < quiet.optDouble("minutes") * 60000) continue; }
                    for (String m : strings(rule.optJSONArray("moments")))
                        if (!blocked(m, rule.optDouble("cooldownMinutes"), now, day, enabled, oncePerDay, completed, timedAt, last, lastDay) && !moments.contains(m)) moments.add(m);
                }
            }
            boolean timeEvent = true;
            for (String e : events) if (!e.equals("MORNING") && !e.equals("EVENING") && !e.equals("SLEEP")) timeEvent = false;
            if (!timeEvent && !moments.isEmpty() && windows != null) {
                if (inWindow(windows.optJSONArray("morning"), now) && !blocked("morning", 0, now, day, enabled, oncePerDay, completed, timedAt, last, lastDay) && !moments.contains("morning")) moments.add("morning");
                if (inWindow(windows.optJSONArray("evening"), now) && !blocked("evening", 0, now, day, enabled, oncePerDay, completed, timedAt, last, lastDay) && !moments.contains("evening")) moments.add("evening");
            }
            JSONArray log = new JSONArray(p.getString(LOG, "[]"));
            for (String e : events) log.put(new JSONObject().put("event", e).put("at", now).put("moments", new JSONArray(moments)));
            while (log.length() > 50) log.remove(0);
            SharedPreferences.Editor edit = p.edit().putString(LOG, log.toString());
            if (!moments.isEmpty()) {
                for (String m : moments) { last.put(m, now); lastDay.put(m, day); }
                edit.putString(HISTORY, history.toString());
            }
            edit.apply();
            if (!moments.isEmpty()) post(c, cfg, moments);
        } catch (JSONException ignored) { }
        return moments;
    }

    private static boolean blocked(String m, double cooldown, long now, String day, List<String> enabled, List<String> oncePerDay, JSONObject completed, JSONObject timedAt, JSONObject last, JSONObject lastDay) {
        if (!enabled.contains(m)) return true;
        // Once a day; and not again once today's timed reminder for it was delivered.
        JSONObject timed = timedAt == null ? null : timedAt.optJSONObject(m);
        if (oncePerDay.contains(m)) return day.equals(lastDay.optString(m, null)) || (completed != null && day.equals(completed.optString(m, null))) || (timed != null && timed.has(day) && timed.optDouble(day) <= now);
        if (last.has(m)) { double l = last.optDouble(m); return now >= l && now - l < cooldown * 60000; }
        return false;
    }

    static List<String> strings(JSONArray a) {
        List<String> out = new ArrayList<>();
        for (int i = 0; a != null && i < a.length(); i++) out.add(a.optString(i));
        return out;
    }

    private static void post(Context c, JSONObject cfg, List<String> moments) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Adhkar reminders", NotificationManager.IMPORTANCE_DEFAULT));
        if (Build.VERSION.SDK_INT >= 33 && !has(c, Manifest.permission.POST_NOTIFICATIONS)) return;
        JSONObject copy = cfg.optJSONObject("copy");
        List<String> titles = new ArrayList<>();
        for (String m : moments) { JSONObject t = copy == null ? null : copy.optJSONObject(m); if (t != null) titles.add(t.optString("title")); }
        String body = groupedBody(moments, copy);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("ayahflow://moment/" + String.join("+", moments))).setPackage(c.getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, (int) (System.currentTimeMillis() % 100000), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(c.getResources().getIdentifier("ic_stat_ayahflow", "drawable", c.getPackageName()))
            .setContentTitle(String.join(" · ", titles))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true).setContentIntent(tap);
        try { NotificationManagerCompat.from(c).notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), b.build()); } catch (SecurityException ignored) { }
    }

    /** Same as src/smart.ts groupedBody: each moment with a narrated du'a of its own under its title when there are several
     * (e.g. "Leaving home" then "Morning adhkar"), a dhikr already shown for an earlier moment not repeated. */
    static String groupedBody(List<String> moments, JSONObject copy) {
        List<String> use = new ArrayList<>();
        for (String m : moments) { JSONObject t = copy == null ? null : copy.optJSONObject(m); if (t != null && !t.optBoolean("general")) use.add(m); }
        if (use.isEmpty()) use.add(moments.get(0));
        if (use.size() == 1) { JSONObject t = copy == null ? null : copy.optJSONObject(use.get(0)); return t == null ? "" : t.optString("body"); }
        java.util.Set<String> seen = new java.util.HashSet<>();
        List<String> parts = new ArrayList<>();
        for (String m : use) {
            JSONObject t = copy.optJSONObject(m);
            StringBuilder b = new StringBuilder(t.optString("title"));
            for (String line : t.optString("body").split("\n", -1)) {
                if (line.matches("(?s).*[\u064B-\u0652].*") && !seen.add(line)) continue;
                b.append('\n').append(line);
            }
            parts.add(b.toString());
        }
        return String.join("\n\n", parts);
    }
}
