package app.ayahflow.smart;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/** Today's du'a from the Quran (src/smart.ts dailyAyahs): the corpus text as it is, with its reference. */
public class DuaWidgetProvider extends SimpleWidget {
    @Override
    Card card(Context c, JSONObject data, JSONObject labels, long now) {
        Card k = new Card();
        k.label = labels.optString("ayahTab", "Daily verse");
        JSONArray ayahs = data.optJSONArray("ayahs");
        String day = today(now);
        for (int i = 0; ayahs != null && i < ayahs.length(); i++) {
            JSONObject a = ayahs.optJSONObject(i);
            if (!day.equals(a.optString("day"))) continue;
            k.title = a.optString("text"); k.rtl = true;
            k.sub = (data.optBoolean("rtl") ? a.optString("nameAr") : a.optString("name")) + " " + a.optString("ref");
            k.url = "ayahflow://ayah/" + a.optInt("surah") + ":" + a.optInt("ayah");
            return k;
        }
        k.title = labels.optString("ayahEmpty", "Open AyahFlow to load today's verse.");
        return k;
    }
}
