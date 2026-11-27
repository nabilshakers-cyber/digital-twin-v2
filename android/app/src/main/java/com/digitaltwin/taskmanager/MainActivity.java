package com.digitaltwin.taskmanager;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_RECORD_AUDIO_PERMISSION = 1001;
    private static final String FIREBASE_AUTH_PLUGIN_CLASS =
        "io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin";
    private String firebasePluginDiagError = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ensureFirebasePluginQueuedIfMissingFromAssets();
        super.onCreate(savedInstanceState);
        checkFirebasePluginAfterBridgeInit();
        ensureMicrophonePermission();
        attachExternalLauncherBridge();
    }

    private void ensureFirebasePluginQueuedIfMissingFromAssets() {
        try {
            if (!assetsPluginsJsonContains(FIREBASE_AUTH_PLUGIN_CLASS)) {
                Class<?> rawClass = Class.forName(FIREBASE_AUTH_PLUGIN_CLASS);
                registerPlugin(rawClass.asSubclass(Plugin.class));
            }
        } catch (Throwable t) {
            firebasePluginDiagError = t.getClass().getSimpleName() + ": " + t.getMessage();
            Logger.error("MainActivity", "Failed pre-registering FirebaseAuthenticationPlugin", t);
        }
    }

    private boolean assetsPluginsJsonContains(String className) {
        AssetManager assets = getAssets();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(assets.open("capacitor.plugins.json")))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            return sb.toString().contains(className);
        } catch (Throwable t) {
            firebasePluginDiagError = "assets-read-error: " + t.getMessage();
            return false;
        }
    }

    private void checkFirebasePluginAfterBridgeInit() {
        if (this.bridge == null) {
            firebasePluginDiagError = "bridge-is-null";
            return;
        }
        if (this.bridge.getPlugin("FirebaseAuthentication") == null && firebasePluginDiagError.isEmpty()) {
            try {
                Class<?> rawClass = Class.forName(FIREBASE_AUTH_PLUGIN_CLASS);
                firebasePluginDiagError = "class-present-but-not-in-bridge (" + rawClass.getName() + ")";
            } catch (Throwable t) {
                firebasePluginDiagError = "class-load-failed: " + t.getClass().getSimpleName() + ": " + t.getMessage();
            }
        }
    }

    private void ensureMicrophonePermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO},
                REQUEST_RECORD_AUDIO_PERMISSION
            );
        }
    }

    private void attachExternalLauncherBridge() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new ExternalAppBridge(), "AndroidExternalLauncher");
        }
    }

    public class ExternalAppBridge {
        @JavascriptInterface
        public String getCapacitorDiagnostics() {
            try {
                JSONObject json = new JSONObject();
                json.put("bridgeReady", bridge != null);
                json.put("hasFirebaseAuthentication", bridge != null && bridge.getPlugin("FirebaseAuthentication") != null);
                json.put("hasAppLauncher", bridge != null && bridge.getPlugin("AppLauncher") != null);
                json.put("hasLocalNotifications", bridge != null && bridge.getPlugin("LocalNotifications") != null);
                json.put("assetsHasFirebaseAuth", assetsPluginsJsonContains(FIREBASE_AUTH_PLUGIN_CLASS));
                json.put("diagError", firebasePluginDiagError);
                return json.toString();
            } catch (Throwable t) {
                return "{\"error\":\"" + String.valueOf(t.getMessage()) + "\"}";
            }
        }

        @JavascriptInterface
        public boolean openApp(String deepLink, String fallbackUrl) {
            String target = deepLink != null ? deepLink.trim() : "";
            String fallback = fallbackUrl != null ? fallbackUrl.trim() : "";

            // 1. WhatsApp special handling: whatsapp:// alone often has no matching Intent filter on Android
            if (target.startsWith("whatsapp://")) {
                if (launchPackage("com.whatsapp") || launchPackage("com.whatsapp.w4b")) {
                    return true;
                }
                String normalizedWa = "whatsapp://".equals(target) ? "whatsapp://send" : target;
                if (launchViewUri(normalizedWa)) {
                    return true;
                }
                if (!fallback.isEmpty() && launchViewUri(fallback)) {
                    return true;
                }
                return launchViewUri("https://wa.me/");
            }

            // 2. Other popular native app scheme shortcuts
            if (target.startsWith("tg://")) {
                if (launchPackage("org.telegram.messenger") || launchPackage("org.telegram.plus")) {
                    return true;
                }
                if (launchViewUri("tg://resolve")) return true;
                return launchViewUri(!fallback.isEmpty() ? fallback : "https://t.me/");
            }
            if (target.startsWith("notion://")) {
                if (launchPackage("notion.id") || launchViewUri(target)) return true;
                return launchViewUri(!fallback.isEmpty() ? fallback : "https://www.notion.so/");
            }
            if (target.startsWith("youtube://") || target.startsWith("vnd.youtube://")) {
                if (launchPackage("com.google.android.youtube")) {
                    return true;
                }
                if (launchViewUri("vnd.youtube://") || launchViewUri(target)) {
                    return true;
                }
                return launchViewUri(!fallback.isEmpty() ? fallback : "https://www.youtube.com/");
            }
            if (target.startsWith("instagram://")) {
                if (launchPackage("com.instagram.android") || launchViewUri(target)) return true;
                return launchViewUri(!fallback.isEmpty() ? fallback : "https://www.instagram.com/");
            }
            if (target.startsWith("twitter://")) {
                if (launchPackage("com.twitter.android") || launchViewUri(target)) return true;
                return launchViewUri(!fallback.isEmpty() ? fallback : "https://x.com/");
            }
            if (target.startsWith("spotify://")) {
                if (launchPackage("com.spotify.music") || launchViewUri(target)) return true;
                return launchViewUri(!fallback.isEmpty() ? fallback : "https://open.spotify.com/");
            }

            // 3. Generic URI Intent (custom scheme or https://)
            if (!target.isEmpty() && launchViewUri(target)) {
                return true;
            }

            // 4. Fallback browser URL if primary deepLink failed
            if (!fallback.isEmpty() && launchViewUri(fallback)) {
                return true;
            }

            return false;
        }

        private boolean launchPackage(String packageName) {
            try {
                PackageManager pm = getPackageManager();
                Intent launchIntent = pm.getLaunchIntentForPackage(packageName);
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(launchIntent);
                    return true;
                }
            } catch (Exception ignored) {
                // Fall through to URI Intent / fallback URL
            }
            return false;
        }

        private boolean launchViewUri(String uriString) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriString));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException ignored) {
                return false;
            } catch (Exception ignored) {
                return false;
            }
        }
    }
}
