import Foundation
import Capacitor
import CoreLocation

/// Web-layer API for SmartReminders. Location is requested only from these calls, i.e. after the user turns on a
/// feature that needs it. Coordinates are kept on the device; nothing here uses the network.
@objc(SmartRemindersPlugin)
public class SmartRemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SmartRemindersPlugin"
    public let jsName = "AyahFlowSmart"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentPosition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlways", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMotion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "simulate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWidgetData", returnType: CAPPluginReturnPromise)
    ]
    private var engine: SmartReminders { SmartReminders.shared }

    override public func load() { DispatchQueue.main.async { self.engine.start() } }

    @objc func status(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(self.engine.status()) } }

    @objc func currentPosition(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.engine.currentPosition { location, error in
                guard let location else { call.reject(error ?? "unavailable"); return }
                call.resolve(["lat": location.coordinate.latitude, "lng": location.coordinate.longitude, "accuracy": location.horizontalAccuracy])
            }
        }
    }

    @objc func requestAlways(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine.requestAlways { _ in call.resolve(self.engine.status()) } }
    }

    @objc func requestMotion(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine.requestMotion { motion in var s = self.engine.status(); s["motion"] = motion; call.resolve(s) } }
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let json = call.getString("config"), let data = json.data(using: .utf8) else { call.reject("config required"); return }
        DispatchQueue.main.async {
            do { try self.engine.configure(data); call.resolve(self.engine.status()) } catch { call.reject("invalid config: \(error.localizedDescription)") }
        }
    }

    @objc func takeEvents(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(["events": self.engine.takeLog()]) } }

    /// Runs the real decision and notification path for an event, so the user can check their setup.
    @objc func simulate(_ call: CAPPluginCall) {
        guard let event = call.getString("event") else { call.reject("event required"); return }
        DispatchQueue.main.async { call.resolve(["moments": self.engine.handle([event])]) }
    }

    @objc func reset(_ call: CAPPluginCall) { DispatchQueue.main.async { self.engine.reset(); call.resolve() } }

    /// Widget timeline JSON from src/smart.ts (prayer times and labels). Pass null to clear it.
    @objc func setWidgetData(_ call: CAPPluginCall) {
        let json = call.getString("data")
        let data = (json == nil || json == "null") ? nil : json!.data(using: .utf8)
        let status = SharedWidgetStore.save(data)
        status == errSecSuccess ? call.resolve() : call.reject("widget store failed (\(status))")
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }
}
