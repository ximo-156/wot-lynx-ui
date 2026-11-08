#!/usr/bin/env python3
"""Portable structural checks only. This is NOT an Apple SDK compile/test."""
from pathlib import Path
import plistlib
import re
import sys

ROOT = Path(__file__).resolve().parent
FILES = ['WotMediaPicker.h', 'WotMediaPicker.m', 'README.md', 'Info.plist.fragment.xml']
errors = []
for name in FILES:
    path = ROOT / name
    if not path.is_file():
        errors.append(f'Missing {name}')
        continue
    text = path.read_text(encoding='utf-8')
    for number, line in enumerate(text.splitlines(), 1):
        if line.rstrip() != line:
            errors.append(f'{name}:{number}: trailing whitespace')
    if not text.endswith('\n'):
        errors.append(f'{name}: missing final newline')


def delimiters(text, name):
    """Ignore actual C/Objective-C comments and quoted literals, then balance ().[].{}."""
    stack = []
    matching = {')': '(', ']': '[', '}': '{'}
    i = 0
    while i < len(text):
        if text.startswith('//', i):
            end = text.find('\n', i + 2)
            i = len(text) if end < 0 else end + 1
            continue
        if text.startswith('/*', i):
            end = text.find('*/', i + 2)
            if end < 0:
                errors.append(f'{name}: unterminated comment')
                return
            i = end + 2
            continue
        c = text[i]
        if c in '\"\'':
            quote = c
            i += 1
            while i < len(text):
                if text[i] == '\\':
                    i += 2
                    continue
                if text[i] == quote:
                    break
                i += 1
            if i >= len(text):
                errors.append(f'{name}: unterminated literal')
                return
        elif c in '([{':
            stack.append((c, i))
        elif c in ')]}':
            if not stack or stack[-1][0] != matching[c]:
                errors.append(f'{name}: unbalanced {c} at character {i}')
                return
            stack.pop()
        i += 1
    if stack:
        errors.append(f'{name}: unclosed delimiter {stack[-1][0]}')

header = (ROOT / 'WotMediaPicker.h').read_text(encoding='utf-8')
source = (ROOT / 'WotMediaPicker.m').read_text(encoding='utf-8')
for name, text in [('WotMediaPicker.h', header), ('WotMediaPicker.m', source)]:
    delimiters(text, name)

required = {
    'NSObject<LynxModule> contract': '@interface WotMediaPicker : NSObject <LynxModule>' in header,
    'native module name': 'return @"WotMediaPicker"' in source,
    'two-argument selector': '@selector(chooseMedia:callback:)' in source,
    'real PHPicker': '[[PHPickerViewController alloc] initWithConfiguration:configuration]' in source,
    'real camera': 'UIImagePickerControllerSourceTypeCamera' in source,
    'real camera authorization': 'requestAccessForMediaType:AVMediaTypeVideo' in source,
    'file representation loading': 'loadFileRepresentationForTypeIdentifier:' in source,
    'real cache copy': 'copyItemAtURL:source toURL:destination' in source,
    'provider lifetime sync copy': '[self withinProviderLifetime:^' in source and 'dispatch_sync(self.workQueue, work)' in source,
    'ordered result indexes': 'files[index] = file' in source,
    'real file bytes': 'attributes[NSFileSize]' in source,
    'real video thumbnail': 'copyCGImageAtTime:' in source,
    'callback cleared before invoke': source.index('self.callback = nil;') < source.index('if (callback) callback(result);'),
    'dismissal drains pending result': 'if (!request.finished && request.pendingResult) [request finishNow:request.pendingResult];' in source,
    'global request ownership': '@property(nonatomic, strong, nullable) WMPRequest *activeRequest' in source,
}
for label, passed in required.items():
    if not passed:
        errors.append(f'Missing structural contract: {label}')
if re.search(r'\[PHPhotoLibrary\s+(?:requestAuthorization|authorizationStatus)', source):
    errors.append('Broad photo-library permission request is not permitted for PHPicker')

with (ROOT / 'Info.plist.fragment.xml').open('rb') as stream:
    plist = plistlib.load(stream)
if not isinstance(plist.get('NSCameraUsageDescription'), str) or not plist['NSCameraUsageDescription'].strip():
    errors.append('Missing camera usage description')
for unwanted in ['NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription', 'NSMicrophoneUsageDescription']:
    if unwanted in plist:
        errors.append(f'Unnecessary privacy permission in fragment: {unwanted}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(FILES)} UTF-8 files, Objective-C delimiter balance, {len(required)} source contracts, camera plist')
print('UNVERIFIED: Objective-C compilation/linking, Explorer registration/installation, UIKit/camera/device execution')
