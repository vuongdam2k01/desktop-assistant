{
  "targets": [
    {
      "target_name": "macos_window",
      "sources": [
        "src/macos_window.mm",
        "src/window_integration_core.mm"
      ],
      "link_settings": {
        "libraries": [
          "-framework AppKit",
          "-framework Foundation"
        ]
      },
      "xcode_settings": {
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "OTHER_CPLUSPLUSFLAGS": ["-std=c++17"]
      }
    },
    {
      "target_name": "test_macos_window",
      "type": "executable",
      "sources": [
        "src/test_main.mm",
        "src/window_integration_core.mm"
      ],
      "link_settings": {
        "libraries": [
          "-framework AppKit",
          "-framework Foundation"
        ]
      },
      "xcode_settings": {
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "OTHER_CPLUSPLUSFLAGS": ["-std=c++17"]
      }
    }
  ]
}
