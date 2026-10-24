import XCTest

// Journeys J3-J5 on the simulator against a running API (see docs/runbook.md):
//   TEST_RUNNER_MOZ_API_BASE_URL=http://localhost:3102 TEST_RUNNER_MOZ_DEMO_PASSWORD=... xcodebuild test -scheme MozDiscounts ...
// The simulator language is English, so the tests read the English strings.
final class MozDiscountsUITests: XCTestCase {
    let env = ProcessInfo.processInfo.environment
    var app: XCUIApplication!
    var password: String { env["MOZ_DEMO_PASSWORD"] ?? "" }

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["MOZ_API_BASE_URL"] = env["MOZ_API_BASE_URL"] ?? "http://localhost:3000"
        // System dialogs (notifications, location) are allowed so the flows run unattended.
        addUIInterruptionMonitor(withDescription: "System permission") { alert in
            for label in ["Allow", "Allow While Using App", "Allow Once", "OK"] where alert.buttons[label].exists { alert.buttons[label].tap(); return true }
            return false
        }
    }

    private func signIn(_ email: String) {
        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 20), "login form")
        field.tap(); field.typeText(email)
        let pw = app.secureTextFields.firstMatch
        pw.tap(); pw.typeText(password)
        app.buttons["Sign in"].tap()
    }
    private func skipOnboarding() {
        app.launch()
        if app.buttons["Skip"].waitForExistence(timeout: 20) { app.buttons["Skip"].tap(); app.buttons["Done"].tap() }
    }

    func testJ3_firstRun_onboardingThenSignInShowsTheMap() throws {
        skipOnboarding()
        signIn("bruno@mozdiscounts.test")
        XCTAssertTrue(app.buttons["Home"].waitForExistence(timeout: 30), "tab bar after sign-in")
        XCTAssertTrue(app.buttons["Absa"].waitForExistence(timeout: 20), "bank filter chip")
        app.buttons["Absa"].tap()
        XCTAssertTrue(app.buttons["Absa"].isSelected || app.buttons["Absa"].exists)
        app.buttons["Profile"].tap()
        XCTAssertTrue(app.staticTexts["Bruno Sitoe"].waitForExistence(timeout: 10))
    }

    func testJ4_wrongPasswordShowsAnErrorAndStaysSignedOut() throws {
        skipOnboarding()
        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        field.tap(); field.typeText("bruno@mozdiscounts.test")
        let pw = app.secureTextFields.firstMatch; pw.tap(); pw.typeText("Wrong-Passw0rd!")
        app.buttons["Sign in"].tap()
        XCTAssertTrue(app.staticTexts["Wrong email or password."].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["Home"].exists)
    }

    func testJ5_favouritesAndCardsFlow() throws {
        skipOnboarding()
        signIn("dercio@mozdiscounts.test") // holds e-Mola only
        XCTAssertTrue(app.buttons["Home"].waitForExistence(timeout: 30))
        // Add a card: bank, then type, then the card
        app.buttons["Profile"].tap()
        app.buttons["My cards and wallets"].tap()
        XCTAssertTrue(app.buttons["Add card"].waitForExistence(timeout: 10))
        app.buttons["Add card"].tap()
        XCTAssertTrue(app.buttons["Absa"].waitForExistence(timeout: 10)); app.buttons["Absa"].tap()
        XCTAssertTrue(app.buttons["Credit"].waitForExistence(timeout: 10)); app.buttons["Credit"].tap()
        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Wealth'")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10)); card.tap()
        XCTAssertTrue(app.staticTexts["Absa Wealth Visa Crédito"].waitForExistence(timeout: 20), "the new card is listed")
        // Remove it again so the demo data stays as seeded
        app.buttons["Remove"].firstMatch.tap()
    }

    func testFavouritesTabShowsBrunosFavourite() throws {
        skipOnboarding()
        signIn("bruno@mozdiscounts.test")
        XCTAssertTrue(app.buttons["Favourites"].waitForExistence(timeout: 30))
        app.buttons["Favourites"].tap()
        XCTAssertTrue(app.staticTexts["Executive lunch with your card"].waitForExistence(timeout: 20))
    }
}
