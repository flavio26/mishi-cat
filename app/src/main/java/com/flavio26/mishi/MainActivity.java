package com.flavio26.mishi;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/** Offline-only shell. No network permission, native JS bridge or external navigation. */
public final class MainActivity extends Activity {
    private WebView web;
    private static final String HOST = "mishi.local";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247,241,232));
        setContentView(web);
        View root = findViewById(android.R.id.content);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                return insets.consumeSystemWindowInsets();
            }
        });
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()) || path == null || path.contains("..")) {
                    return denied();
                }
                if (path.equals("/")) path = "/index.html";
                String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" :
                        path.endsWith(".js") ? "application/javascript" : path.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
                try {
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers,
                            getAssets().open(path.substring(1)));
                } catch (IOException e) { return denied(); }
            }
        });
        web.loadUrl("https://" + HOST + "/index.html");
    }
    private static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }
    @Override protected void onPause() {
        web.evaluateJavascript("window.dispatchEvent(new Event('mishi-pause'))", null);
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.dispatchEvent(new Event('mishi-resume'))", null); }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.dispatchEvent(new Event('mishi-back', {cancelable:true}))", new ValueCallback<String>() {
            @Override public void onReceiveValue(String result) {
                if (!"false".equals(result)) moveTaskToBack(true);
            }
        });
    }
    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
