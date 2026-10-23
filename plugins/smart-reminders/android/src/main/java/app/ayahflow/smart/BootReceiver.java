package app.ayahflow.smart;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Geofences and activity transitions are cleared by a reboot or app update; restore them from the saved configuration. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) SmartEngine.apply(context);
    }
}
