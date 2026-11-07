package app.ayahflow.smart;

import android.content.Context;
import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** The next Friday, voluntary-fast day or start of Ramadan the app shared (src/calendar.ts upcomingDays). */
public class UpcomingWidgetProvider extends SimpleWidget {
    @Override
    Card card(Context c, JSONObject data, JSONObject labels, long now) {
        Card k = new Card();
        k.label = labels.optString("upcomingTab", "Coming up");
        JSONArray list = data.optJSONArray("upcoming");
        java.util.Calendar start = java.util.Calendar.getInstance();
        start.set(java.util.Calendar.HOUR_OF_DAY, 0); start.set(java.util.Calendar.MINUTE, 0); start.set(java.util.Calendar.SECOND, 0); start.set(java.util.Calendar.MILLISECOND, 0);
        Locale locale = Locale.forLanguageTag(data.optString("locale", "en"));
        for (int i = 0; list != null && i < list.length(); i++) {
            JSONObject u = list.optJSONObject(i);
            if (u.optDouble("at") < start.getTimeInMillis()) continue;
            boolean isToday = u.optDouble("at") < start.getTimeInMillis() + 86400000L;
            String day = isToday ? labels.optString("todayWord", "Today") : DateFormat.getDateInstance(DateFormat.MEDIUM, locale).format(new Date((long) u.optDouble("at")));
            k.title = u.optString("title");
            k.sub = day + "  ·  " + u.optString("sub");
            k.url = "jumuah".equals(u.optString("kind")) ? "ayahflow://ayah/18:1" : "ayahflow://prayer";
            return k;
        }
        k.title = labels.optString("upcomingEmpty", "No Friday or voluntary fast in the next two weeks.");
        return k;
    }
}
