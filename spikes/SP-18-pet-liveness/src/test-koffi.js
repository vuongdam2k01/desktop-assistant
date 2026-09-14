const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
const GetWindowTextA = user32.func('int __stdcall GetWindowTextA(void* hWnd, _Out_ char* lpString, int nMaxCount)');

const hwnd = GetForegroundWindow();
const buf = Buffer.alloc(256);
const len = GetWindowTextA(hwnd, buf, 256);
console.log('Foreground window handle:', hwnd, 'title:', buf.toString('utf8', 0, len));
