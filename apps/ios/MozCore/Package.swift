// swift-tools-version: 6.0
import PackageDescription

// MozCore: framework-free logic shared with the app (matching, alert engine, API client, offline queue).
// It must pass the same TD-6 vectors as the TypeScript implementation (packages/shared/test-vectors/matching.json).
let package = Package(
    name: "MozCore",
    defaultLocalization: "pt",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "MozCore", targets: ["MozCore"])],
    targets: [
        .target(name: "MozCore", swiftSettings: [.swiftLanguageMode(.v5)]),
        .testTarget(name: "MozCoreTests", dependencies: ["MozCore"], swiftSettings: [.swiftLanguageMode(.v5)]),
    ]
)
