package app.ayahflow.smart;

import android.content.Context;
import org.json.JSONObject;

/** Today's istighfar count against its target, as last saved by the app. */
public class DhikrWidgetProvider extends SimpleWidget {
    @Override
    Card card(Context c, JSONObject data, JSONObject labels, long now) {
        Card k = new Card();
        JSONObject x = counter(data, "istighfar", now);
        int n = x == null ? 0 : x.optInt("n"), total = x == null ? 100 : Math.max(1, x.optInt("total", 100));
        k.label = x == null ? "Istighfar" : x.optString("label", "Istighfar");
        k.title = n + " / " + total;
        k.progress = n * 100 / total;
        k.sub = n >= total ? labels.optString("goalReached", "") : labels.optString("toGo", "");
        k.url = "ayahflow://counter/istighfar";
        return k;
    }
}
