package com.orchestrata.relicvault;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Bundle;
import android.widget.TextView;
import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.WebViewCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Relic Vault's Android shell (AB#4723, docs/ANDROID.md): Capacitor's WebView running the same web build as the PWA.
 *
 * - The splash is Android 12's SplashScreen API on every version: the vault's icon on #07060B.
 * - The window is edge to edge on every version (mandatory from API 35); Capacitor's SystemBars plugin hands the
 *   insets to the page, where measureSafe() turns them into the HUD's and the Dock's offsets.
 * - An Android System WebView older than {@link WebViewVersion#MIN_MAJOR} cannot run the game (its bundle would not even
 *   parse), so the bridge is never started and a plain native screen asks the player to update it.
 */
public class MainActivity extends BridgeActivity {

    private static final String WEBVIEW_PACKAGE = "com.google.android.webview";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this); // before super.onCreate, as the compat library requires
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
    }

    @Override
    protected void load() {
        String version = webViewVersionName(this);
        if (!WebViewVersion.supported(version)) {
            showWebViewUpdate(WebViewVersion.majorOf(version));
            return; // no bridge: BridgeActivity's lifecycle methods all allow for a null one
        }
        super.load();
    }

    /** The current WebView provider's version name, or null when there is none. */
    private static String webViewVersionName(Context context) {
        PackageInfo webView = WebViewCompat.getCurrentWebViewPackage(context);
        return webView == null ? null : webView.versionName;
    }

    private void showWebViewUpdate(int major) {
        setContentView(R.layout.webview_update);
        if (major > 0) {
            TextView found = findViewById(R.id.webview_update_found);
            found.setText(getString(R.string.webview_update_found, major, WebViewVersion.MIN_MAJOR));
        }
        findViewById(R.id.webview_update_button).setOnClickListener((v) -> openWebViewInStore());
    }

    private void openWebViewInStore() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + WEBVIEW_PACKAGE)));
        } catch (ActivityNotFoundException noStore) {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + WEBVIEW_PACKAGE)));
        }
    }
}
