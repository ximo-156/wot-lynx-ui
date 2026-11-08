package com.wotlynx.mediapicker;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Gravity;
import android.widget.TextView;
import androidx.core.content.FileProvider;
import com.lynx.react.bridge.JavaOnlyArray;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/** Private result/permission owner: Explorer needs no onActivityResult patch. */
public final class WotMediaPickerActivity extends Activity {
  private static final int ALBUM_RESULT = 6101;
  private static final int CAMERA_RESULT = 6102;
  private static final int CAMERA_PERMISSION = 6103;
  private MediaPickerRequests.Request request;
  private AlertDialog sourceDialog;
  private boolean resumed;
  private TextView status;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    String token = state == null ? getIntent().getStringExtra(MediaPickerRequests.TOKEN)
        : state.getString(MediaPickerRequests.TOKEN);
    request = MediaPickerRequests.get(token);
    if (request == null || request.settled.get()) {
      // The old JS callback cannot survive process death or a destroyed LynxView.
      // Do not relaunch a chooser/camera or invent a new callback.
      android.content.Context application = getApplicationContext();
      if (token != null) MediaPickerRequests.CLEANUP.execute(() -> MediaCache.cleanRequest(application, token, false));
      finish();
      return;
    }
    request.attach(this);
    status = new TextView(this);
    status.setGravity(Gravity.CENTER);
    status.setText("正在选择媒体…");
    status.setPadding(24, 24, 24, 24);
    setContentView(status);
  }

  @Override protected void onResume() { super.onResume(); resumed = true; continueRequest(); }
  @Override protected void onPause() { resumed = false; super.onPause(); }
  @Override protected void onSaveInstanceState(Bundle state) {
    if (request != null) state.putString(MediaPickerRequests.TOKEN, request.token);
    super.onSaveInstanceState(state);
  }

  void continueRequest() {
    if (!resumed || request == null || request.settled.get() || isFinishing()) return;
    switch (request.phase) {
      case MediaPickerRequests.Request.INITIAL:
        if (request.options.album && request.options.camera) {
          request.phase = MediaPickerRequests.Request.SOURCE_DIALOG;
          showSourceDialog();
        } else if (request.options.camera) requestCamera();
        else openAlbum();
        break;
      case MediaPickerRequests.Request.SOURCE_DIALOG: showSourceDialog(); break;
      case MediaPickerRequests.Request.CAMERA_READY: launchCamera(); break;
      case MediaPickerRequests.Request.COPYING: status.setText("正在保存所选媒体…"); break;
      default: break; // External chooser/permission is already in flight; never relaunch it.
    }
  }

  private void showSourceDialog() {
    if (sourceDialog != null && sourceDialog.isShowing()) return;
    sourceDialog = new AlertDialog.Builder(this)
        .setTitle("选择图片来源")
        .setItems(new String[] {"相册", "拍照"}, (dialog, which) -> {
          sourceDialog = null;
          if (which == 1) requestCamera(); else openAlbum();
        })
        .setOnCancelListener(dialog -> cancel())
        .create();
    sourceDialog.show();
  }

  private void openAlbum() {
    if (request.settled.get()) return;
    Intent picker = null;
    if (Build.VERSION.SDK_INT >= 33) {
      picker = new Intent(MediaStore.ACTION_PICK_IMAGES);
      if (request.options.images && !request.options.videos) picker.setType("image/*");
      if (request.options.videos && !request.options.images) picker.setType("video/*");
      if (request.options.count > 1) {
        picker.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX,
            Math.min(request.options.count, MediaStore.getPickImagesMaxLimit()));
      }
      if (picker.resolveActivity(getPackageManager()) == null) picker = null;
    }
    if (picker == null) {
      picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
      if (request.options.images && request.options.videos) {
        picker.setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"image/*", "video/*"});
      } else picker.setType(request.options.images ? "image/*" : "video/*");
      picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, request.options.count > 1);
    }
    picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    request.phase = MediaPickerRequests.Request.ALBUM_PENDING;
    try { startActivityForResult(picker, ALBUM_RESULT); }
    catch (ActivityNotFoundException error) { request.fail("ERR_PICKER_UNAVAILABLE", "No system media/document picker is installed"); }
    catch (RuntimeException error) { request.fail("ERR_PICKER", error.getMessage()); }
  }

  private void requestCamera() {
    if (!request.options.images) { request.fail("ERR_UNSUPPORTED_SOURCE", "Camera capture supports still images only"); return; }
    if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
      request.fail("ERR_CAMERA_UNAVAILABLE", "This device has no camera"); return;
    }
    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      request.phase = MediaPickerRequests.Request.CAMERA_PERMISSION;
      requestPermissions(new String[] {Manifest.permission.CAMERA}, CAMERA_PERMISSION);
      return;
    }
    prepareCamera();
  }

  @Override
  public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(code, permissions, results);
    if (code != CAMERA_PERMISSION || request == null || request.settled.get()
        || request.phase != MediaPickerRequests.Request.CAMERA_PERMISSION) return;
    if (results.length == 0 || results[0] != PackageManager.PERMISSION_GRANTED) {
      request.fail("ERR_PERMISSION_DENIED", "Camera permission was denied");
    } else prepareCamera();
  }

  private void prepareCamera() {
    if (request.settled.get()) return;
    request.phase = MediaPickerRequests.Request.PREPARING_CAMERA;
    MediaPickerRequests.Request active = request;
    active.work = MediaPickerRequests.IO.submit(() -> {
      try {
        active.checkCancelled();
        java.io.File file = MediaCache.createCameraFile(active.application, active.token);
        Uri uri = FileProvider.getUriForFile(active.application,
            active.application.getPackageName() + ".wot.media.picker.files", file);
        active.checkCancelled();
        MediaPickerRequests.MAIN.post(() -> {
          if (active.settled.get()) return;
          active.cameraFile = file;
          active.cameraUri = uri;
          active.phase = MediaPickerRequests.Request.CAMERA_READY;
          active.dispatchUi();
        });
      } catch (Exception error) { active.fail("ERR_CAMERA_OUTPUT", error.getMessage()); }
      finally { if (active.settled.get() && !active.keepFiles) MediaCache.cleanRequest(active.application, active.token, false); }
    });
  }

  private void launchCamera() {
    if (request.cameraUri == null || request.cameraFile == null) {
      request.fail("ERR_CAMERA_OUTPUT", "Camera output is unavailable"); return;
    }
    Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
    camera.putExtra(MediaStore.EXTRA_OUTPUT, request.cameraUri);
    camera.setClipData(ClipData.newRawUri("WotMediaPicker camera output", request.cameraUri));
    camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    request.phase = MediaPickerRequests.Request.CAMERA_PENDING;
    try { startActivityForResult(camera, CAMERA_RESULT); }
    catch (ActivityNotFoundException error) { request.fail("ERR_CAMERA_UNAVAILABLE", "No still-photo camera app is installed"); }
    catch (SecurityException error) { request.fail("ERR_PERMISSION_DENIED", error.getMessage()); }
    catch (RuntimeException error) { request.fail("ERR_CAMERA", error.getMessage()); }
  }

  @Override
  protected void onActivityResult(int code, int result, Intent data) {
    super.onActivityResult(code, result, data);
    if (request == null || request.settled.get()) return;
    if (code != ALBUM_RESULT && code != CAMERA_RESULT) return;
    if (code == ALBUM_RESULT && request.phase != MediaPickerRequests.Request.ALBUM_PENDING) return;
    if (code == CAMERA_RESULT && request.phase != MediaPickerRequests.Request.CAMERA_PENDING) return;
    if (result != RESULT_OK) { cancel(); return; }
    List<Uri> uris = new ArrayList<>();
    if (code == CAMERA_RESULT) {
      if (request.cameraFile == null || request.cameraUri == null) {
        request.fail("ERR_CAMERA_OUTPUT", "Camera output URI is unavailable"); return;
      }
      uris.add(request.cameraUri);
    } else {
      LinkedHashSet<Uri> unique = new LinkedHashSet<>();
      if (data != null && data.getClipData() != null) {
        ClipData clips = data.getClipData();
        for (int i = 0; i < clips.getItemCount() && unique.size() < request.options.count; i++) {
          Uri uri = clips.getItemAt(i).getUri();
          if (uri != null) unique.add(uri);
        }
      }
      if (data != null && data.getData() != null && unique.size() < request.options.count) unique.add(data.getData());
      uris.addAll(unique);
    }
    if (uris.isEmpty()) { request.fail("ERR_EMPTY_SELECTION", "The system picker returned no media URI"); return; }
    copySelected(uris);
  }

  private void copySelected(List<Uri> uris) {
    MediaPickerRequests.Request active = request;
    active.phase = MediaPickerRequests.Request.COPYING;
    status.setText("正在保存所选媒体…");
    active.work = MediaPickerRequests.IO.submit(() -> {
      try {
        JavaOnlyArray files = new JavaOnlyArray();
        for (Uri uri : uris) {
          active.checkCancelled();
          files.pushMap(MediaCache.copyMedia(active, uri));
        }
        active.checkCancelled();
        MediaPickerRequests.MAIN.post(() -> active.success(files));
      } catch (SecurityException error) { active.fail("ERR_URI_PERMISSION", error.getMessage()); }
      catch (Exception error) { active.fail("ERR_MEDIA_COPY", error.getMessage()); }
      finally { if (active.settled.get() && !active.keepFiles) MediaCache.cleanRequest(active.application, active.token, false); }
    });
  }

  private void cancel() { if (request != null) request.fail("ERR_CANCELLED", "cancel"); finish(); }
  @Override public void onBackPressed() { cancel(); }
  @Override protected void onDestroy() {
    if (sourceDialog != null) { sourceDialog.dismiss(); sourceDialog = null; }
    if (request != null) {
      request.detach(this);
      if (isFinishing() && !isChangingConfigurations() && !request.settled.get()) request.fail("ERR_CANCELLED", "cancel");
    }
    super.onDestroy();
  }
}
