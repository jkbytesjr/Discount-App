import Foundation
import MozCore

/// All user-facing text, Portuguese first (NFR-7). Keys are stable; the web uses the same wording where screens match.
enum L10n {
    static func t(_ key: String, _ lang: Lang, _ vars: [String: String] = [:]) -> String {
        var s = (table[key].map { lang == .pt ? $0.0 : $0.1 }) ?? key
        for (k, v) in vars { s = s.replacingOccurrences(of: "{\(k)}", with: v) }
        return s
    }
    static let table: [String: (String, String)] = [
        "app.name": ("Moz Discounts", "Moz Discounts"),
        "demo.ribbon": ("Dados de demonstração", "Demo data"),
        "common.cancel": ("Cancelar", "Cancel"), "common.save": ("Guardar", "Save"), "common.next": ("Seguinte", "Next"), "common.skip": ("Saltar", "Skip"), "common.done": ("Concluir", "Done"),
        "common.retry": ("Tentar novamente", "Try again"), "common.close": ("Fechar", "Close"), "common.remove": ("Remover", "Remove"), "common.loading": ("A carregar…", "Loading…"),
        "common.error": ("Algo correu mal. Tente novamente.", "Something went wrong. Please try again."), "common.offline": ("Sem ligação. Verifique a internet.", "No connection. Check your internet."),
        "tab.home": ("Início", "Home"), "tab.favourites": ("Favoritos", "Favourites"), "tab.alerts": ("Alertas", "Alerts"), "tab.profile": ("Perfil", "Profile"),
        "onb.1.title": ("Nunca perca um desconto", "Never miss a discount"), "onb.1.body": ("Veja os descontos dos seus cartões e carteiras móveis, perto de si.", "See discounts on your cards and mobile wallets, near you."),
        "onb.2.title": ("Alertas à sua volta", "Alerts around you"), "onb.2.body": ("Avisamos quando passa perto de um local com desconto para os seus cartões.", "We tell you when you walk past a place with a discount for your cards."),
        "onb.3.title": ("Só o que lhe interessa", "Only what matters to you"), "onb.3.body": ("Escolha os seus cartões e carteiras. Nunca guardamos o número do cartão.", "Choose your cards and wallets. We never store your card number."),
        "auth.login": ("Iniciar sessão", "Sign in"), "auth.register": ("Criar conta", "Create account"), "auth.email": ("Email", "Email"), "auth.password": ("Palavra-passe", "Password"),
        "auth.firstName": ("Nome", "First name"), "auth.lastName": ("Apelido", "Last name"), "auth.forgot": ("Esqueceu a palavra-passe?", "Forgot your password?"),
        "auth.noAccount": ("Ainda não tem conta?", "No account yet?"), "auth.haveAccount": ("Já tem conta?", "Already have an account?"),
        "auth.pwRules": ("Mínimo 8 caracteres com maiúscula, minúscula, número e carácter especial.", "At least 8 characters with upper and lower case, a number and a special character."),
        "auth.checkEmail": ("Verifique o seu email", "Check your email"), "auth.checkEmailBody": ("Enviámos uma ligação de confirmação para {email}. Abra-a e volte aqui para entrar.", "We sent a confirmation link to {email}. Open it, then come back here to sign in."),
        "auth.resend": ("Reenviar email", "Resend email"), "auth.resent": ("Se a conta existir, enviámos um novo email.", "If the account exists, we sent a new email."),
        "auth.forgotTitle": ("Recuperar palavra-passe", "Reset password"), "auth.forgotSent": ("Se existir uma conta com este email, enviámos instruções.", "If an account exists for this email, we sent instructions."),
        "auth.send": ("Enviar", "Send"), "auth.logout": ("Terminar sessão", "Sign out"), "auth.terms": ("Ao criar conta aceita os Termos e a Política de Privacidade (demonstração).", "By creating an account you accept the Terms and Privacy Policy (demo)."),
        "err.INVALID_CREDENTIALS": ("Email ou palavra-passe incorrectos.", "Wrong email or password."), "err.EMAIL_NOT_VERIFIED": ("Confirme o seu email para entrar.", "Confirm your email to sign in."),
        "err.ACCOUNT_LOCKED": ("Conta bloqueada temporariamente. Tente mais tarde.", "Account temporarily locked. Try later."), "err.RATE_LIMITED": ("Demasiadas tentativas. Tente mais tarde.", "Too many attempts. Try later."),
        "err.PASSWORD_WEAK": ("A palavra-passe não cumpre os requisitos.", "The password does not meet the requirements."), "err.VALIDATION_FAILED": ("Verifique os campos.", "Check the fields."),
        "err.ALREADY_ADDED": ("Já adicionou este item.", "You already added this item."), "err.NETWORK": ("Sem ligação. Verifique a internet.", "No connection. Check your internet."),
        "home.search": ("Pesquisar zona", "Search area"), "home.nearby": ("Perto de si", "Near you"), "home.recent": ("Novas ofertas", "New offers"), "home.ending": ("A terminar", "Ending soon"),
        "home.all": ("Tudo", "All"), "home.general": ("Gerais", "General"), "home.mine": ("Os meus", "Mine"), "home.noPlaces": ("Sem locais com estes filtros.", "No places match these filters."),
        "home.recenter": ("Centrar", "Recenter"), "home.places": ("{n} locais", "{n} places"), "home.backgroundOff": ("Os alertas em segundo plano estão desligados. Active «Sempre» nas definições de localização.", "Background alerts are off. Turn on “Always” in the location settings."),
        "home.openSettings": ("Abrir definições", "Open settings"),
        "detail.validUntil": ("Válido até {date}", "Valid until {date}"), "detail.directions": ("Direcções", "Directions"), "detail.call": ("Ligar", "Call"), "detail.share": ("Partilhar", "Share"),
        "detail.offers": ("Ofertas activas agora", "Offers active now"), "detail.noOffers": ("Sem ofertas activas neste momento.", "No active offers right now."), "detail.terms": ("Condições", "Terms"),
        "detail.redeem": ("Como resgatar", "How to redeem"), "detail.hours": ("Horário", "Hours"), "detail.eligible": ("Elegível", "Eligible"), "detail.minSpend": ("Gasto mínimo {n} MT", "Minimum spend {n} MT"),
        "detail.maxCap": ("Máximo {n} MT", "Up to {n} MT"), "detail.fav": ("Favorito", "Favourite"), "detail.notActive": ("Não activa agora", "Not active now"), "detail.premises": ("Locais", "Locations"),
        "elig.anyCard": ("Qualquer cartão bancário", "Any bank card"), "elig.anyWallet": ("Qualquer carteira móvel", "Any mobile wallet"), "elig.everyone": ("Toda a gente", "Everyone"), "elig.allCards": ("Todos os cartões {name}", "All {name} cards"),
        "fav.title": ("Favoritos", "Favourites"), "fav.empty": ("Ainda não tem favoritos", "No favourites yet"), "fav.hint": ("Toque no coração de uma oferta para a seguir.", "Tap the heart on an offer to follow it."),
        "alerts.title": ("Alertas", "Alerts"), "alerts.empty": ("Ainda sem alertas", "No alerts yet"), "alerts.hint": ("Os alertas de proximidade aparecem aqui.", "Proximity alerts show up here."),
        "alerts.suppressed": ("Suprimido", "Suppressed"),
        "profile.title": ("Perfil", "Profile"), "profile.cards": ("Os meus cartões e carteiras", "My cards and wallets"), "profile.prefs": ("Preferências de alertas", "Alert preferences"),
        "profile.security": ("Segurança", "Security"), "profile.faceId": ("Bloquear com Face ID", "Lock with Face ID"), "profile.language": ("Idioma", "Language"), "profile.privacy": ("Privacidade", "Privacy"),
        "profile.delete": ("Eliminar conta", "Delete account"), "profile.deleteBody": ("Os seus dados pessoais serão anonimizados. Isto não pode ser desfeito.", "Your personal data will be anonymised. This cannot be undone."),
        "profile.deleteConfirm": ("Confirme com a palavra-passe", "Confirm with your password"), "profile.about": ("Sobre", "About"), "profile.privacyNote": ("Demonstração: só guardamos a localização arredondada (~100 m) nos eventos de alerta.", "Demo: we only store a rounded location (~100 m) in alert events."),
        "cards.title": ("Cartões e carteiras", "Cards and wallets"), "cards.add": ("Adicionar cartão", "Add card"), "cards.addWallet": ("Adicionar carteira", "Add wallet"), "cards.bank": ("Banco", "Bank"),
        "cards.type": ("Tipo de cartão", "Card type"), "cards.product": ("Cartão", "Card"), "cards.empty": ("Ainda não adicionou cartões.", "You have not added any cards yet."), "cards.noWallets": ("Ainda não adicionou carteiras.", "You have not added any wallets yet."),
        "cards.nickname": ("Alcunha (opcional)", "Nickname (optional)"), "cards.never": ("Nunca pedimos o número, validade ou CVV.", "We never ask for the number, expiry or CVV."),
        "type.DEBIT": ("Débito", "Debit"), "type.CREDIT": ("Crédito", "Credit"), "type.PREPAID": ("Pré-pago", "Prepaid"),
        "prefs.alertsOn": ("Receber alertas", "Receive alerts"), "prefs.mode": ("Que ofertas", "Which offers"), "prefs.mode.PERSONALISED": ("Só dos meus cartões", "Only for my cards"),
        "prefs.mode.PERSONALISED_PLUS_GENERAL": ("Meus e bancos escolhidos", "Mine plus chosen banks"), "prefs.mode.ALL": ("Todas as ofertas", "All offers"),
        "prefs.quiet": ("Horas de silêncio", "Quiet hours"), "prefs.quietOn": ("Activar", "Enable"), "prefs.from": ("Das", "From"), "prefs.to": ("Às", "To"), "prefs.extraBanks": ("Bancos extra", "Extra banks"),
        "perm.location.title": ("Alertas perto de si", "Alerts near you"), "perm.location.body": ("Para o avisar quando passa por um local com desconto, precisamos da localização «Sempre». A localização exacta nunca sai do telemóvel: enviamos só uma versão arredondada.", "To tell you when you pass a place with a discount we need “Always” location. Your exact position never leaves the phone: we only send a rounded version."),
        "perm.location.allow": ("Permitir localização", "Allow location"), "perm.notif.title": ("Notificações", "Notifications"), "perm.notif.body": ("Mostramos o alerta como notificação quando estiver perto.", "We show the alert as a notification when you are nearby."),
        "perm.notif.allow": ("Permitir notificações", "Allow notifications"), "onb.cards.title": ("Os seus cartões", "Your cards"), "onb.cards.body": ("Escolha banco, tipo e cartão. Pode saltar e fazer depois.", "Pick bank, type and card. You can skip and do it later."),
        "lock.offerTitle": ("Entrar com Face ID?", "Sign in with Face ID?"), "lock.offerBody": ("Da próxima vez entra sem escrever a palavra-passe.", "Next time you will sign in without typing your password."), "lock.enable": ("Activar", "Enable"), "lock.notNow": ("Agora não", "Not now"),
        "profile.edit": ("Editar perfil", "Edit profile"), "profile.phone": ("Telefone (+258…)", "Phone (+258…)"), "profile.changePassword": ("Alterar palavra-passe", "Change password"), "profile.currentPassword": ("Palavra-passe actual", "Current password"),
        "profile.newPassword": ("Nova palavra-passe", "New password"), "profile.saved": ("Guardado.", "Saved."), "profile.exportData": ("Descarregar os meus dados", "Download my data"),
        "lock.title": ("Desbloquear", "Unlock"), "lock.reason": ("Desbloqueie a Moz Discounts", "Unlock Moz Discounts"), "lock.button": ("Usar Face ID", "Use Face ID"),
    ]
}
