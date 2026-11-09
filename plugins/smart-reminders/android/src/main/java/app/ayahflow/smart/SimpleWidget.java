package app.ayahflow.smart;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** One-card widgets (du'a, dhikr, daily moments, Jumu'ah and fasts) drawn from the timeline the app shares for the prayer
 * widget (src/smart.ts widgetData). Each subclass fills a label, a title and a line underneath; nothing is computed
 * here that the app did not share, and nothing leaves the device. */
public abstract class SimpleWidget extends AppWidgetProvider {
    /** What a widget shows; `rtl` sets the title right to left (Arabic text). */
    static final class Card {
        String label = "", title = "", sub = "", url = "ayahflow://home";
        boolean rtl = false;
        int progress = -1;
    }

    abstract Card card(Context c, JSONObject data, JSONObject labels, long now) throws Exception;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { draw(context, manager, ids, this); }

    static final Class<?>[] ALL = { DuaWidgetProvider.class, DhikrWidgetProvider.class, StepsWidgetProvider.class, UpcomingWidgetProvider.class };

    /** Re-renders every placed one-card widget, e.g. after the app saved new data. */
    static void refreshAll(Context c) {
        AppWidgetManager manager = AppWidgetManager.getInstance(c);
        for (Class<?> k : ALL) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(c, k));
            if (ids.length == 0) continue;
            try { draw(c, manager, ids, (SimpleWidget) k.getDeclaredConstructor().newInstance()); } catch (Exception ignored) { }
        }
    }

    static String today(long now) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now)); }

    static JSONObject counter(JSONObject data, String id, long now) {
        JSONObject daily = data.optJSONObject("daily");
        if (daily == null || !today(now).equals(daily.optString("day"))) return null;
        JSONArray list = daily.optJSONArray("counters");
        for (int i = 0; list != null && i < list.length(); i++) if (id.equals(list.optJSONObject(i).optString("id"))) return list.optJSONObject(i);
        return null;
    }

    private static void draw(Context c, AppWidgetManager manager, int[] ids, SimpleWidget w) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.ayahflow_widget_simple);
        Card card = new Card();
        long now = System.currentTimeMillis();
        try {
            String raw = SmartEngine.prefs(c).getString(PrayerWidgetProvider.DATA, null);
            JSONObject data = raw == null ? new JSONObject() : new JSONObject(raw);
            JSONObject labels = data.optJSONObject("labels");
            card = w.card(c, data, labels == null ? new JSONObject() : labels, now);
        } catch (Exception e) { card.title = "AyahFlow"; }
        v.setTextViewText(R.id.simple_label, card.label);
        v.setTextViewText(R.id.simple_title, card.title);
        v.setTextViewText(R.id.simple_sub, card.sub);
        v.setViewVisibility(R.id.simple_sub, card.sub.isEmpty() ? View.GONE : View.VISIBLE);
        v.setInt(R.id.simple_title, "setTextDirection", card.rtl ? View.TEXT_DIRECTION_RTL : View.TEXT_DIRECTION_LOCALE);
        v.setViewVisibility(R.id.simple_progress, card.progress < 0 ? View.GONE : View.VISIBLE);
        if (card.progress >= 0) v.setProgressBar(R.id.simple_progress, 100, Math.min(100, card.progress), false);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(card.url)).setPackage(c.getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.simple_root, PendingIntent.getActivity(c, 9200 + w.getClass().getSimpleName().length(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(ids, v);
    }
}
