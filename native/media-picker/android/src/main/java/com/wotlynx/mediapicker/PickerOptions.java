package com.wotlynx.mediapicker;

import com.lynx.react.bridge.ReadableArray;
import com.lynx.react.bridge.ReadableMap;
import com.lynx.react.bridge.ReadableType;
import java.util.LinkedHashSet;
import java.util.Set;

/** Immutable copy: never retain a JS bridge map after the native method returns. */
final class PickerOptions {
  static final int MAX_COUNT = 50;
  final int count;
  final boolean images;
  final boolean videos;
  final boolean album;
  final boolean camera;

  private PickerOptions(int count, boolean images, boolean videos, boolean album, boolean camera) {
    this.count = count;
    this.images = images;
    this.videos = videos;
    this.album = album;
    this.camera = camera;
  }

  static PickerOptions parse(ReadableMap map) {
    if (map == null) throw new IllegalArgumentException("options must be an object");
    double number = 1;
    if (present(map, "count")) {
      ReadableType type = map.getType("count");
      if (type != ReadableType.Number && type != ReadableType.Int && type != ReadableType.Long) {
        throw new IllegalArgumentException("count must be a number");
      }
      number = map.getDouble("count");
    }
    if (Double.isNaN(number) || Double.isInfinite(number) || number != Math.rint(number)
        || number < 1 || number > MAX_COUNT) {
      throw new IllegalArgumentException("count must be an integer from 1 to " + MAX_COUNT);
    }
    int count = (int) number;
    if (present(map, "multiple")) {
      if (map.getType("multiple") != ReadableType.Boolean) {
        throw new IllegalArgumentException("multiple must be a boolean");
      }
      if (!map.getBoolean("multiple")) count = 1;
    }
    Set<String> media = strings(map, "mediaType", "image", new String[] {"image", "video"});
    Set<String> source = strings(map, "sourceType", "album", new String[] {"album", "camera"});
    boolean images = media.contains("image");
    boolean album = source.contains("album");
    boolean camera = source.contains("camera") && images;
    if (!album && !camera) {
      throw new IllegalArgumentException("Camera capture supports still images only; use album for videos");
    }
    return new PickerOptions(count, images, media.contains("video"), album, camera);
  }

  private static boolean present(ReadableMap map, String key) {
    return map.hasKey(key) && !map.isNull(key);
  }

  private static Set<String> strings(ReadableMap map, String key, String fallback, String[] allowed) {
    Set<String> values = new LinkedHashSet<>();
    if (!present(map, key)) { values.add(fallback); return values; }
    if (map.getType(key) != ReadableType.Array) throw new IllegalArgumentException(key + " must be an array");
    ReadableArray array = map.getArray(key);
    if (array == null || array.size() == 0) throw new IllegalArgumentException(key + " must not be empty");
    for (int i = 0; i < array.size(); i++) {
      if (array.getType(i) != ReadableType.String) throw new IllegalArgumentException(key + " entries must be strings");
      String value = array.getString(i);
      boolean known = false;
      for (String candidate : allowed) if (candidate.equals(value)) known = true;
      if (!known) throw new IllegalArgumentException("Unsupported " + key + ": " + value);
      values.add(value);
    }
    return values;
  }
}
