#!/usr/bin/env python3
"""Legitimate static checks only: this does NOT compile or emulate Android."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID = '{http://schemas.android.com/apk/res/android}'
JAVA = ROOT / 'src/main/java/com/wotlynx/mediapicker'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def lexical_balance(source, filename):
    # A structural lexer, not a Java compiler. Skip comments, strings and chars;
    # mismatched braces/parentheses/brackets or unterminated literals are errors.
    pairs = {'(': ')', '[': ']', '{': '}'}
    stack = []
    i = 0
    while i < len(source):
        if source.startswith('//', i):
            end = source.find('\n', i + 2)
            i = len(source) if end < 0 else end + 1
            continue
        if source.startswith('/*', i):
            end = source.find('*/', i + 2)
            require(end >= 0, f'{filename}: unterminated block comment')
            i = end + 2
            continue
        ch = source[i]
        if ch in ('"', "'"):
            quote = ch
            i += 1
            while i < len(source):
                if source[i] == '\\':
                    i += 2
                    continue
                if source[i] == quote:
                    i += 1
                    break
                require(source[i] not in '\r\n', f'{filename}: newline in literal')
                i += 1
            else:
                raise AssertionError(f'{filename}: unterminated literal')
            continue
        if ch in pairs:
            stack.append((pairs[ch], i))
        elif ch in ')]}':
            require(stack and stack[-1][0] == ch, f'{filename}: unmatched {ch} at {i}')
            stack.pop()
        i += 1
    require(not stack, f'{filename}: unclosed delimiters {stack}')


def main():
    manifest = ET.parse(ROOT / 'src/main/AndroidManifest.xml').getroot()
    application = manifest.find('application')
    require(application is not None, 'Manifest must declare application components')
    activity = application.find('activity')
    provider = application.find('provider')
    require(activity.get(ANDROID + 'name') == 'com.wotlynx.mediapicker.WotMediaPickerActivity', 'Proxy Activity class mismatch')
    require(activity.get(ANDROID + 'exported') == 'false', 'Proxy Activity must not be exported')
    require(provider.get(ANDROID + 'name') == 'com.wotlynx.mediapicker.WotMediaPickerFileProvider', 'Provider class mismatch')
    require(provider.get(ANDROID + 'authorities') == '${applicationId}.wot.media.picker.files', 'Provider authority mismatch')
    require(provider.get(ANDROID + 'exported') == 'false' and provider.get(ANDROID + 'grantUriPermissions') == 'true', 'Provider exposure/grant mismatch')
    permissions = {node.get(ANDROID + 'name') for node in manifest.findall('uses-permission')}
    require('android.permission.CAMERA' in permissions, 'Camera permission missing')
    require(not any('READ_EXTERNAL_STORAGE' in value or 'READ_MEDIA_' in value for value in permissions), 'Broad album storage permissions must not be required')
    paths = ET.parse(ROOT / 'src/main/res/xml/wot_media_picker_paths.xml').getroot()
    require(len(paths) == 1 and paths[0].tag == 'cache-path' and paths[0].get('path') == 'wot-media-picker/staging/', 'Only camera staging may be exposed')
    styles = ET.parse(ROOT / 'src/main/res/values/styles.xml').getroot()
    require(any(style.get('name') == 'WotMediaPickerProxyTheme' for style in styles.findall('style')), 'Proxy theme missing')
    files = sorted(JAVA.glob('*.java'))
    require(len(files) == 6, 'Expected six implementation classes')
    source = {}
    for path in files:
        text = path.read_text(encoding='utf-8')
        require('package com.wotlynx.mediapicker;' in text, f'{path.name}: package mismatch')
        require('UnsupportedOperationException' not in text, f'{path.name}: fake implementation')
        lexical_balance(text, path.name)
        source[path.stem] = text
    module = source['WotMediaPickerModule']
    require(re.search(r'@LynxMethod\s+public void chooseMedia\(ReadableMap options, Callback callback\)', module), 'Actual Lynx method signature/separate callback missing')
    require('extends LynxModule' in module and 'super(context)' in module, 'Actual LynxModule constructor missing')
    require('public void destroy()' in module and 'MediaPickerRequests.abort(token)' in module, 'SDK destroy cleanup missing')
    activity_text = source['WotMediaPickerActivity']
    for token in ['MediaStore.ACTION_PICK_IMAGES', 'Intent.ACTION_OPEN_DOCUMENT', 'MediaStore.ACTION_IMAGE_CAPTURE', 'MediaStore.EXTRA_OUTPUT', 'FileProvider.getUriForFile', 'requestPermissions', 'onSaveInstanceState', 'onActivityResult']:
        require(token in activity_text, f'Real system integration missing: {token}')
    require('MediaPickerRequests.IO.submit' in activity_text, 'Copy/preparation must run off main')
    cache = source['MediaCache']
    for token in ['resolver.openInputStream(uri)', 'output.write(buffer, 0, count)', 'target.getAbsolutePath()', 'target.length()', 'requireOwned(root, target)', 'getCanonicalPath()', 'getScaledFrameAtTime']:
        require(token in cache, f'Real private cache implementation missing: {token}')
    require('_data' not in cache, 'Do not resolve content URIs using legacy _data columns')
    request = source['MediaPickerRequests']
    require('terminal.compareAndSet(null, keepPickedFiles)' in request, 'Unique terminal callback gate missing')
    require(request.index('keepFiles = keepPickedFiles') < request.index('settled.set(true)'), 'Retention must publish before settled')
    for token in ['callback = null', 'ACTIVE.remove(token, this)', 'MAIN.removeCallbacks(deadline)', 'unregisterActivityLifecycleCallbacks', 'WeakReference<WotMediaPickerActivity>', 'stream.close()']:
        require(token in request, f'Lifecycle cleanup missing: {token}')
    gradle = (ROOT / 'build.gradle').read_text(encoding='utf-8')
    require("compileOnly project(':LynxAndroid')" in gradle, 'Reuse host SDK source project')
    require('rootProject.ext.compileSdkVersion' in gradle and "androidx.core:core:1.6.0" in gradle, 'Observed Explorer dependencies must be preserved')
    require("asan { dimension 'lynx' }" in gradle and "noasan { dimension 'lynx' }" in gradle, 'Explorer flavor alignment missing')
    print('PASS: XML/resources, six Java lexical structures, real Android API paths, callback/lifecycle/cache contracts, host Gradle dependencies.')
    print('UNVERIFIED: Android Java compilation, manifest merger, Gradle resolution, APK install, emulator/device behavior. No fake SDK stubs were used.')


if __name__ == '__main__':
    main()
