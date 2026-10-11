import XCTest

final class TodoTrackerUITests: XCTestCase {
    @MainActor
    func testAddCompleteUndoDelete() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        XCTAssertTrue(app.staticTexts["todo-empty"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["todo-form-submit"].isEnabled)

        let title = app.textFields["todo-form-title"]
        title.tap()
        title.typeText("Buy milk\n")
        XCTAssertTrue(app.descendants(matching: .any)["todo-item-Buy milk"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["todo-remaining"].label, "1 task remaining")

        let toggle = app.descendants(matching: .any)["todo-toggle-Buy milk"]
        toggle.tap()
        XCTAssertEqual(toggle.value as? String, "1")
        XCTAssertEqual(app.staticTexts["undo-toast-label"].label, "Completed todo")
        app.buttons["undo-toast-action"].tap()
        XCTAssertEqual(toggle.value as? String, "0")

        app.buttons["todo-delete-Buy milk"].tap()
        XCTAssertTrue(app.staticTexts["todo-empty"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["undo-toast-label"].label, "Deleted todo")
        XCTAssertFalse(app.staticTexts["undo-toast-label"].waitForNonExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["undo-toast-label"].waitForNonExistence(timeout: 5))
    }

    @MainActor
    func testQuickAddShorthand() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTesting"]
        app.launch()

        let title = app.textFields["todo-form-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        title.tap()
        title.typeText("Call mom 2030-01-15 #family !p1")
        XCTAssertEqual(app.staticTexts["todo-quick-add-preview-title"].label, "Call mom")

        app.buttons["todo-form-submit"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["todo-item-Call mom"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["todo-priority-Call mom"].label, "High")
        XCTAssertEqual(app.staticTexts["todo-due-Call mom"].label, "2030-01-15")
        XCTAssertFalse(app.staticTexts["todo-quick-add-preview-title"].exists)
    }
}
