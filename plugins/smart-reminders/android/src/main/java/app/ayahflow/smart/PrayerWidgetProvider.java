package app.ayahflow.smart;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.text.format.DateFormat;
import android.view.View;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Home-screen widget: next prayer with a live countdown, later prayers today, and the current adhkar window.
 * Reads the timeline the app precomputes (src/smart.ts widgetData); holds no coordinates. */
public class PrayerWidgetProvider extends AppWidgetProvider {
    static final String DATA = "widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { render(context, manager, ids); }

    /** Re-renders every placed widget, e.g. after the app saved new data. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PrayerWidgetProvider.class));
        if (ids.length > 0) render(context, manager, ids);
    }

    private static PendingIntent link(Context c, String url, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(c.getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void render(Context c, AppWidgetManager manager, int[] ids) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.ayahflow_widget);
        v.setOnClickPendingIntent(R.id.widget_root, link(c, "ayahflow://prayer", 9100));
        long now = System.currentTimeMillis();
        long nextAt = -1;
        try {
            String raw = SmartEngine.prefs(c).getString(DATA, null);
            JSONObject data = raw == null ? null : new JSONObject(raw);
            JSONObject labels = data == null ? new JSONObject() : data.optJSONObject("labels");
            JSONArray prayers = data == null ? null : data.optJSONArray("prayers");
            List<JSONObject> upcoming = new ArrayList<>();
            for (int i = 0; prayers != null && i < prayers.length(); i++) if (prayers.getJSONObject(i).optDouble("at") > now) upcoming.add(prayers.getJSONObject(i));
            v.setTextViewText(R.id.widget_label, (labels == null ? "Next prayer" : labels.optString("next", "Next prayer")).toUpperCase());
            if (upcoming.isEmpty()) {
                String msg = prayers == null || prayers.length() == 0 ? (labels == null ? "" : labels.optString("noPlace")) : (labels == null ? "" : labels.optString("stale"));
                v.setTextViewText(R.id.widget_prayer, "AyahFlow");
                v.setTextViewText(R.id.widget_time, "");
                v.setViewVisibility(R.id.widget_countdown, View.GONE);
                v.setTextViewText(R.id.widget_later, msg);
                v.setViewVisibility(R.id.widget_moment, View.GONE);
            } else {
                JSONObject next = upcoming.get(0);
                nextAt = (long) next.optDouble("at");
                v.setTextViewText(R.id.widget_prayer, next.optString("label"));
                v.setTextViewText(R.id.widget_time, DateFormat.getTimeFormat(c).format(new Date(nextAt)));
                v.setViewVisibility(R.id.widget_countdown, View.VISIBLE);
                v.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime() + (nextAt - now), null, true);
                v.setChronometerCountDown(R.id.widget_countdown, true);
                Calendar end = Calendar.getInstance();
                end.set(Calendar.HOUR_OF_DAY, 23); end.set(Calendar.MINUTE, 59);
                StringBuilder later = new StringBuilder();
                for (int i = 1; i < upcoming.size() && i <= 3; i++) {
                    JSONObject p = upcoming.get(i);
                    if (p.optDouble("at") > end.getTimeInMillis()) break;
                    if (later.length() > 0) later.append("  ·  ");
                    later.append(p.optString("label")).append(' ').append(DateFormat.getTimeFormat(c).format(new Date((long) p.optDouble("at"))));
                }
                v.setTextViewText(R.id.widget_later, later.toString());
                String moment = null, momentKey = null;
                JSONArray windows = data.optJSONArray("windows");
                for (int i = 0; windows != null && i < windows.length() && moment == null; i++) {
                    JSONObject w = windows.getJSONObject(i);
                    if (inside(w.optJSONArray("morning"), now)) { momentKey = "morning"; moment = labels.optString("morning"); }
                    else if (inside(w.optJSONArray("evening"), now)) { momentKey = "evening"; moment = labels.optString("evening"); }
                }
                if (moment != null) {
                    v.setViewVisibility(R.id.widget_moment, View.VISIBLE);
                    v.setTextViewText(R.id.widget_moment, moment);
                    v.setOnClickPendingIntent(R.id.widget_moment, link(c, "ayahflow://moment/" + momentKey, 9101));
                } else v.setViewVisibility(R.id.widget_moment, View.GONE);
            }
        } catch (Exception ignored) { }
        manager.updateAppWidget(ids, v);
        // Roll over to the following prayer when this one arrives (inexact is fine: the countdown keeps ticking meanwhile).
        AlarmManager alarms = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Intent tick = new Intent(c, PrayerWidgetProvider.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        PendingIntent pi = PendingIntent.getBroadcast(c, 9102, tick, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (nextAt > 0) alarms.set(AlarmManager.RTC, nextAt + 1000, pi); else alarms.cancel(pi);
    }

    private static boolean inside(JSONArray w, long now) { return w != null && w.length() == 2 && now >= w.optDouble(0) && now < w.optDouble(1); }
}
