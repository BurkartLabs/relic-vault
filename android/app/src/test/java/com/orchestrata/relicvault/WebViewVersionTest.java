package com.orchestrata.relicvault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** AB#4723: the WebView check MainActivity runs before starting the game (docs/ANDROID.md). */
public class WebViewVersionTest {

    @Test
    public void readsTheMajorVersion() {
        assertEquals(120, WebViewVersion.majorOf("120.0.6099.230"));
        assertEquals(90, WebViewVersion.majorOf("90"));
        assertEquals(74, WebViewVersion.majorOf("74.0.3729.186"));
    }

    @Test
    public void noVersionIsMinusOne() {
        assertEquals(-1, WebViewVersion.majorOf(null));
        assertEquals(-1, WebViewVersion.majorOf(""));
        assertEquals(-1, WebViewVersion.majorOf("beta"));
        assertEquals(-1, WebViewVersion.majorOf("99999999999.0")); // too long to be a version, not an overflow
    }

    @Test
    public void ninetyAndNewerRunTheGame() {
        assertTrue(WebViewVersion.supported("90.0.4430.66"));
        assertTrue(WebViewVersion.supported("140.0.7339.51"));
        assertFalse(WebViewVersion.supported("89.0.4389.105"));
        assertFalse(WebViewVersion.supported(null));
    }
}
