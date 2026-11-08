package com.wotlynx.mediapicker;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import com.lynx.react.bridge.JavaOnlyMap;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;

/** All methods run on an I/O executor. Never return content:// or fake paths to JS. */
final class MediaCache {
  private static final long STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000L;
  private MediaCache() {}

  static File createCameraFile(Context context, String token) throws IOException {
    File staging = directory(context, "staging", token);
    File output = new File(staging, "capture.jpg");
    if (!output.createNewFile() && !output.isFile()) throw new IOException("Cannot create camera output file");
    return output;
  }

  static JavaOnlyMap copyMedia(MediaPickerRequests.Request request, Uri uri) throws IOException {
    request.checkCancelled();
    if (uri == null || !"content".equalsIgnoreCase(uri.getScheme())) {
      throw new IOException("The picker did not return a grantable content URI");
    }
    ContentResolver resolver = request.application.getContentResolver();
    String name = displayName(resolver, uri);
    String mime = resolver.getType(uri);
    if (mime == null || (!mime.startsWith("image/") && !mime.startsWith("video/"))) {
      int dot = name.lastIndexOf('.');
      String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
      mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
    }
    String kind = mime != null && mime.startsWith("image/") ? "image"
        : mime != null && mime.startsWith("video/") ? "video" : null;
    if (kind == null || ("image".equals(kind) && !request.options.images)
        || ("video".equals(kind) && !request.options.videos)) {
      throw new IOException("Selected URI is not an allowed image/video MIME type");
    }
    String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
    if (extension == null || !extension.matches("[A-Za-z0-9]{1,10}")) {
      int dot = name.lastIndexOf('.');
      extension = dot < 0 ? ("image".equals(kind) ? "img" : "video") : name.substring(dot + 1);
      if (!extension.matches("[A-Za-z0-9]{1,10}")) extension = "image".equals(kind) ? "img" : "video";
    }
    if (name.isEmpty()) name = "selected-media." + extension;
    File folder = directory(request.application, "picked", request.token);
    request.checkCancelled();
    String safe = name.replaceAll("[^\\p{L}\\p{N}._-]", "_");
    if (safe.length() > 80) safe = safe.substring(0, 80);
    if (safe.isEmpty()) safe = "media";
    String id = UUID.randomUUID().toString();
    File part = new File(folder, id + ".part");
    File target = new File(folder, id + "-" + safe + "." + extension.toLowerCase(Locale.ROOT));
    InputStream input = resolver.openInputStream(uri);
    if (input == null) throw new IOException("Cannot open selected media URI");
    try {
      request.ownInput(input);
      try (FileOutputStream output = new FileOutputStream(part)) {
        byte[] buffer = new byte[64 * 1024];
        while (true) {
          request.checkCancelled();
          int count = input.read(buffer);
          if (count == -1) break;
          if (count > 0) output.write(buffer, 0, count);
        }
        output.getFD().sync();
      }
    } finally { request.releaseInput(input); }
    request.checkCancelled();
    if (!part.isFile() || part.length() == 0) throw new IOException("Selected media has no readable bytes");
    if (!part.renameTo(target)) throw new IOException("Cannot finalize private media cache file");
    JavaOnlyMap result = new JavaOnlyMap();
    result.putString("fileType", kind);
    result.putString("tempFilePath", target.getAbsolutePath());
    result.putString("name", name);
    result.putLong("size", target.length()); // Actual copied bytes, not untrusted URI metadata.
    if ("image".equals(kind)) {
      BitmapFactory.Options bounds = new BitmapFactory.Options();
      bounds.inJustDecodeBounds = true;
      BitmapFactory.decodeFile(target.getAbsolutePath(), bounds);
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("Selected image cannot be decoded by Android");
    } else videoMetadata(request, target, result);
    request.checkCancelled();
    return result;
  }

  private static String displayName(ContentResolver resolver, Uri uri) {
    try (Cursor cursor = resolver.query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (column >= 0 && !cursor.isNull(column)) return cursor.getString(column);
      }
    } catch (RuntimeException ignored) {}
    return "";
  }

  private static void videoMetadata(MediaPickerRequests.Request request, File video, JavaOnlyMap result) throws IOException {
    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
    Bitmap frame = null;
    Bitmap thumbnail = null;
    try {
      retriever.setDataSource(video.getAbsolutePath());
      String duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
      if (duration != null) {
        try { result.putDouble("duration", Long.parseLong(duration) / 1000.0); }
        catch (NumberFormatException ignored) {}
      }
      request.checkCancelled();
      // A thumbnail is optional. Failures do not turn a valid cached video into
      // a fake file; the returned video path and byte size remain real.
      try {
        if (Build.VERSION.SDK_INT >= 27) {
          frame = retriever.getScaledFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 480, 480);
        } else frame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
        if (frame != null) {
          double scale = Math.min(1.0, 480.0 / Math.max(frame.getWidth(), frame.getHeight()));
          thumbnail = Bitmap.createScaledBitmap(frame,
              Math.max(1, (int) (frame.getWidth() * scale)), Math.max(1, (int) (frame.getHeight() * scale)), true);
          File path = new File(video.getParentFile(), UUID.randomUUID() + "-thumb.jpg");
          try (FileOutputStream output = new FileOutputStream(path)) {
            if (!thumbnail.compress(Bitmap.CompressFormat.JPEG, 82, output)) throw new IOException("Cannot encode video thumbnail");
          }
          if (path.length() > 0) result.putString("thumbTempFilePath", path.getAbsolutePath());
        }
      } catch (RuntimeException | OutOfMemoryError | IOException ignored) {}
    } catch (RuntimeException error) { throw new IOException("Selected video cannot be read by Android", error); }
    finally {
      if (thumbnail != null && thumbnail != frame) thumbnail.recycle();
      if (frame != null) frame.recycle();
      try { retriever.release(); } catch (Exception ignored) {}
    }
  }

  private static File directory(Context context, String category, String token) throws IOException {
    if (!validToken(token)) throw new IOException("Invalid media request token");
    File root = new File(context.getCacheDir(), "wot-media-picker");
    File categoryRoot = new File(root, category);
    File directory = new File(categoryRoot, token);
    requireOwned(root, directory);
    pruneStaging(context, token);
    if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create private media cache directory");
    return directory;
  }

  static void cleanRequest(Context context, String token, boolean keepPickedFiles) {
    if (!validToken(token)) return;
    File root = new File(context.getCacheDir(), "wot-media-picker");
    deleteOwned(root, new File(new File(root, "staging"), token));
    if (!keepPickedFiles) deleteOwned(root, new File(new File(root, "picked"), token));
  }

  private static void pruneStaging(Context context, String active) {
    File root = new File(context.getCacheDir(), "wot-media-picker");
    File staging = new File(root, "staging");
    File[] folders = staging.listFiles();
    if (folders == null) return;
    long cutoff = System.currentTimeMillis() - STAGING_MAX_AGE_MS;
    for (File folder : folders) {
      if (!folder.getName().equals(active) && validToken(folder.getName()) && folder.lastModified() < cutoff) deleteOwned(root, folder);
    }
  }

  private static boolean validToken(String token) {
    return token != null && token.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
  }

  private static void requireOwned(File root, File target) throws IOException {
    if (!target.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) throw new IOException("Media cache path escaped its private root");
  }

  private static void deleteOwned(File root, File target) {
    try {
      requireOwned(root, target);
      if (target.isDirectory()) {
        File[] files = target.listFiles();
        if (files != null) for (File file : files) deleteOwned(root, file);
      }
      if (target.exists() && !target.delete()) android.util.Log.w("WotMediaPicker", "Cannot remove private temporary media file");
    } catch (IOException ignored) {}
  }
}
