package com.digitaltwin.taskmanager;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_RECORD_AUDIO_PERMISSION = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureMicrophonePermission();
        attachExternalLauncherBridge();
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
