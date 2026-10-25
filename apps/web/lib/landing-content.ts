// Copy for the public landing page ("/"). Portuguese first, English second.
export interface Step { b: string; s: string }
export interface Landing {
  title: string; description: string; skip: string; brand: string;
  nav: { story: string; ios: string; web: string; business: string; developers: string; guides: string; signIn: string; dashboard: string; lang: string };
  hero: { eyebrow: string; h1a: string; h1Em: string; h1b: string; lead: string; create: string; dashboard: string; map: string; testflight: string; howToJoin: string; notifTitle: string; notifBody: string; notifSmall: string; scroll: string };
  story: { alt: string; p1: string; h1: string; hEm: string; lead1: string; counter: string; p2: string; h2: string; h2Em: string; lead2: string; walking: string; walkingBody: string; nSmall: string; problem: string; solution: string; shops: string[]; missed: string; alerts: [string, string][] };
  ios: { eyebrow: string; h: string; hEm: string; steps: Step[]; mini: string; alts: string[] };
  personal: { eyebrow: string; h: string; hEm: string; lead: string; group: string; modes: [string, string][]; quiet: string; off: string; on: string; alts: string[] };
  web: { eyebrow: string; h: string; hEm: string; steps: Step[]; open: string; alts: string[]; tiles: string[]; tilesLabel: string; chips: string[] };
  aud: { eyebrow: string; h: string; hEm: string; cards: Step[]; manage: string; items: string[]; register: string };
  oss: { eyebrow: string; h: string; hEm: string; lead: string; github: string };
  dev: { eyebrow: string; h: string; hEm: string; lead: string; role: string; linkedin: string; built: string; marq1: string; marq2: string };
  guides: { eyebrow: string; h: string; hEm: string; steps: Step[]; links: Step[]; stack: string; stackNote: string; readme: string; tfH: string; tfP: string; tfBtn: string };
  foot: { about: string; signIn: string; create: string; privacy: string; label: string; guides: string; stack: string; github: string };
}

export const LANDING: Record<"pt" | "en", Landing> = {
  pt: {
    title: "Moz Discounts: nunca perca um desconto no cartão ou na carteira",
    description: "A Moz Discounts avisa-o quando está perto de um restaurante, supermercado ou spa com desconto no seu cartão bancário ou carteira móvel em Moçambique.",
    skip: "Saltar para o conteúdo", brand: "Moz Discounts",
    nav: { story: "História", ios: "App iOS", web: "App web", business: "Para empresas", developers: "Programadores", guides: "Guias", signIn: "Entrar", dashboard: "Abrir painel", lang: "English" },
    hero: {
      eyebrow: "Moçambique · MZN · cartões e carteiras", h1a: "O desconto estava", h1Em: "mesmo ali.", h1b: "Só que não sabia.",
      lead: "A Moz Discounts avisa-o quando passa perto de um restaurante, supermercado ou spa com oferta no <strong>seu</strong> cartão bancário ou carteira móvel, para deixar de perder poupanças.",
      create: "Criar conta", dashboard: "Abrir painel", map: "Explorar o mapa",
      testflight: "App iOS disponível para teste via <strong>TestFlight</strong>.", howToJoin: "Como entrar",
      notifTitle: "10% de desconto, a 80 m", notifBody: "no seu cartão BCI", notifSmall: "Moz Discounts · agora", scroll: "Ir para a história",
    },
    story: {
      alt: "Animação: uma pessoa caminha por uma rua e passa por um restaurante, um supermercado e um spa sem ver os descontos. Na segunda caminhada, um círculo de alerta à volta de cada local dispara uma notificação com a oferta.",
      p1: "1 · O problema", h1: "Os descontos existem.", hEm: "Ninguém lhe diz onde.",
      lead1: "Bancos e carteiras fecham acordos com lojas e restaurantes, mas a oferta fica num folheto, num SMS ou numa app que nunca abre. Paga o preço total e só depois descobre.",
      counter: "Descontos por que passou", p2: "2 · A solução", h2: "O telemóvel", h2Em: "fala na hora certa.",
      lead2: "Cada local participante tem um círculo invisível à volta. Entre nele e recebe uma notificação com a oferta exata do seu cartão ou carteira. A proximidade é calculada no seu telemóvel.",
      walking: "A caminhar…", walkingBody: "Os alertas aparecem quando se aproxima.", nSmall: "Moz Discounts · agora", problem: "Problema", solution: "Solução",
      shops: ["Restaurante", "Supermercado", "Spa"], missed: "perdido",
      alerts: [["Restaurante em frente: 10% de desconto", "No seu cartão BCI, a 80 m"], ["Supermercado perto: 5% de desconto", "A pagar com M-Pesa, a 60 m"], ["Spa à esquerda: 15% de desconto", "No seu cartão Absa, a 90 m"]],
    },
    ios: {
      eyebrow: "3 · A app iOS", h: "Percorra", hEm: "a app.",
      steps: [
        { b: "Entre e comece", s: "Crie a conta na app ou entre; da próxima vez desbloqueie com Face ID." },
        { b: "Descubra ofertas no mapa", s: "Filtre por Todas, Minhas, Gerais ou por banco. Pins por categoria, carrossel de novas ofertas, chips «Perto de si» e separadores Início, Favoritos, Alertas e Perfil." },
        { b: "Adicione cartões e carteiras", s: "BCI, Absa, M-Pesa, e-Mola, mKesh e outros. Só o produto, nunca o número, validade ou CVV." },
        { b: "Escolha os alertas", s: "Só os meus cartões, os meus mais bancos escolhidos, ou todas as ofertas, com horas de silêncio quando quiser sossego." },
      ],
      mini: "Disponível para teste no iOS através do TestFlight.",
      alts: ["Ecrã inicial da app com o logótipo Moz Discounts sobre cartões bancários desfocados.", "Mapa de Maputo com pins por categoria, chips de filtro, carrossel de novas ofertas e barra de separadores.", "Ecrã de cartões e carteiras com ABSA, BCI e M-Pesa e a nota de que a app nunca pede número, validade ou CVV.", "Preferências de alertas: só para os meus cartões, meus mais bancos escolhidos, todas as ofertas e horas de silêncio."],
    },
    personal: {
      eyebrow: "4 · Feito para a sua carteira", h: "Adicione os seus cartões.", hEm: "Nunca pedimos os números.",
      lead: "Escolha os seus cartões bancários e carteiras como BCI, Absa, Millennium bim, M-Pesa, e-Mola e mKesh. Nunca recolhemos número do cartão, validade nem CVV. Apenas o produto que tem.",
      group: "Para que ofertas quer alertas?",
      modes: [["Só para os meus cartões", "Só ouve falar dos descontos que os seus cartões e carteiras desbloqueiam."], ["Meus mais bancos escolhidos", "Os seus cartões mais os bancos que escolher, caso esteja a pensar mudar."], ["Todas as ofertas", "Todas as ofertas perto de si, qualquer que seja o cartão ou a carteira."]],
      quiet: "Horas de silêncio:", off: "desligado", on: "ligado, sem alertas durante a noite",
      alts: ["Ecrã de cartões e carteiras: cartões ABSA e BCI e uma carteira M-Pesa, com a nota de que a app nunca pede número, validade ou CVV.", "Ecrã de preferências de alertas com as três opções e um interruptor de horas de silêncio.", "Mapa de Maputo com pins por categoria e um carrossel de novas ofertas."],
    },
    web: {
      eyebrow: "5 · A app web", h: "Tudo,", hEm: "gerido num só lugar.",
      steps: [
        { b: "Uma só porta de entrada", s: "Entre, crie conta ou abra o mapa público de descontos sem conta. Português primeiro, inglês a um toque." },
        { b: "Perfil da empresa e aprovação", s: "Bancos, fornecedores de carteiras e comerciantes criam o perfil. Um administrador aprova-o antes de as ofertas ficarem ativas." },
        { b: "Locais e raio de alerta", s: "Adicione locais num mapa ou importe um CSV. Cada local tem o seu raio de alerta, por exemplo 150 m." },
        { b: "Descontos de rascunho a expirado", s: "Assistente passo a passo, benefícios por cartão e por carteira, horários, pré-visualização e ações em lote. Rascunho, publicado, em pausa, expirado, arquivado." },
        { b: "Relatórios e ferramentas de administração", s: "Estatísticas, exportações Excel, aprovação de empresas, catálogo de cartões e carteiras, utilizadores e registo de auditoria." },
      ],
      open: "Abrir a app web",
      alts: ["Página inicial da app web com Entrar, Criar conta e Mapa de descontos.", "Perfil da empresa com um banco aprovado e dados da marca.", "Lista de locais com categoria, cidade, raio de alerta em metros e estado, mais Importar CSV e Adicionar local.", "Lista de descontos com separadores de estado: todos, rascunho, publicado, em pausa, expirado, arquivado."],
      tiles: ["Relatórios e estatísticas", "Exportação Excel", "Aprovações de administração", "Catálogo de cartões e carteiras", "Gestão de utilizadores", "Registo de auditoria"],
      tilesLabel: "Relatórios, exportações Excel, aprovações de administração, catálogo, utilizadores e registo de auditoria",
      chips: ["Importar CSV", "Raio de alerta por local", "Benefícios por cartão"],
    },
    aud: {
      eyebrow: "6 · Para quem é", h: "Um portal web.", hEm: "Três tipos de pessoas.",
      cards: [
        { b: "Bancos e fornecedores de carteiras", s: "Registe ofertas de parceiros e ligue-as aos seus cartões e carteiras, por tipo de cartão ou por carteira. Os clientes que as têm recebem o alerta." },
        { b: "Restaurantes, lojas e spas", s: "Adicione os seus locais num mapa e publique ofertas para o público. Defina horários, pause ou termine quando quiser." },
        { b: "Clientes do dia a dia", s: "Escolha os cartões, explore o mapa, guarde ofertas favoritas e receba alertas quando passa por perto. Chega de folhetos." },
      ],
      manage: "Tudo é gerido na app web:", items: ["Perfil da empresa e aprovação", "Locais num mapa", "Descontos com assistente passo a passo", "Estatísticas e exportações Excel"], register: "Registar a sua empresa",
    },
    oss: { eyebrow: "7 · Código aberto", h: "Feito às claras.", hEm: "Leia, execute, melhore.", lead: "O portal web, a API e a app iOS vivem no mesmo repositório público. É uma prova de conceito, por isso comentários e pull requests são bem-vindos.", github: "Ver no GitHub" },
    dev: { eyebrow: "8 · Os programadores", h: "Pai e filho", hEm: "a resolver um problema do dia a dia.", lead: "Jaikumar e Joshkyle criaram a Moz Discounts juntos porque perder um desconto a que tinha direito é algo que todos já sentimos.", role: "Programador, Moz Discounts", linkedin: "Perfil no LinkedIn", built: "Feito às claras:", marq1: "PAI E FILHO · PAI E FILHO · PAI E FILHO", marq2: "FEITO EM CONJUNTO · FEITO EM CONJUNTO · FEITO EM CONJUNTO" },
    guides: {
      eyebrow: "9 · Guias", h: "Comece", hEm: "em minutos.",
      steps: [
        { b: "Crie uma conta", s: "Os clientes registam-se na web ou na app. As empresas registam-se e aguardam a aprovação do administrador." },
        { b: "Escolha cartões e carteiras", s: "Escolha apenas o produto. Nunca número, validade ou CVV." },
        { b: "Defina os alertas", s: "Só os meus cartões, os meus mais bancos escolhidos, ou todas as ofertas. Junte horas de silêncio se quiser." },
        { b: "Permita a localização e caminhe", s: "Permita a localização quando pedido para o telemóvel saber quando está perto de uma oferta." },
      ],
      links: [{ b: "Entrar", s: "Abrir a app web" }, { b: "Criar conta", s: "Clientes e empresas" }, { b: "Mapa público", s: "Ver ofertas, sem conta" }, { b: "Política de privacidade", s: "O que guardamos e porquê" }],
      stack: "Tecnologia", stackNote: "As regras de negócio vivem num pacote independente de frameworks, espelhado em Swift, para a web e o iOS se comportarem da mesma forma. Detalhes no", readme: "README do repositório",
      tfH: "Experimente a app iOS no TestFlight", tfP: "A app para iPhone está em teste. Peça um convite ao Jaikumar, instale a app TestFlight da Apple e abra o link do convite. As ofertas mostradas hoje são dados de demonstração.", tfBtn: "Pedir um convite",
    },
    foot: { about: "Uma prova de conceito feita em Moçambique. Sem ligação a qualquer banco ou fornecedor de carteiras. As ofertas mostradas são dados de demonstração.", signIn: "Entrar", create: "Criar conta", privacy: "Política de privacidade", label: "Etiqueta de privacidade", guides: "Guias", stack: "Tecnologia", github: "GitHub" },
  },
  en: {
    title: "Moz Discounts: never miss a card or wallet discount",
    description: "Moz Discounts alerts you when you are near a restaurant, supermarket or spa that offers a discount on your bank card or mobile wallet in Mozambique.",
    skip: "Skip to content", brand: "Moz Discounts",
    nav: { story: "Story", ios: "iOS app", web: "Web app", business: "For business", developers: "Developers", guides: "Guides", signIn: "Sign in", dashboard: "Open dashboard", lang: "Português" },
    hero: {
      eyebrow: "Mozambique · MZN · cards and wallets", h1a: "The discount was", h1Em: "right there.", h1b: "You just didn’t know.",
      lead: "Moz Discounts alerts you when you walk near a restaurant, supermarket or spa that offers a deal on <strong>your</strong> bank card or mobile wallet, so you stop missing out.",
      create: "Create account", dashboard: "Open dashboard", map: "Explore the map",
      testflight: "iOS app available to test via <strong>TestFlight</strong>.", howToJoin: "How to join",
      notifTitle: "10% off, 80 m away", notifBody: "on your BCI card", notifSmall: "Moz Discounts · now", scroll: "Scroll to the story",
    },
    story: {
      alt: "Animation: a person walks down a street past a restaurant, a supermarket and a spa without noticing their discounts. On the second walk, an alert circle around each place triggers a notification with the offer.",
      p1: "1 · The problem", h1: "Discounts exist.", hEm: "Nobody tells you where.",
      lead1: "Banks and wallets sign deals with shops and restaurants, but the offer sits in a leaflet, an SMS or an app you never open. You pay full price, then find out later.",
      counter: "Discounts walked past", p2: "2 · The solution", h2: "Your phone", h2Em: "speaks up at the right moment.",
      lead2: "Every participating place has an invisible circle around it. Step inside and you get a notification with the exact offer on your card or wallet. Proximity is worked out on your phone.",
      walking: "Walking…", walkingBody: "Alerts appear as you come close.", nSmall: "Moz Discounts · now", problem: "Problem", solution: "Solution",
      shops: ["Restaurant", "Supermarket", "Spa"], missed: "missed",
      alerts: [["Restaurant ahead: 10% off", "On your BCI card, 80 m away"], ["Supermarket nearby: 5% off", "Paying with M-Pesa, 60 m away"], ["Spa on your left: 15% off", "On your Absa card, 90 m away"]],
    },
    ios: {
      eyebrow: "3 · The iOS app", h: "Scroll through", hEm: "the app.",
      steps: [
        { b: "Sign in and get started", s: "Create your account in the app or sign in, then unlock with Face ID next time." },
        { b: "Discover offers on the map", s: "Filter by All, Mine, General or a bank. Category pins, a New offers carousel, Near you chips, and tabs for Home, Favourites, Alerts and Profile." },
        { b: "Add your cards and wallets", s: "BCI, Absa, M-Pesa, e-Mola, mKesh and more. Only the product, never the number, expiry or CVV." },
        { b: "Choose your alerts", s: "Only my cards, mine plus chosen banks, or all offers, with quiet hours when you want peace." },
      ],
      mini: "Available to test on iOS through TestFlight.",
      alts: ["Splash screen of the app with the Moz Discounts logo over blurred bank cards.", "Home map of Maputo with category pins, filter chips, a New offers carousel and the tab bar.", "Cards and wallets screen with ABSA, BCI and M-Pesa and a note that the app never asks for number, expiry or CVV.", "Alert preferences: only for my cards, mine plus chosen banks, all offers and quiet hours."],
    },
    personal: {
      eyebrow: "4 · Made for your wallet", h: "Add your cards.", hEm: "We never ask for the numbers.",
      lead: "Pick your bank cards and wallets such as BCI, Absa, Millennium bim, M-Pesa, e-Mola and mKesh. We never collect a card number, expiry date or CVV. Only the product you hold.",
      group: "Which offers do you want alerts for?",
      modes: [["Only for my cards", "You only hear about discounts your own cards and wallets unlock."], ["Mine plus chosen banks", "Your cards plus the banks you choose, in case you are thinking of switching."], ["All offers", "Every offer near you, whichever card or wallet it needs."]],
      quiet: "Quiet hours:", off: "off", on: "on, no alerts overnight",
      alts: ["Cards and wallets screen: ABSA, BCI cards and an M-Pesa wallet, with the note that the app never asks for number, expiry or CVV.", "Alert preferences screen with Only for my cards, Mine plus chosen banks, All offers and a quiet hours switch.", "Home map of Maputo with category pins and a New offers carousel."],
    },
    web: {
      eyebrow: "5 · The web app", h: "Everything,", hEm: "managed in one place.",
      steps: [
        { b: "One front door", s: "Sign in, create an account or open the public discount map with no account. Portuguese first, English one tap away." },
        { b: "Business profile and approval", s: "Banks, wallet providers and merchants set up their profile. An admin approves it before offers go live." },
        { b: "Premises and alert radius", s: "Add places on a map or import a CSV. Each place gets its own alert radius, such as 150 m." },
        { b: "Discounts from draft to expired", s: "A step-by-step wizard, per-card and per-wallet benefits, schedules, preview and bulk actions. Draft, published, paused, expired, archived." },
        { b: "Reports and admin tools", s: "Statistics, Excel exports, business approvals, the card and wallet catalogue, users and an audit trail." },
      ],
      open: "Open the web app",
      alts: ["Web app landing page with Sign in, Create account and Discount map.", "Business profile page showing an approved bank and brand details.", "Premises list with category, city, alert radius in metres and status, plus Import CSV and Add premises.", "Discounts list with status tabs: all, draft, published, paused, expired, archived."],
      tiles: ["Reports and stats", "Excel export", "Admin approvals", "Card and wallet catalogue", "User management", "Audit trail"],
      tilesLabel: "Reports, Excel exports, admin approvals, catalogue, users and audit trail",
      chips: ["Import CSV", "Alert radius per place", "Per-card benefits"],
    },
    aud: {
      eyebrow: "6 · Who it is for", h: "One web portal.", hEm: "Three kinds of people.",
      cards: [
        { b: "Banks and wallet providers", s: "Capture partner offers and link them to your cards and wallets, per card type or per wallet. Customers holding them get the alert." },
        { b: "Restaurants, shops and spas", s: "Add your premises on a map and publish offers for the general public. Set schedules, pause or end them any time." },
        { b: "Everyday customers", s: "Choose your cards, browse the map, favourite offers and get alerts as you walk by. No more leaflets." },
      ],
      manage: "Everything is managed from the web app:", items: ["Business profile and approval", "Premises on a map", "Discounts with a step-by-step wizard", "Stats and Excel exports"], register: "Register your business",
    },
    oss: { eyebrow: "7 · Open source", h: "Built in the open.", hEm: "Read it, run it, improve it.", lead: "The web portal, the API and the iOS app all live in one public repository. It is a proof of concept, so feedback and pull requests are welcome.", github: "View on GitHub" },
    dev: { eyebrow: "8 · The developers", h: "A father and son", hEm: "fixing an everyday problem.", lead: "Jaikumar and Joshkyle built Moz Discounts together because missing out on a deal you were entitled to is something everyone has felt.", role: "Developer, Moz Discounts", linkedin: "LinkedIn profile", built: "Built in the open:", marq1: "FATHER & SON · FATHER & SON · FATHER & SON", marq2: "BUILT TOGETHER · BUILT TOGETHER · BUILT TOGETHER" },
    guides: {
      eyebrow: "9 · Guides", h: "Get started", hEm: "in minutes.",
      steps: [
        { b: "Create an account", s: "Customers register on the web or in the app. Businesses register and wait for admin approval." },
        { b: "Pick your cards and wallets", s: "Choose the product only. No number, expiry or CVV, ever." },
        { b: "Set your alerts", s: "Only my cards, mine plus chosen banks, or all offers. Add quiet hours if you like." },
        { b: "Allow location and walk", s: "Allow location when prompted so the phone can tell when you are near an offer." },
      ],
      links: [{ b: "Sign in", s: "Open the web app" }, { b: "Create account", s: "Customers and businesses" }, { b: "Public map", s: "See offers, no sign-in" }, { b: "Privacy policy", s: "What we store and why" }],
      stack: "Technology stack", stackNote: "Business rules live in a framework-free core package, mirrored in Swift, so web and iOS behave the same. Details in the", readme: "repository README",
      tfH: "Try the iOS app on TestFlight", tfP: "The iPhone app is in testing. Ask Jaikumar for an invitation, install Apple’s TestFlight app, then open the invite link. Offers shown today are demonstration data.", tfBtn: "Ask for an invite",
    },
    foot: { about: "A proof of concept made in Mozambique. Not affiliated with any bank or wallet provider. Offers shown are demonstration data.", signIn: "Sign in", create: "Create account", privacy: "Privacy policy", label: "Privacy label", guides: "Guides", stack: "Technology stack", github: "GitHub" },
  },
};
export const STACK = ["Next.js 16", "React 19", "TypeScript", "PostgreSQL on Neon", "Prisma 7", "Vercel", "SwiftUI", "MapKit", "CoreLocation", "Vitest", "Playwright + axe", "XCTest"];
