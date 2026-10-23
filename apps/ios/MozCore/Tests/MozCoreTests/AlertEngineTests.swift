import XCTest
@testable import MozCore

// Scenarios S01-S08, S12, S20 from TD-5 against the seed offers (SD-5, SD-6), evaluated on the device.
final class AlertEngineTests: XCTestCase {
    let wed = parseISO("2026-11-04T11:00:00Z")! // Wed 13:00 Maputo
    let settings = SyncSettings.default
    let catalogue = Catalogue(
        issuers: [Issuer(id: "iss-absa", name: "Absa Bank Moçambique", shortName: "Absa"), Issuer(id: "iss-bci", name: "BCI", shortName: "BCI")],
        wallets: [WalletProvider(id: "wl-mpesa", name: "M-Pesa", operator_: "Vodacom"), WalletProvider(id: "wl-emola", name: "e-Mola", operator_: "Movitel")],
        products: [CardProduct(id: "cp-absa-wealth", issuerId: "iss-absa", networkId: "net-visa", cardType: "CREDIT", segment: "Wealth", name: "Absa Wealth Visa Crédito"),
                   CardProduct(id: "cp-bci-gold", issuerId: "iss-bci", networkId: "net-visa", cardType: "CREDIT", segment: "Gold", name: "BCI Gold Visa Crédito")])

    func offer(_ id: String, _ pt: String, _ en: String, from: String = "2026-09-01", to: String? = "2027-03-31", days: [String] = [], window: (String, String)? = nil, rows: [EligibilityRow]) -> SyncOffer {
        SyncOffer(id: id, titlePt: pt, titleEn: en, businessName: "x", publishedAt: "2026-09-01T00:00:00Z", validFrom: from, validTo: to, days: days, from: window?.0, to: window?.1, rows: rows)
    }
    var polana: SyncPremise { SyncPremise(id: "pr-polana-spa", name: "Hotel Polana Serena – Spa", lat: -25.9707, lng: 32.6031, radiusM: 150, discountIds: ["d-01"]) }
    var marisco: SyncPremise { SyncPremise(id: "pr-marisco", name: "Restaurante Marisco da Baía", lat: -25.948, lng: 32.613, radiusM: 150, discountIds: ["d-02", "d-03"]) }
    var offers: [SyncOffer] {
        [offer("d-01", "15% no Spa do Polana", "15% at the Polana Spa", from: "2026-10-01", to: "2026-12-31", rows: [EligibilityRow(scope: .CARD_PRODUCT, cardProductId: "cp-absa-wealth", issuerId: "iss-absa", benefit: .PERCENT, value: 15)]),
         offer("d-02", "Almoço", "Lunch", days: ["MON", "TUE", "WED", "THU", "FRI"], window: ("12:00", "15:00"), rows: [EligibilityRow(scope: .CARD_PRODUCT, cardProductId: "cp-bci-gold", issuerId: "iss-bci", benefit: .PERCENT, value: 10), EligibilityRow(scope: .CARD_PRODUCT, cardProductId: "cp-absa-wealth", issuerId: "iss-absa", benefit: .PERCENT, value: 12)]),
         offer("d-03", "M-Pesa ou cartão", "M-Pesa or card", to: nil, rows: [EligibilityRow(scope: .WALLET, walletId: "wl-mpesa", benefit: .PERCENT, value: 5), EligibilityRow(scope: .ANY_BANK_CARD, benefit: .PERCENT, value: 3)])]
    }
    let ana = UserContext(holdings: Holdings(cards: [HeldCard(productId: "cp-absa-wealth", issuerId: "iss-absa", cardType: "CREDIT", networkId: "net-visa")]))
    let bruno = UserContext(holdings: Holdings(cards: [HeldCard(productId: "cp-bci-gold", issuerId: "iss-bci", cardType: "CREDIT", networkId: "net-visa")], wallets: ["wl-mpesa"]))

    func decide(_ p: SyncPremise, _ u: UserContext, state: AlertState = AlertState(), now: Date? = nil, settings: SyncSettings? = nil) -> Decision {
        AlertEngine.decide(premise: p, offers: offers, user: u, state: state, settings: settings ?? self.settings, catalogue: catalogue, now: now ?? wed)
    }
    func content(_ d: Decision, file: StaticString = #filePath, line: UInt = #line) -> AlertContent { guard case .alert(let c) = d else { XCTFail("expected an alert, got \(d)", file: file, line: line); return AlertContent(title: "", body: "", premiseId: "", discountIds: [], bestDiscountId: "", personal: false) }; return c }

    func testS01AnaAtPolana() {
        let c = content(decide(polana, ana))
        XCTAssertEqual(c.title, "15% de desconto no Hotel Polana Serena – Spa")
        XCTAssertEqual(c.body, "Com o seu Absa Wealth. Válido até 2026-12-31.")
    }
    func testS02AnaAtMarisco() {
        let c = content(decide(marisco, ana))
        XCTAssertEqual(c.title, "12% de desconto no Restaurante Marisco da Baía")
        XCTAssertTrue(c.body.hasSuffix("+ 1 outras ofertas"), c.body)
    }
    func testS03BrunoAtMarisco() {
        let c = content(decide(marisco, bruno))
        XCTAssertEqual(c.title, "10% de desconto no Restaurante Marisco da Baía")
        XCTAssertEqual(c.discountIds.count, 3)
        XCTAssertTrue(c.body.hasSuffix("+ 2 outras ofertas"), c.body)
    }
    func testS04BrunoOnSaturday() {
        let sat = parseISO("2026-11-07T11:00:00Z")!
        let c = content(decide(marisco, bruno, now: sat))
        XCTAssertEqual(c.title, "5% de desconto no Restaurante Marisco da Baía") // BCI weekday offer is not active; M-Pesa 5% leads
    }
    func testS05CarlaWithoutCardsSeesEverything() {
        let carla = UserContext()
        let c = content(decide(marisco, carla))
        XCTAssertEqual(c.title, "Oferta perto de si: 12% de desconto no Restaurante Marisco da Baía") // nothing personal: the general template
        XCTAssertFalse(c.personal)
        XCTAssertEqual(c.discountIds.count, 4)
    }
    func testS06DercioNoMatch() {
        let dercio = UserContext(holdings: Holdings(wallets: ["wl-emola"]))
        XCTAssertEqual(decide(polana, dercio), .suppressed(.NO_MATCH, discountIds: ["d-01"]))
    }
    func testS07CooldownAndS14English() {
        var state = AlertState()
        state.recordAlert(premiseId: "pr-polana-spa", at: wed)
        let later = wed.addingTimeInterval(2 * 3600)
        XCTAssertEqual(decide(polana, ana, state: state, now: later), .suppressed(.COOLDOWN, discountIds: ["d-01"]))
        // demo mode: 5-minute cooldown (assumption 11)
        var demo = settings; demo.cooldownSeconds = 300
        _ = content(decide(polana, ana, state: state, now: later, settings: demo))
        var en = ana; en.lang = .en
        XCTAssertEqual(content(decide(polana, en)).title, "15% off at Hotel Polana Serena – Spa")
    }
    func testS08QuietHoursCrossMidnight() {
        var elisa = ana; elisa.quietFrom = "22:00"; elisa.quietTo = "07:00"
        let early = parseISO("2026-11-04T04:30:00Z")! // 06:30 Maputo
        let cafe = SyncPremise(id: "pr-cafejardim", name: "Café Jardim", lat: -25.9655, lng: 32.601, radiusM: 150, discountIds: ["d-01"])
        XCTAssertEqual(AlertEngine.decide(premise: cafe, offers: offers, user: elisa, state: AlertState(), settings: settings, catalogue: catalogue, now: early), .suppressed(.QUIET_HOURS, discountIds: ["d-01"]))
        XCTAssertTrue(AlertEngine.inQuietHours("22:00", "07:00", parseISO("2026-11-04T21:30:00Z")!)) // 23:30
        XCTAssertFalse(AlertEngine.inQuietHours("22:00", "07:00", wed))
        XCTAssertFalse(AlertEngine.inQuietHours(nil, nil, wed))
    }
    func testAlertsDisabledAndNotActive() {
        var off = ana; off.alertsEnabled = false
        XCTAssertEqual(decide(polana, off), .suppressed(.ALERTS_DISABLED, discountIds: ["d-01"]))
        let sat = parseISO("2026-11-07T11:00:00Z")!
        let onlyWeekday = SyncPremise(id: "pr-x", name: "X", lat: 0, lng: 0, radiusM: 150, discountIds: ["d-02"])
        XCTAssertEqual(AlertEngine.decide(premise: onlyWeekday, offers: offers, user: ana, state: AlertState(), settings: settings, catalogue: catalogue, now: sat), .suppressed(.NOT_ACTIVE, discountIds: ["d-02"]))
    }
    func testS20DailyCapSkippedByFavourites() {
        var state = AlertState()
        for i in 0..<3 { state.recordAlert(premiseId: "other-\(i)", at: wed) }
        var capped = settings; capped.dailyCap = 3
        XCTAssertEqual(decide(polana, ana, state: state, settings: capped), .suppressed(.DAILY_CAP, discountIds: ["d-01"]))
        var fav = ana; fav.favourites = ["d-01"]
        _ = content(decide(polana, fav, state: state, settings: capped)) // favourites skip the cap
        // ...but not the cooldown
        var cool = state; cool.recordAlert(premiseId: "pr-polana-spa", at: wed.addingTimeInterval(-60))
        XCTAssertEqual(decide(polana, fav, state: cool, settings: capped), .suppressed(.COOLDOWN, discountIds: ["d-01"]))
        // a new Maputo day resets the counter
        XCTAssertEqual(state.alertsToday(wed.addingTimeInterval(86_400)), 0)
    }
    func testGeneralOfferCopy() {
        let gym = offer("d-09", "Primeiro mês grátis", "First month free", rows: [EligibilityRow(scope: .GENERAL, benefit: .FREE_ITEM, valueTextPt: "1.º mês de mensalidade", valueTextEn: "1st month's fee")])
        let p = SyncPremise(id: "pr-forca", name: "Ginásio Força Total", lat: 0, lng: 0, radiusM: 150, discountIds: ["d-09"])
        let c = content(AlertEngine.decide(premise: p, offers: [gym], user: ana, state: AlertState(), settings: settings, catalogue: catalogue, now: wed))
        XCTAssertEqual(c.title, "Oferta perto de si: 1.º mês de mensalidade no Ginásio Força Total")
        XCTAssertFalse(c.personal)
    }
}
