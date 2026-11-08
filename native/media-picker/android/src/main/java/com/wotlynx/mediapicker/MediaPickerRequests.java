package com.wotlynx.mediapicker;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.lynx.react.bridge.Callback;
import com.lynx.react.bridge.JavaOnlyArray;
import com.lynx.react.bridge.JavaOnlyMap;
import java.io.Closeable;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.lang.ref.WeakReference;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Owns callbacks, not Activities. Survives configuration recreation in the same process. */
final class MediaPickerRequests {
  static final Handler MAIN = new Handler(Looper.getMainLooper());
  static final ExecutorService IO = Executors.newFixedThreadPool(2);
  static final ExecutorService CLEANUP = Executors.newSingleThreadExecutor();
  static final String TOKEN = "com.wotlynx.mediapicker.REQUEST_TOKEN";
  static final long TIMEOUT_MS = 15 * 60 * 1000L;
  private static final Map<String, Request> ACTIVE = new ConcurrentHashMap<>();

  private MediaPickerRequests() {}

  static void begin(WotMediaPickerModule owner, Context context, PickerOptions options, Callback callback) {
    Activity activity = findActivity(context);
    if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
      replyError(callback, "ERR_NO_ACTIVITY", "No live Explorer Activity owns this page");
      return;
    }
    if (!ACTIVE.isEmpty()) {
      replyError(callback, "ERR_BUSY", "Another media picker is already active");
      return;
    }
    Context appContext = activity.getApplicationContext();
    Request request = new Request(owner, appContext, activity, options, callback);
    ACTIVE.put(request.token, request);
    owner.track(request.token);
    if (owner.isDestroyed()) { request.complete(null, false); return; }
    request.watchOwner(activity);
    MAIN.postDelayed(request.deadline, TIMEOUT_MS);
    try {
      activity.startActivity(new Intent(activity, WotMediaPickerActivity.class).putExtra(TOKEN, request.token));
    } catch (RuntimeException error) {
      request.fail("ERR_HOST_CONFIGURATION", "Cannot open proxy Activity; merge the kit manifest: " + error.getMessage());
    }
  }

  static Request get(String token) { return token == null ? null : ACTIVE.get(token); }

  static void abort(String token) {
    Request request = get(token);
    if (request != null) request.complete(null, false);
  }

  static void replyError(Callback callback, String code, String message) {
    JavaOnlyMap result = error(code, message);
    MAIN.post(() -> invoke(callback, result));
  }

  static JavaOnlyMap error(String code, String message) {
    JavaOnlyMap result = new JavaOnlyMap();
    result.putBoolean("success", false);
    result.putString("code", code);
    result.putString("errMsg", "chooseMedia:fail " + (message == null ? code : message));
    return result;
  }

  private static void invoke(Callback callback, JavaOnlyMap result) {
    if (callback == null) return;
    try { callback.invoke(result); }
    catch (RuntimeException error) { Log.w("WotMediaPicker", "The Lynx callback runtime is no longer available", error); }
  }

  private static Activity findActivity(Context context) {
    Context current = context;
    for (int depth = 0; current != null && depth < 32; depth++) {
      if (current instanceof Activity) return (Activity) current;
      if (!(current instanceof ContextWrapper)) return null;
      Context next = ((ContextWrapper) current).getBaseContext();
      if (next == current) return null;
      current = next;
    }
    return null;
  }

  static final class Request {
    static final int INITIAL = 0;
    static final int SOURCE_DIALOG = 1;
    static final int CAMERA_PERMISSION = 2;
    static final int PREPARING_CAMERA = 3;
    static final int CAMERA_READY = 4;
    static final int ALBUM_PENDING = 5;
    static final int CAMERA_PENDING = 6;
    static final int COPYING = 7;
    final String token = UUID.randomUUID().toString();
    final Context application;
    final PickerOptions options;
    final AtomicBoolean settled = new AtomicBoolean(false);
    final AtomicReference<Boolean> terminal = new AtomicReference<>();
    final AtomicReference<Closeable> input = new AtomicReference<>();
    final WeakReference<WotMediaPickerModule> owner;
    final Runnable deadline = () -> fail("ERR_TIMEOUT", "Media selection timed out");
    volatile Callback callback;
    volatile boolean keepFiles;
    volatile Future<?> work;
    // The following state belongs to the main thread, not the destroyed Activity.
    int phase = INITIAL;
    java.io.File cameraFile;
    Uri cameraUri;
    WeakReference<WotMediaPickerActivity> ui = new WeakReference<>(null);
    Application.ActivityLifecycleCallbacks lifecycle;

    Request(WotMediaPickerModule owner, Context application, Activity activity, PickerOptions options, Callback callback) {
      this.owner = new WeakReference<>(owner);
      this.application = application;
      this.options = options;
      this.callback = callback;
    }

    void attach(WotMediaPickerActivity activity) { ui = new WeakReference<>(activity); }
    void detach(WotMediaPickerActivity activity) { if (ui.get() == activity) ui.clear(); }
    void dispatchUi() {
      WotMediaPickerActivity activity = ui.get();
      if (activity != null && !activity.isFinishing() && !activity.isDestroyed()) activity.continueRequest();
    }

    void watchOwner(Activity activity) {
      if (!(application instanceof Application)) return;
      WeakReference<Activity> ownerActivity = new WeakReference<>(activity);
      lifecycle = new Application.ActivityLifecycleCallbacks() {
        @Override public void onActivityDestroyed(Activity destroyed) {
          if (ownerActivity.get() == destroyed && !destroyed.isChangingConfigurations()) {
            fail("ERR_HOST_DESTROYED", "The owning Explorer Activity was destroyed");
          }
        }
        @Override public void onActivityCreated(Activity activity, Bundle state) {}
        @Override public void onActivityStarted(Activity activity) {}
        @Override public void onActivityResumed(Activity activity) {}
        @Override public void onActivityPaused(Activity activity) {}
        @Override public void onActivityStopped(Activity activity) {}
        @Override public void onActivitySaveInstanceState(Activity activity, Bundle state) {}
      };
      ((Application) application).registerActivityLifecycleCallbacks(lifecycle);
    }

    void checkCancelled() throws InterruptedIOException {
      if (settled.get() || Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Media request was cancelled");
    }

    void ownInput(Closeable stream) throws IOException {
      checkCancelled();
      input.set(stream);
      if (settled.get()) { releaseInput(stream); throw new InterruptedIOException("Media request was cancelled"); }
    }

    void releaseInput(Closeable stream) {
      input.compareAndSet(stream, null);
      try { if (stream != null) stream.close(); } catch (IOException ignored) {}
    }

    void success(JavaOnlyArray files) {
      JavaOnlyMap result = new JavaOnlyMap();
      result.putBoolean("success", true);
      result.putArray("tempFiles", files);
      complete(result, true);
    }

    void fail(String code, String message) { complete(error(code, message), true); }

    /** The atomic gate covers result, back/cancel, timeout and LynxModule.destroy races. */
    void complete(JavaOnlyMap result, boolean deliver) {
      boolean keepPickedFiles = result != null && result.getBoolean("success", false);
      if (!terminal.compareAndSet(null, keepPickedFiles)) return;
      keepFiles = keepPickedFiles;
      settled.set(true);
      Callback pending = callback;
      callback = null; // Release the JS runtime even when UI work is queued.
      ACTIVE.remove(token, this);
      WotMediaPickerModule module = owner.get();
      if (module != null) module.forget(token);
      Future<?> task = work;
      if (task != null && !task.isDone()) task.cancel(true);
      Closeable stream = input.getAndSet(null);
      CLEANUP.execute(() -> {
        try { if (stream != null) stream.close(); } catch (IOException ignored) {}
        MediaCache.cleanRequest(application, token, keepPickedFiles);
      });
      MAIN.post(() -> {
        MAIN.removeCallbacks(deadline);
        if (lifecycle != null && application instanceof Application) {
          ((Application) application).unregisterActivityLifecycleCallbacks(lifecycle);
          lifecycle = null;
        }
        if (cameraUri != null) {
          try { application.revokeUriPermission(cameraUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); }
          catch (RuntimeException ignored) {}
          cameraUri = null;
        }
        WotMediaPickerActivity activity = ui.get();
        ui.clear();
        if (activity != null && !activity.isFinishing() && !activity.isDestroyed()) activity.finish();
        WotMediaPickerModule liveOwner = owner.get();
        if (deliver && liveOwner != null && !liveOwner.isDestroyed()) invoke(pending, result);
      });
    }
  }
}
