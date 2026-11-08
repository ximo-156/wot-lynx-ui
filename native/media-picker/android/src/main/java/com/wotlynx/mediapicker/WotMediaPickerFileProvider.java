package com.wotlynx.mediapicker;

import androidx.core.content.FileProvider;

/** A private provider subclass avoids collision with other host FileProvider entries. */
public final class WotMediaPickerFileProvider extends FileProvider {
  public WotMediaPickerFileProvider() { super(); }
}
