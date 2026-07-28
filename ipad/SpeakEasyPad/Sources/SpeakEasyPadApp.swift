import SwiftUI

@main
struct SpeakEasyPadApp: App {
    var body: some Scene {
        WindowGroup {
            PadShellView()
                .preferredColorScheme(.dark)
        }
    }
}
