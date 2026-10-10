import Foundation
import TodoCore
import XCTest

/// Runs every case in spec/fixtures/*.json against TodoCore. The files are read in place
/// from the repo, never copied, so iOS and web are checked against the same golden data.
@MainActor
final class FixtureTests: XCTestCase {
    private struct FixtureFile: Decodable {
        let feature: String
        let cases: [FixtureCase]
    }

    private struct FixtureCase: Decodable {
        let name: String
        let op: String
        let given: JSONValue
        let then: JSONValue
    }

    static let fixturesDir = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // TodoCoreTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // TodoCore
        .appendingPathComponent("../../../spec/fixtures")
        .standardizedFileURL

    static let features = ["todo", "list", "undo", "storage", "voice"]

    func testTodo() throws { try runFixtures("todo") }
    func testList() throws { try runFixtures("list") }
    func testUndo() throws { try runFixtures("undo") }
    func testStorage() throws { try runFixtures("storage") }
    func testVoice() throws { try runFixtures("voice") }

    /// A new fixture file must get a test above, or it would silently never run on iOS.
    func testEveryFixtureFileIsCovered() throws {
        let files = try FileManager.default.contentsOfDirectory(atPath: Self.fixturesDir.path)
            .filter { $0.hasSuffix(".json") }
            .map { String($0.dropLast(5)) }
        XCTAssertEqual(Set(files), Set(Self.features))
    }

    func testUnknownOpFails() {
        XCTAssertThrowsError(try FixtureOps.run(op: "notARealOp", given: .object([:])))
    }

    private func runFixtures(_ feature: String) throws {
        let url = Self.fixturesDir.appendingPathComponent("\(feature).json")
        let file = try JSONDecoder().decode(FixtureFile.self, from: Data(contentsOf: url))
        XCTAssertEqual(file.feature, feature)
        XCTAssertFalse(file.cases.isEmpty)
        var passed = 0
        for fixture in file.cases {
            XCTContext.runActivity(named: fixture.name) { _ in
                do {
                    let actual = try FixtureOps.run(op: fixture.op, given: fixture.given)
                    XCTAssertEqual(actual, fixture.then, "\(feature): \(fixture.name)\n  actual:   \(actual)\n  expected: \(fixture.then)")
                    if actual == fixture.then { passed += 1 }
                } catch {
                    XCTFail("\(feature): \(fixture.name): \(error)")
                }
            }
        }
        print("fixtures \(feature): \(passed)/\(file.cases.count) passed")
    }
}
