// Public privacy policy text (PT first, EN second). Keep it in step with docs/app-store-submission.md (privacy labels).
export const PRIVACY_UPDATED = "2026-10-24";
export const PRIVACY_CONTACT = process.env.PRIVACY_CONTACT_EMAIL ?? "jkbytesjr@gmail.com";

interface Section { h: string; p?: string[]; ul?: string[] }
interface Doc { title: string; updated: string; intro: string; sections: Section[] }

export const PRIVACY: Record<"pt" | "en", Doc> = {
  pt: {
    title: "Política de Privacidade",
    updated: "Última atualização",
    intro: "A Moz Discounts ajuda-o a encontrar descontos nos seus cartões bancários e carteiras móveis em Moçambique e avisa-o quando passa perto de um local com oferta. Esta política explica que dados tratamos, porquê, e que controlo tem sobre eles. É um serviço de demonstração (POC): os dados de exemplo são fictícios e estão assinalados como tal.",
    sections: [
      { h: "1. Dados que recolhemos", ul: [
        "Conta: nome, apelido, email, telefone (opcional), idioma e a sua palavra-passe, guardada apenas como hash seguro (argon2).",
        "Cartões e carteiras: apenas o produto que escolhe (por exemplo, «Absa Visa Débito» ou «M-Pesa»). Nunca guardamos o número do cartão, validade, CVV nem os últimos quatro dígitos.",
        "Preferências: modo e horário dos alertas, bancos extra e favoritos.",
        "Localização: a app usa a sua localização no telemóvel para centrar o mapa e decidir, no próprio aparelho, se está perto de uma oferta. O servidor só recebe a sua posição (arredondada a cerca de 100 m) quando é enviado um evento de alerta, e as coordenadas atuais para pedir ofertas próximas. Não vendemos nem partilhamos a sua localização.",
        "Histórico de alertas: tipo de alerta, local, desconto e hora.",
        "Token de notificações push do aparelho, se permitir notificações.",
        "Segurança: registos de início de sessão e de ações administrativas, contadores de tentativas por endereço IP e avisos de novo dispositivo.",
        "Contas de empresa: dados do negócio, locais e descontos que publica.",
      ] },
      { h: "2. Para que usamos os dados", ul: [
        "Criar e proteger a sua conta e enviar emails de confirmação, recuperação de palavra-passe e avisos de segurança.",
        "Mostrar-lhe os descontos que correspondem aos seus cartões e carteiras e enviar alertas de proximidade.",
        "Fornecer às empresas estatísticas agregadas; as empresas não veem a sua identidade.",
        "Prevenir abuso e manter o serviço seguro.",
        "Não usamos os seus dados para publicidade, não os vendemos e não os usamos para o seguir noutras apps ou sites.",
      ] },
      { h: "3. Com quem partilhamos", p: ["Usamos prestadores que tratam dados em nosso nome:"], ul: [
        "Vercel (alojamento do site e da API).",
        "Neon (base de dados PostgreSQL, região da União Europeia).",
        "Google (envio de emails através do Gmail; no mapa web, Google Maps).",
        "Apple (mapas MapKit e notificações push APNs na app iOS).",
        "Cloudflare Turnstile (verificação anti-robô, apenas depois de várias tentativas falhadas de início de sessão, quando ativada).",
      ] },
      { h: "4. Conservação e eliminação", p: ["Guardamos os dados enquanto a conta existir. Pode eliminar a conta na app (Perfil) ou no portal (Conta): os dados pessoais são anonimizados e a conta deixa de ser utilizável. O registo de auditoria de segurança é conservado sem dados que o identifiquem."] },
      { h: "5. Os seus direitos", p: ["Pode aceder, corrigir e exportar os seus dados no Perfil da app e no portal, alterar as preferências de alertas, desligar a localização nas definições do iOS, e eliminar a conta. Para qualquer outro pedido, contacte-nos."] },
      { h: "6. Segurança", p: ["As ligações usam HTTPS. As palavras-passe têm hash, as sessões usam cookies seguros e os administradores usam autenticação em dois passos. Nenhum sistema é totalmente seguro, mas limitamos o acesso e os dados guardados ao necessário."] },
      { h: "7. Crianças", p: ["O serviço não se destina a menores de 16 anos e não recolhemos intencionalmente dados de crianças."] },
      { h: "8. Alterações e contacto", p: ["Se alterarmos esta política, atualizamos a data acima. Questões e pedidos: ", ] },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated",
    intro: "Moz Discounts helps you find discounts on your bank cards and mobile wallets in Mozambique and alerts you when you pass a place with an offer. This policy explains what data we handle, why, and what control you have. This is a demonstration service (POC): sample data is fictional and labelled as such.",
    sections: [
      { h: "1. Data we collect", ul: [
        "Account: first and last name, email, phone (optional), language, and your password, stored only as a secure hash (argon2).",
        "Cards and wallets: only the product you choose (for example “Absa Visa Debit” or “M-Pesa”). We never store a card number, expiry, CVV or the last four digits.",
        "Preferences: alert mode and quiet hours, extra banks and favourites.",
        "Location: the app uses your phone's location to centre the map and decide, on the device, whether you are near an offer. The server only receives your position (rounded to about 100 m) when an alert event is sent, and the current coordinates to request nearby offers. We do not sell or share your location.",
        "Alert history: alert type, place, discount and time.",
        "Your device's push-notification token, if you allow notifications.",
        "Security: sign-in and admin action logs, per-IP attempt counters and new-device notices.",
        "Business accounts: the business details, premises and discounts you publish.",
      ] },
      { h: "2. How we use it", ul: [
        "To create and protect your account and send confirmation, password-reset and security emails.",
        "To show discounts that match your cards and wallets and to send proximity alerts.",
        "To give businesses aggregated statistics; businesses cannot see who you are.",
        "To prevent abuse and keep the service secure.",
        "We do not use your data for advertising, we do not sell it, and we do not use it to track you across other apps or websites.",
      ] },
      { h: "3. Who we share it with", p: ["We use providers that process data on our behalf:"], ul: [
        "Vercel (hosting of the website and API).",
        "Neon (PostgreSQL database, European Union region).",
        "Google (email delivery through Gmail; Google Maps on the web map).",
        "Apple (MapKit maps and APNs push notifications in the iOS app).",
        "Cloudflare Turnstile (anti-bot check, only after several failed sign-in attempts, when enabled).",
      ] },
      { h: "4. Retention and deletion", p: ["We keep your data while your account exists. You can delete the account in the app (Profile) or the portal (Account): personal data is anonymised and the account can no longer be used. The security audit log is kept without data that identifies you."] },
      { h: "5. Your rights", p: ["You can view, correct and export your data in the app's Profile and in the portal, change alert preferences, turn off location in iOS Settings, and delete your account. For any other request, contact us."] },
      { h: "6. Security", p: ["Connections use HTTPS. Passwords are hashed, sessions use secure cookies, and administrators use two-step verification. No system is perfectly secure, but we limit access and stored data to what is needed."] },
      { h: "7. Children", p: ["The service is not intended for people under 16 and we do not knowingly collect children's data."] },
      { h: "8. Changes and contact", p: ["If we change this policy we update the date above. Questions and requests: "] },
    ],
  },
};
