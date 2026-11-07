import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AyahFlowBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// The app's interface never zooms, as in a native app: a double tap (or a stray pinch) used to magnify the reader and
/// leave it stuck. Text size comes from the app's own controls (Arabic and reader text size), and iOS's own Zoom
/// (Settings → Accessibility → Zoom) still magnifies anything. Three layers, any one of which suffices: the viewport
/// (maximum-scale=1, user-scalable=no, which WKWebView honours), `touch-action: manipulation` in CSS, and the web view's
/// scroll view locked to scale 1 here (WKWebView re-applies the viewport on every load, so this runs whenever the view
/// appears or the app becomes active, and resets any zoom that slipped through).
class AyahFlowBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        lockZoom()
        NotificationCenter.default.addObserver(self, selector: #selector(lockZoom), name: UIApplication.didBecomeActiveNotification, object: nil)
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        lockZoom()
    }
    @objc func lockZoom() {
        guard let scroll = webView?.scrollView else { return }
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 1
        scroll.bouncesZoom = false
        scroll.pinchGestureRecognizer?.isEnabled = false
        if scroll.zoomScale != 1 { scroll.setZoomScale(1, animated: false) }
    }
}
