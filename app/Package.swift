// swift-tools-version: 5.9
import PackageDescription

// SpeakEasy — native macOS companion for the @arach/speakeasy CLI.
//
// HudsonKit (design tokens + app shell) is consumed as prebuilt binary XCFrameworks:
//   https://github.com/arach/hudsonkit-xcframework
let package = Package(
    name: "SpeakEasy",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [
        .package(url: "https://github.com/arach/hudsonkit-xcframework.git", exact: "0.3.4"),
        // 0.4.5's root SwiftPM manifest points at a resource absent from that
        // tag. Pin the first known-good repository package revision instead.
        .package(
            url: "https://github.com/arach/vox.git",
            revision: "19be9f1d30b2fd7a79c5f88feffcb44091854761"
        )
    ],
    targets: [
        .executableTarget(
            name: "SpeakEasy",
            dependencies: [
                .product(name: "HudsonUI", package: "hudsonkit-xcframework"),
                .product(name: "HudsonShell", package: "hudsonkit-xcframework"),
                .product(name: "VoxCore", package: "vox"),
                .product(name: "VoxEngine", package: "vox"),
            ],
            path: "Sources/SpeakEasy",
            resources: [
                .copy("Resources/codex-desktop-bridge.cjs"),
                .copy("Resources/codex-luna-presenter.cjs"),
                .copy("Resources/Pad")
            ]
        ),
        .testTarget(
            name: "SpeakEasyTests",
            dependencies: ["SpeakEasy"]
        )
    ]
)
