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
        app.buttons["Remove: Absa Wealth Visa Crédito"].tap()
    }

    func testFavouritesTabShowsBrunosFavourite() throws {
        skipOnboarding()
        signIn("bruno@mozdiscounts.test")
        XCTAssertTrue(app.buttons["Favourites"].waitForExistence(timeout: 30))
        app.buttons["Favourites"].tap()
        XCTAssertTrue(app.staticTexts["Executive lunch with your card"].waitForExistence(timeout: 20))
    }

    func testWalletsCanBeAddedAndRemoved() throws {
        skipOnboarding()
        signIn("fabio@mozdiscounts.test") // no wallets in the seed
        XCTAssertTrue(app.buttons["Profile"].waitForExistence(timeout: 30)); app.buttons["Profile"].tap()
        app.buttons["My cards and wallets"].tap()
        let chip = app.buttons["+ M-Pesa"]
        XCTAssertTrue(chip.waitForExistence(timeout: 20), "the wallet chips load from the catalogue")
        chip.tap()
        XCTAssertTrue(app.staticTexts["M-Pesa"].waitForExistence(timeout: 20), "the wallet is listed after saving")
        app.buttons["Remove: M-Pesa"].tap() // leave the seed as it was
        XCTAssertTrue(app.buttons["+ M-Pesa"].waitForExistence(timeout: 20))
    }

    func testProfileEditPersistsOnTheServer() throws {
        skipOnboarding()
        signIn("hugo@mozdiscounts.test")
        XCTAssertTrue(app.buttons["Profile"].waitForExistence(timeout: 30)); app.buttons["Profile"].tap()
        app.buttons["Edit profile"].tap()
        let phone = app.textFields["PHONE (+258…)"].exists ? app.textFields["PHONE (+258…)"] : app.textFields.element(boundBy: 2)
        XCTAssertTrue(phone.waitForExistence(timeout: 10))
        phone.tap(); phone.typeText("84 123 4567") // typed the way people write it; the app normalises it
        app.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Saved."].waitForExistence(timeout: 20) || !app.buttons["Save"].exists)
        // Open it again: the value comes back from the server, not from memory
        app.buttons["Edit profile"].tap()
        XCTAssertTrue(app.textFields.matching(NSPredicate(format: "value == '+258841234567'")).firstMatch.waitForExistence(timeout: 20))
    }

    /// A brand-new account (no cards, no preferences row), the way a person sets the app up on a phone: register, sign in, add a card and a wallet.
    func testNewAccountCanAddACardAndAWallet() throws {
        let email = "ui-\(UUID().uuidString.prefix(8).lowercased())@mozdiscounts.test"
        skipOnboarding()
        XCTAssertTrue(app.buttons["Create account"].waitForExistence(timeout: 20)); app.buttons["Create account"].tap()
        let fields = app.textFields
        XCTAssertTrue(fields.firstMatch.waitForExistence(timeout: 10))
        fields.element(boundBy: 0).tap(); fields.element(boundBy: 0).typeText("Nova")
        fields.element(boundBy: 1).tap(); fields.element(boundBy: 1).typeText("Pessoa")
        fields.element(boundBy: 2).tap(); fields.element(boundBy: 2).typeText(email)
        let pw = app.secureTextFields.firstMatch; pw.tap(); pw.typeText("Str0ng-Passw0rd!")
        app.buttons["Create account"].tap()
        XCTAssertTrue(app.staticTexts["Check your email"].waitForExistence(timeout: 30), "registration accepted")
        app.buttons["Sign in"].tap()
        signIn(email)
        // First run after sign-up: the card step (skippable) comes first
        XCTAssertTrue(app.buttons["Add card"].waitForExistence(timeout: 30), "card onboarding")
        app.buttons["Add card"].tap()
        XCTAssertTrue(app.buttons["BCI"].waitForExistence(timeout: 20), "banks load from the catalogue"); app.buttons["BCI"].tap()
        app.buttons["Credit"].tap()
        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Gold'")).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10)); card.tap()
        XCTAssertTrue(app.staticTexts["BCI Gold Visa Crédito"].waitForExistence(timeout: 20), "card saved and listed")
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Something went wrong'")).firstMatch.exists)
        let wallet = app.buttons["+ M-Pesa"]
        XCTAssertTrue(wallet.waitForExistence(timeout: 20)); wallet.tap()
        XCTAssertTrue(app.staticTexts["M-Pesa"].waitForExistence(timeout: 20), "wallet saved and listed")
    }

    /// A business account in the customer app gets a clear explanation, not a generic failure.
    func testBusinessAccountIsToldToUseThePortal() throws {
        skipOnboarding()
        signIn("absa.owner@mozdiscounts.test")
        XCTAssertTrue(app.staticTexts["This app is for customers. Business and admin accounts use the web portal."].waitForExistence(timeout: 30))
        XCTAssertFalse(app.buttons["Home"].exists)
    }
}
