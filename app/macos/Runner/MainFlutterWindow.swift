import Cocoa
import FlutterMacOS
import ServiceManagement

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    self.contentViewController = flutterViewController

    RegisterGeneratedPlugins(registry: flutterViewController)

    FlutterMethodChannel(
      name: "todobuddy/startup",
      binaryMessenger: flutterViewController.engine.binaryMessenger
    ).setMethodCallHandler { call, result in
      do {
        switch call.method {
        case "getStatus":
          result(StartupRegistration.status())
        case "setEnabled":
          guard let enabled = call.arguments as? Bool else {
            result(FlutterError(code: "invalid_argument", message: "Expected a boolean", details: nil))
            return
          }
          try StartupRegistration.setEnabled(enabled)
          result(StartupRegistration.status())
        case "openSettings":
          if #available(macOS 13.0, *) {
            SMAppService.openSystemSettingsLoginItems()
            result(nil)
          } else {
            let url = URL(string: "x-apple.systempreferences:com.apple.preferences.users")!
            if NSWorkspace.shared.open(url) {
              result(nil)
            } else {
              result(FlutterError(code: "open_failed", message: "Cannot open System Preferences", details: nil))
            }
          }
        default:
          result(FlutterMethodNotImplemented)
        }
      } catch {
        result(FlutterError(code: "startup_failed", message: error.localizedDescription, details: nil))
      }
    }

    super.awakeFromNib()

    // Keep the calendar and category list side by side from the first launch.
    let preferredSize = NSSize(width: 1120, height: 720)
    let minimumSize = NSSize(width: 800, height: 600)
    let availableSize = (screen ?? NSScreen.main).map {
      let availableContentRect = self.contentRect(forFrameRect: $0.visibleFrame)
      return NSSize(width: availableContentRect.width - 48, height: availableContentRect.height - 48)
    } ?? preferredSize

    contentMinSize = NSSize(
      width: min(minimumSize.width, availableSize.width),
      height: min(minimumSize.height, availableSize.height)
    )
    setContentSize(NSSize(
      width: min(preferredSize.width, availableSize.width),
      height: min(preferredSize.height, availableSize.height)
    ))
    center()
  }
}

private enum StartupRegistration {
  private static let label = "com.todobuddy.todobuddyApp.startup"
  private static var legacyURL: URL {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/LaunchAgents/\(label).plist")
  }

  static func status() -> String {
    if #available(macOS 13.0, *) {
      let serviceStatus = SMAppService.mainApp.status
      if serviceStatus == .enabled { return "enabled" }
      if serviceStatus == .requiresApproval { return "requiresApproval" }
      // Preserve registrations made on macOS 12 after an OS upgrade.
      if FileManager.default.fileExists(atPath: legacyURL.path) {
        let legacyStatus = SMAppService.statusForLegacyPlist(at: legacyURL)
        if legacyStatus == .enabled { return "enabled" }
        if legacyStatus == .requiresApproval { return "requiresApproval" }
      }
      return "disabled"
    }
    return FileManager.default.fileExists(atPath: legacyURL.path) ? "enabled" : "disabled"
  }

  static func setEnabled(_ enabled: Bool) throws {
    if #available(macOS 13.0, *) {
      let service = SMAppService.mainApp
      if enabled {
        if service.status != .enabled && service.status != .requiresApproval {
          do {
            try service.register()
          } catch {
            // macOS may register the item but require the user's approval.
            if service.status != .requiresApproval { throw error }
          }
        }
      } else if service.status == .enabled || service.status == .requiresApproval {
        try service.unregister()
      }
      // Once the modern API is used, do not leave a second launch entry behind.
      try removeLegacyRegistration()
    } else if enabled {
      let plist: [String: Any] = [
        "Label": label,
        "ProgramArguments": ["/usr/bin/open", "-a", Bundle.main.bundleURL.path],
        "RunAtLoad": true,
        "LimitLoadToSessionType": "Aqua",
      ]
      let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
      try FileManager.default.createDirectory(
        at: legacyURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil
      )
      // launchd reads this at the next login. Loading it now would reopen the app.
      try data.write(to: legacyURL, options: .atomic)
    } else {
      try removeLegacyRegistration()
    }
  }

  private static func removeLegacyRegistration() throws {
    if FileManager.default.fileExists(atPath: legacyURL.path) {
      try FileManager.default.removeItem(at: legacyURL)
    }
  }
}
