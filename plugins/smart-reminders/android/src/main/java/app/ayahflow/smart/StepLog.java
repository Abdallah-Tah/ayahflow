package app.ayahflow.smart;

import android.content.Context;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Daily steps from TYPE_STEP_COUNTER (steps since boot). The sensor has no history, so each reading adds the steps since
 * the previous reading to today; a day before the first reading is unknown and is left out. Kept in the plugin's
 * preferences on this device only, for 8 days. */
final class StepLog {
    static final String KEY = "steps";
    private StepLog() { }

    static String day(long at) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(at)); }

    /** Records a raw counter value and returns the last 7 days. A value below the previous one means the phone restarted. */
    static synchronized JSONObject record(Context c, long raw, long now) {
        JSONObject log = load(c);
        try {
            JSONObject days = log.getJSONObject("days");
            String today = day(now);
            if (log.has("raw")) {
                long prev = log.getLong("raw");
                long delta = raw >= prev ? raw - prev : raw;
                days.put(today, days.optLong(today, 0) + delta);
            } else days.put(today, days.optLong(today, 0));
            log.put("raw", raw);
            Calendar cut = Calendar.getInstance(); cut.setTimeInMillis(now); cut.add(Calendar.DAY_OF_YEAR, -8);
            String oldest = day(cut.getTimeInMillis());
            JSONArray names = days.names();
            for (int i = 0; names != null && i < names.length(); i++) if (names.getString(i).compareTo(oldest) < 0) days.remove(names.getString(i));
            SmartEngine.prefs(c).edit().putString(KEY, log.toString()).apply();
        } catch (Exception ignored) { }
        return days(log, now);
    }

    /** The last 7 days without a new reading (sensor unavailable or slow to answer). */
    static synchronized JSONObject read(Context c, long now) { return days(load(c), now); }

    private static JSONObject load(Context c) {
        try {
            JSONObject o = new JSONObject(SmartEngine.prefs(c).getString(KEY, "{}"));
            if (!o.has("days")) o.put("days", new JSONObject());
            return o;
        } catch (Exception e) {
            JSONObject o = new JSONObject();
            try { o.put("days", new JSONObject()); } catch (Exception ignored) { }
            return o;
        }
    }

    private static JSONObject days(JSONObject log, long now) {
        JSONArray out = new JSONArray();
        JSONObject days = log.optJSONObject("days");
        Calendar d = Calendar.getInstance(); d.setTimeInMillis(now); d.add(Calendar.DAY_OF_YEAR, -6);
        for (int i = 0; i < 7; i++, d.add(Calendar.DAY_OF_YEAR, 1)) {
            String k = day(d.getTimeInMillis());
            if (days != null && days.has(k)) {
                JSONObject row = new JSONObject();
                try { row.put("day", k); row.put("steps", days.optLong(k)); } catch (Exception ignored) { }
                out.put(row);
            }
        }
        JSONObject o = new JSONObject();
        try { o.put("days", out); } catch (Exception ignored) { }
        return o;
    }
}
