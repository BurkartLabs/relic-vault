package com.madgod_games.relic_vault;

/**
 * AB#4723: the Android System WebView version the game needs, and reading one. Pure Java, so a JVM unit test covers it
 * (WebViewVersionTest); MainActivity asks the device for the version and decides with {@link #supported(String)}.
 */
final class WebViewVersion {

    /** The oldest Android System WebView (Chromium major version) the game supports. */
    static final int MIN_MAJOR = 90;

    private WebViewVersion() {}

    /** "120.0.6099.230" is 120; null, empty or anything without a leading number is -1. */
    static int majorOf(String versionName) {
        if (versionName == null) return -1;
        int end = 0;
        while (end < versionName.length() && Character.isDigit(versionName.charAt(end))) end++;
        if (end == 0 || end > 9) return -1;
        return Integer.parseInt(versionName.substring(0, end));
    }

    /** Whether a WebView of this version name can run the game. No WebView, or an unreadable version, cannot. */
    static boolean supported(String versionName) {
        return majorOf(versionName) >= MIN_MAJOR;
    }
}
