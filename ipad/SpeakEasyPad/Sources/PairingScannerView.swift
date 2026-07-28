import AVFoundation
import SwiftUI
import UIKit

struct PairingScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> PairingScannerViewController {
        PairingScannerViewController(onCode: onCode, onCancel: onCancel)
    }

    func updateUIViewController(_ uiViewController: PairingScannerViewController, context: Context) {}
}

final class PairingScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let onCode: (String) -> Void
    private let onCancel: () -> Void
    private let session = AVCaptureSession()
    private let preview = AVCaptureVideoPreviewLayer()
    private var deliveredCode = false

    init(onCode: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.onCode = onCode
        self.onCancel = onCancel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        installChrome()
        prepareCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        session.stopRunning()
    }

    private func prepareCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted { self?.configureSession() } else { self?.showCameraUnavailable() }
                }
            }
        default:
            showCameraUnavailable()
        }
    }

    private func configureSession() {
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera),
              session.canAddInput(input)
        else {
            showCameraUnavailable()
            return
        }
        session.addInput(input)
        let metadata = AVCaptureMetadataOutput()
        guard session.canAddOutput(metadata) else {
            showCameraUnavailable()
            return
        }
        session.addOutput(metadata)
        metadata.setMetadataObjectsDelegate(self, queue: .main)
        metadata.metadataObjectTypes = [.qr]

        preview.session = session
        preview.videoGravity = .resizeAspectFill
        view.layer.insertSublayer(preview, at: 0)
        DispatchQueue.global(qos: .userInitiated).async { [session] in session.startRunning() }
    }

    private func installChrome() {
        let guide = UIView()
        guide.translatesAutoresizingMaskIntoConstraints = false
        guide.layer.borderWidth = 2
        guide.layer.borderColor = UIColor(red: 0.45, green: 0.95, blue: 0.81, alpha: 0.9).cgColor
        guide.layer.cornerRadius = 24
        view.addSubview(guide)

        let instruction = UILabel()
        instruction.translatesAutoresizingMaskIntoConstraints = false
        instruction.text = "SCAN THE CODE SHOWN BY SPEAKEASY ON YOUR MAC"
        instruction.textColor = .white
        instruction.font = .monospacedSystemFont(ofSize: 12, weight: .semibold)
        instruction.textAlignment = .center
        instruction.numberOfLines = 2
        instruction.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        instruction.layer.cornerRadius = 10
        instruction.clipsToBounds = true
        view.addSubview(instruction)

        let close = UIButton(type: .system)
        close.translatesAutoresizingMaskIntoConstraints = false
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .white
        close.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        close.layer.cornerRadius = 22
        close.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        view.addSubview(close)

        NSLayoutConstraint.activate([
            guide.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            guide.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            guide.widthAnchor.constraint(equalToConstant: 330),
            guide.heightAnchor.constraint(equalToConstant: 330),
            instruction.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            instruction.bottomAnchor.constraint(equalTo: guide.topAnchor, constant: -24),
            instruction.widthAnchor.constraint(equalToConstant: 390),
            instruction.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            close.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            close.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            close.widthAnchor.constraint(equalToConstant: 44),
            close.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func showCameraUnavailable() {
        let alert = UIAlertController(
            title: "Camera unavailable",
            message: "Allow camera access in Settings, or paste the copied Pad link instead.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Close", style: .cancel) { [weak self] _ in self?.onCancel() })
        present(alert, animated: true)
    }

    @objc private func cancel() {
        onCancel()
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard !deliveredCode,
              let code = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first
        else { return }
        deliveredCode = true
        session.stopRunning()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onCode(code)
    }
}
