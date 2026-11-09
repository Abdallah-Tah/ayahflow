package app.ayahflow.smart;

import android.content.Context;
import org.json.JSONObject;

/** Daily moments: a shortcut to the adhkar for driving, leaving and entering home and before sleep. It replaced the step
 * widget (the step tracker was removed in schema v29); the class keeps its old name so a widget already placed on a home
 * screen turns into this one instead of failing to load. It shows only what the app shared and claims nothing about
 * what was detected: detection stays with the reminder engine (SmartEngine). */
public class StepsWidgetProvider extends SimpleWidget {
    @Override
    Card card(Context c, JSONObject data, JSONObject labels, long now) {
        Card k = new Card();
        k.label = labels.optString("momentsTab", "Moments");
        k.title = labels.optString("momentsTitle", "Adhkar for daily moments");
        k.sub = labels.optString("m_vehicle", "Riding or travelling") + " · " + labels.optString("m_leave_home", "Leaving home") + " · "
            + labels.optString("m_enter_home", "Entering home") + " · " + labels.optString("m_sleep", "Before sleep");
        k.url = "ayahflow://adhkar";
        return k;
    }
}
