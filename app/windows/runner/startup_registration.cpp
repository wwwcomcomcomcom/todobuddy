#include "startup_registration.h"

#include <windows.h>
#include <shellapi.h>

#include <flutter/method_channel.h>
#include <flutter/standard_method_codec.h>

#include <cstdint>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

namespace {
constexpr wchar_t kRunKey[] = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
constexpr wchar_t kApprovalKey[] =
    L"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
constexpr wchar_t kEntryName[] = L"Todo Buddy";

void CheckStatus(LSTATUS status) {
  if (status != ERROR_SUCCESS) {
    throw std::runtime_error("Windows registry error: " + std::to_string(status));
  }
}

bool IsMissing(LSTATUS status) {
  return status == ERROR_FILE_NOT_FOUND || status == ERROR_PATH_NOT_FOUND;
}

std::wstring StartupCommand() {
  std::vector<wchar_t> path(32768);
  const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
  if (length == 0 || length >= path.size()) {
    throw std::runtime_error("Cannot resolve the application path");
  }
  return L"\"" + std::wstring(path.data(), length) + L"\"";
}

std::string GetStatus() {
  DWORD size = 0;
  LSTATUS status = RegGetValueW(HKEY_CURRENT_USER, kRunKey, kEntryName,
                                RRF_RT_REG_SZ, nullptr, nullptr, &size);
  if (IsMissing(status)) return "disabled";
  CheckStatus(status);
  std::vector<wchar_t> command(size / sizeof(wchar_t) + 1, L'\0');
  CheckStatus(RegGetValueW(HKEY_CURRENT_USER, kRunKey, kEntryName, RRF_RT_REG_SZ,
                          nullptr, command.data(), &size));
  // A ZIP installation may have moved since registration. Enabling again repairs it.
  if (std::wstring(command.data()) != StartupCommand()) return "disabled";

  size = 0;
  status = RegGetValueW(HKEY_CURRENT_USER, kApprovalKey, kEntryName,
                       RRF_RT_REG_BINARY, nullptr, nullptr, &size);
  if (IsMissing(status)) return "enabled";
  CheckStatus(status);
  if (size == 0) return "enabled";
  std::vector<BYTE> approval(size);
  CheckStatus(RegGetValueW(HKEY_CURRENT_USER, kApprovalKey, kEntryName,
                          RRF_RT_REG_BINARY, nullptr, approval.data(), &size));
  // StartupApproved uses 2/6 for enabled and 3/7 for disabled entries.
  // Do not overwrite a choice made in Task Manager; direct the user to Settings.
  return (approval[0] & 1) != 0 ? "requiresApproval" : "enabled";
}

void SetEnabled(bool enabled) {
  if (!enabled) {
    const LSTATUS status = RegDeleteKeyValueW(HKEY_CURRENT_USER, kRunKey, kEntryName);
    if (!IsMissing(status)) CheckStatus(status);
    return;
  }
  const std::wstring command = StartupCommand();
  // Windows limits Run commands to 260 characters, including our path quotes.
  if (command.size() > 260) {
    throw std::runtime_error("Move Todo Buddy to a shorter path before enabling startup");
  }
  HKEY key = nullptr;
  CheckStatus(RegCreateKeyExW(HKEY_CURRENT_USER, kRunKey, 0, nullptr, 0,
                              KEY_SET_VALUE, nullptr, &key, nullptr));
  const LSTATUS status = RegSetValueExW(
      key, kEntryName, 0, REG_SZ, reinterpret_cast<const BYTE*>(command.c_str()),
      static_cast<DWORD>((command.size() + 1) * sizeof(wchar_t)));
  RegCloseKey(key);
  CheckStatus(status);
}
}  // namespace

void RegisterStartupChannel(flutter::BinaryMessenger* messenger) {
  flutter::MethodChannel<flutter::EncodableValue> channel(
      messenger, "todobuddy/startup", &flutter::StandardMethodCodec::GetInstance());
  channel.SetMethodCallHandler([](const auto& call, auto result) {
    try {
      if (call.method_name() == "getStatus") {
        result->Success(flutter::EncodableValue(GetStatus()));
      } else if (call.method_name() == "setEnabled") {
        const auto* enabled = call.arguments() ? std::get_if<bool>(call.arguments()) : nullptr;
        if (!enabled) {
          result->Error("invalid_argument", "Expected a boolean");
          return;
        }
        SetEnabled(*enabled);
        result->Success(flutter::EncodableValue(GetStatus()));
      } else if (call.method_name() == "openSettings") {
        const auto opened = reinterpret_cast<intptr_t>(ShellExecuteW(
            nullptr, L"open", L"ms-settings:startupapps", nullptr, nullptr, SW_SHOWNORMAL));
        if (opened <= 32) throw std::runtime_error("Cannot open Windows startup settings");
        result->Success();
      } else {
        result->NotImplemented();
      }
    } catch (const std::exception& error) {
      result->Error("startup_failed", error.what());
    }
  });
}
