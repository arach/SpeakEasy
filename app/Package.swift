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
        .package(url: "https://github.com/arach/hudsonkit-xcframework.git", exact: "0.3.2")
    ],
    targets: [
        .executableTarget(
            name: "SpeakEasy",
            dependencies: [
                .product(name: "HudsonUI", package: "hudsonkit-xcframework"),
                .product(name: "HudsonShell", package: "hudsonkit-xcframework"),
            ],
            path: "Sources/SpeakEasy"
        )
    ]
)