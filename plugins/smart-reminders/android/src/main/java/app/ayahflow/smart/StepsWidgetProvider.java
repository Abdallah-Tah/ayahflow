package app.ayahflow.smart;

import android.content.Context;
import org.json.JSONObject;

/** Today's steps against the goal, as last read by the app (step tracking must be on). */
public class StepsWidgetProvider extends SimpleWidget {
    @Override
    Card card(Context c, JSONObject data, JSONObject labels, long now) {
        Card k = new Card();
        k.label = labels.optString("stepsTab", "Steps");
        k.url = "ayahflow://steps";
        JSONObject daily = data.optJSONObject("daily"), st = daily == null || !today(now).equals(daily.optString("day")) ? null : daily.optJSONObject("steps");
        if (st == null) { k.title = labels.optString("stepsOff", "Turn on step tracking in AyahFlow to see steps here."); return k; }
        int today = st.optInt("today"), goal = Math.max(1, st.optInt("goal", 5000));
        k.title = today + " / " + goal;
        k.progress = today * 100 / goal;
        return k;
    }
}
