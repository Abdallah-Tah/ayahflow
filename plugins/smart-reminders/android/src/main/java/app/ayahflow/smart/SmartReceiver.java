package app.ayahflow.smart;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Receives geofence transitions and vehicle activity transitions while the app is closed. */
public class SmartReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        List<String> events = new ArrayList<>();
        if (SmartEngine.ACTION_GEOFENCE.equals(intent.getAction())) {
            GeofencingEvent event = GeofencingEvent.fromIntent(intent);
            if (event == null || event.hasError() || event.getTriggeringGeofences() == null) return;
            String kind = event.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_ENTER ? "ENTER_" : event.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_EXIT ? "EXIT_" : null;
            if (kind == null) return;
            for (Geofence g : event.getTriggeringGeofences()) {
                String id = g.getRequestId();
                if (id.equals("home") || id.equals("work") || id.equals("mosque")) events.add(kind + id.toUpperCase(Locale.US));
            }
        } else if (SmartEngine.ACTION_ACTIVITY.equals(intent.getAction()) && ActivityTransitionResult.hasResult(intent)) {
            ActivityTransitionResult result = ActivityTransitionResult.extractResult(intent);
            if (result == null) return;
            for (ActivityTransitionEvent e : result.getTransitionEvents())
                if (e.getActivityType() == DetectedActivity.IN_VEHICLE && e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER && !events.contains("ENTER_VEHICLE")) events.add("ENTER_VEHICLE");
        }
        if (!events.isEmpty()) SmartEngine.handle(context, events, System.currentTimeMillis());
    }
}
