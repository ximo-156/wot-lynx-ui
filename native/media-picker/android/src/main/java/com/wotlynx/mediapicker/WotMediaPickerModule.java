package com.wotlynx.mediapicker;

import android.content.Context;
import android.util.Log;
import com.lynx.jsbridge.LynxMethod;
import com.lynx.jsbridge.LynxModule;
import com.lynx.react.bridge.Callback;
import com.lynx.react.bridge.ReadableMap;
import java.util.ArrayList;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/** Register this class under the native name WotMediaPicker. */
public final class WotMediaPickerModule extends LynxModule {
  private final AtomicBoolean destroyed = new AtomicBoolean(false);
  private final Set<String> requests = ConcurrentHashMap.newKeySet();

  public WotMediaPickerModule(Context context) { super(context); }

  @LynxMethod
  public void chooseMedia(ReadableMap options, Callback callback) {
    if (callback == null) {
      Log.e("WotMediaPicker", "chooseMedia requires a separate callback parameter");
      return;
    }
    final PickerOptions copy;
    try {
      copy = PickerOptions.parse(options);
    } catch (RuntimeException error) {
      MediaPickerRequests.replyError(callback, "ERR_INVALID_OPTIONS", error.getMessage());
      return;
    }
    // UI is posted explicitly; the Lynx method may execute on a JS/native thread.
    MediaPickerRequests.MAIN.post(() -> {
      if (destroyed.get()) return; // The old JS runtime no longer owns a callback.
      MediaPickerRequests.begin(this, mContext, copy, callback);
    });
  }

  boolean isDestroyed() { return destroyed.get(); }
  void track(String token) { requests.add(token); }
  void forget(String token) { requests.remove(token); }

  @Override
  public void destroy() {
    if (destroyed.compareAndSet(false, true)) {
      for (String token : new ArrayList<>(requests)) MediaPickerRequests.abort(token);
      requests.clear();
    }
    super.destroy();
  }
}
