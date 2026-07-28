import Foundation
import UIKit

@MainActor
final class PadShellModel: ObservableObject {
    @Published private(set) var pairingLink: PairingLink?
    @Published var isShowingScanner = false
    @Published var errorMessage: String?
    @Published private(set) var reloadToken = UUID()

    private let store = PairingLinkStore()

    init() {
        pairingLink = store.load()
    }

    func scan() {
        isShowingScanner = true
    }

    func accept(scannedValue: String) {
        do {
            let link = try PairingLink(scannedValue: scannedValue)
            try store.save(link)
            pairingLink = link
            isShowingScanner = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func pastePairingLink() {
        guard let value = UIPasteboard.general.string, !value.isEmpty else {
            errorMessage = "Copy the Pad link on your Mac first."
            return
        }
        accept(scannedValue: value)
    }

    func reload() {
        reloadToken = UUID()
    }

    func forget() {
        store.clear()
        pairingLink = nil
        reloadToken = UUID()
    }
}
