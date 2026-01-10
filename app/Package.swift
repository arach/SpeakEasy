// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SpeakEasyConfig",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "SpeakEasyConfig",
            path: "Sources/SpeakEasyConfig"
        )
    ]
)
