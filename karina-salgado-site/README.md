# Site — Karina Salgado (Ortodontista)

Site institucional estático (HTML/CSS/JS puro, sem build step) para a
ortodontista Karina Salgado, baseado no briefing em vídeo da cliente.

## Estrutura

- `index.html` — Início (banner cheio com foto + overlay escuro no estilo
  editorial, três tipos de tratamento, quem sou eu, área de atuação,
  formação, fale conosco + mapa)
- `tratamentos.html` — Tratamento Infantil, Invisalign, Tratamento
  Ortopédico, e o bloco "Ortodontia além dos dentes" (apneia obstrutiva do
  sono, respiração bucal, hábitos de sucção)
- `parcerias.html` — Parceiros (Dra. Bruna Gilho, Dr. Sérgio Sizo) e demais
  serviços (limpeza, restauração, periodontal, clareamento, canal,
  extração, cárie)
- `consultorio.html` — Galeria de fotos do consultório e mapa de como
  chegar
- `blog.html` — Landing page do blog: hero com CTA, filtros de categoria
  funcionais e grid com os 8 artigos (imagem, categoria, título, descrição,
  tempo de leitura)
- `blog/` — os 8 artigos completos, cada um como página própria (breadcrumb,
  categoria, título, subtítulo, imagem, corpo do texto, FAQ expansível,
  artigos relacionados e CTA de agendamento)
- `lp/` — landing pages de campanha para tráfego pago (Google/Meta Ads),
  sem menu de navegação, focadas 100% em conversão (ver seção "Landing
  pages de campanha" abaixo)
- `assets/css/style.css` — estilos compartilhados (luxo minimalista, fundo
  branco, Cormorant Garamond + Jost, animações de entrada/scroll-reveal)
- `assets/js/main.js` — menu mobile, formulário de contato e scroll-reveal
- `assets/img/favicon.svg` — favicon "KS" minimalista
- `robots.txt` / `sitemap.xml` — indexação básica para buscadores

## Visualizar localmente

Não há build step. Basta servir a pasta com qualquer servidor estático:

```sh
cd karina-salgado-site
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Deploy: domínio karinasalgado.com (Hostinger) + hospedagem no Netlify

O domínio real é `karinasalgado.com`, comprado na Hostinger, e já está
aplicado em todo o código (meta tags, `robots.txt`, `sitemap.xml`,
`canonical` de todas as páginas e artigos do blog, dados estruturados
Schema.org). Falta só publicar. O `netlify.toml` já está pronto na raiz
deste diretório (publica o site como está, sem build step). Passo a passo:

1. **Criar o site no Netlify**: em app.netlify.com, "Add new site" →
   conectar este repositório GitHub → em "Base directory" apontar para
   `karina-salgado-site` (é onde está o `netlify.toml`). Sem build command
   necessário. Isso já gera um link temporário tipo
   `nome-aleatorio.netlify.app` com o site no ar.
2. **Adicionar o domínio no Netlify**: em "Domain settings" → "Add a
   domain" → digitar `karinasalgado.com`.
3. **Apontar o domínio pra lá**: o Netlify mostra 2 nameservers (algo como
   `dns1.p0X.nsone.net`). No hPanel da Hostinger, em
   **Domínios → karinasalgado.com → DNS/Nameservers → Editar**, trocar os
   nameservers atuais (hoje estão em `lunar.dns-parking.com` /
   `solar.dns-parking.com`, que é o "estacionamento" padrão da Hostinger
   pra domínio sem uso) pelos nameservers que o Netlify indicou.
4. Esperar a propagação de DNS (de minutos a algumas horas) — o Netlify
   emite o certificado HTTPS automaticamente assim que detectar o domínio
   apontado corretamente.

Esses 3 passos só podem ser feitos por quem tem acesso às contas da
Hostinger e do Netlify — não são algo que se resolve pelo código.

## Fotos

As 5 fotos reais enviadas pela cliente estão em `assets/img/` e já estão
aplicadas:

- `karina-hero.jpg` — hero da Início (fundo cinza, conforme pedido no
  vídeo)
- `karina-perfil.jpg` — foto circular "quem sou eu" na Início
- `karina-formacao.jpg` — foto ao lado da lista de formação na Início
- `karina-consultorio-1.jpg` a `karina-consultorio-4.jpg` — as 4 fotos da
  galeria em Consultório (completa)

## Sobre / Formação

Bio ("Quem sou eu") e a lista de formação na Início já usam dados reais
enviados pela cliente: atua desde 2014, graduação e mestrado pela UFPA,
especialização em Ortodontia e Ortopedia Facial pela ABO-PA, e docência de
pós-graduação no Instituto Odontológico das Américas. E-mail de contato:
`karinasalgado7@hotmail.com`.

## Formulário de contato

O formulário do rodapé (`#contactForm` na Início) envia o contato direto
pelo WhatsApp, em vez de e-mail: ao clicar em "Continuar no WhatsApp", o
site monta uma mensagem com nome, e-mail (se preenchido) e a mensagem
digitada, e abre uma nova aba em `wa.me/5591920054813` já com o texto
pronto para o visitante só confirmar o envio. Se o navegador bloquear a
abertura automática (pop-up blocker), aparece um link "Clique aqui para
continuar no WhatsApp" no lugar. O campo de e-mail é opcional, já que a
conversa segue pelo WhatsApp.

## Mapa / localização

Endereço real aplicado (Travessa 14 de Março, 1155 — Umarizal, Belém - PA,
66055-490), com mapa **incorporado** (iframe do Google Maps via busca por
endereço, sem precisar de API key) nas páginas Início e Consultório, mais
um link "Abrir no Google Maps" apontando pro link curto original da
cliente. Também adicionei dados estruturados (Schema.org `Dentist`) na
Início com nome, endereço, telefone e e-mail — ajuda o Google a entender
que é uma clínica odontológica local.

## Blog

O blog foi redesenhado como uma seção completa de educação, autoridade e
conversão, não apenas uma lista de posts:

- `blog.html` é uma landing page: hero com título, subtítulo e CTA de
  agendamento, seguido de filtros de categoria (Ortodontia, Aparelhos,
  Cuidados, Saúde Bucal, Dúvidas Frequentes, Tratamentos) que mostram/escondem
  os cards via JS puro (`data-category` no card + `data-filter` no botão),
  sem depender de backend.
- 8 artigos completos em `blog/`, cada um respondendo uma dúvida comum de
  paciente (quando usar aparelho, aparelho fixo x alinhador, duração do
  tratamento, dor, higiene, alimentos a evitar, idade ideal, e a importância
  da contenção). Cada artigo é uma página própria com breadcrumb, categoria,
  título, subtítulo, imagem de capa (fotos reais do consultório/perfil da
  cliente), corpo do texto, FAQ expansível (`<details>`/`<summary>`, sem JS) e
  2 artigos relacionados antes do CTA final.
- SEO: título e descrição únicos por artigo, URL amigável por slug,
  `rel="canonical"`, e dados estruturados Schema.org (`BreadcrumbList` e
  `FAQPage`) em cada página de artigo. `sitemap.xml` já lista todas as 9
  páginas do blog.

## Logo real e banner da Início

A cliente enviou a arte final da logo (monograma "KS" entrelaçado +
"Dra. Karina Salgado Ortodontia"). Ela é usada em dois tamanhos:

- `assets/img/karina-monogram.png` — só o monograma, recortado da arte
  original, usado no cabeçalho de todas as páginas (a arte completa, com
  o texto, fica ilegível em tamanho de cabeçalho).
- `assets/img/karina-logo.jpg` — a arte completa (monograma + nome +
  "Ortodontia"), disponível para usos maiores (ex.: redes sociais,
  materiais impressos).

O banner da Início foi redesenhado no estilo de uma referência visual que
a cliente enviou (clínica com banner escuro, foto de fundo, texto grande
em overlay e botão de destaque): agora é uma seção cheia com a foto real
da Dra. Karina, gradiente escuro por cima, título grande em serifa,
subtítulo, CTA e indicador "role para explorar". Usa uma foto real já
aprovada (`karina-hero.jpg`), não uma foto genérica de banco de imagens.

## Ícones em vez de fotos (parceiros)

Um ponto onde optei por ícone em vez de foto:

- **Parceiros** (`parcerias.html`): os cards de Dra. Bruna Gilho e Dr.
  Sérgio Sizo usam um monograma com as iniciais (`.partner-initials`,
  mesmo tratamento visual do logo "KS"), porque não temos foto real
  verificada de nenhum dos dois — usar uma foto genérica da internet como
  se fosse a foto de uma pessoa real e nomeada não é algo que eu faço.

Se a cliente enviar fotos reais depois dos parceiros, é só trocar o
`.partner-initials` pelo `.photo-frame` já usado no resto do site.

Os cards de `tratamentos.html` (Tratamento Infantil, Invisalign, Tratamento
Ortopédico) já usam fotos reais do consultório (`.photo-frame`) em vez dos
ícones que existiam antes — ver seção "Banda de fotos reais" abaixo.

## Banda de fotos reais (substitui "fotos de resultados")

Não é possível, neste ambiente de desenvolvimento, baixar fotos de banco de
imagens (Unsplash, Pexels) nem acessar o Instagram da cliente — o proxy de
rede da sandbox bloqueia esses domínios (testado diretamente, ver histórico
do projeto). Diante disso, em vez de uma seção de "resultados" com fotos que
eu não teria como obter (e que, tratando-se de fotos de pacientes reais,
exigiriam autorização confirmada de cada um), optei por uma resposta
honesta: uma seção escura e ampla (`.gallery-band`), no estilo da
referência visual que a cliente enviou, mostrando fotos 100% reais e já
aprovadas do consultório, com um CTA direto para o Instagram
(`@dra.karinasalgado`) — que é onde os resultados reais de pacientes já
estão publicados, com autorização de cada um.

Essa seção aparece em dois lugares:

- **Início** (`index.html`), entre "Área de atuação" e "Formação": título
  "Conheça o espaço onde cada tratamento acontece", com CTA duplo (Instagram
  + Consultório completo).
- **Blog** (`blog.html`), depois da grade de artigos: título "Quer ver
  resultados reais de pacientes?", direcionando quem já leu os artigos para
  o Instagram.

O link do Instagram também foi corrigido no rodapé da Início (antes apontava
para `#`).

## Landing pages de campanha

Além do site institucional e do blog, `lp/` tem 3 landing pages
standalone, pensadas para tráfego pago (Google Ads / Meta Ads), sem o
menu de navegação do site — só o essencial para converter uma dúvida
específica em agendamento pelo WhatsApp:

- `lp/avaliacao-ortodontica.html` — avaliação geral, topo de funil.
- `lp/invisalign.html` — foco em alinhadores transparentes.
- `lp/ortodontia-infantil.html` — foco em pais buscando avaliação para
  os filhos.

Todas seguem a mesma estrutura: hero com CTA direto pro WhatsApp (com
mensagem pré-preenchida identificando que veio do anúncio), barra de
credenciais reais, lista de benefícios, FAQ e um CTA final. Estão
marcadas com `<meta name="robots" content="noindex, follow">` — não
competem com `tratamentos.html`/blog no Google orgânico, mas continuam
100% acessíveis e rastreáveis por link para uso em anúncios.

## SEO / metadados

Já aplicados em todas as páginas, com o domínio real `karinasalgado.com`:

- Favicon "KS" (`assets/img/favicon.svg`).
- Meta tags Open Graph / Twitter Card (título, descrição, imagem absoluta)
  para preview bonito ao compartilhar o link no WhatsApp/Instagram.
- `<link rel="canonical">` em todas as páginas e artigos do blog.
- `robots.txt` e `sitemap.xml` apontando para `karinasalgado.com`.
- Dados estruturados Schema.org (`Dentist` na Início, `BreadcrumbList` e
  `FAQPage` em cada artigo do blog) com `url`/`image` absolutos.
- Botão flutuante de WhatsApp em todas as páginas + link do WhatsApp no
  rodapé da Início — já usam o número real (`5591920054813` / +55 91
  92005-4813).

## Pendências antes de publicar

Estes itens estão marcados no próprio HTML/CSS com placeholders e devem
ser substituídos por conteúdo real da cliente:

- Fotos reais dos parceiros (Dra. Bruna Gilho, Dr. Sérgio Sizo) — hoje
  usam monograma com iniciais em vez de foto (ver seção "Ícones em vez
  de fotos" acima).
- Link real do Facebook no rodapé (sabemos que a página se chama "Dra
  Karina Salgado" no Facebook, mas não temos a URL).
- Horário de funcionamento completo (só vimos terça-feira 08h-12h /
  14h-18h numa captura de tela; não coloquei horário no site pra não
  sugerir que só atende às terças).
- Anos de cada etapa da formação (a lista já tem instituições reais —
  UFPA, ABO-PA, Instituto Odontológico das Américas — mas sem ano
  individual; só sabemos que ela atua na odontologia desde 2014).
- Cadastro no Google Perfil da Empresa (Google Business Profile) — não é
  algo que se faz pelo código, mas é o principal fator para a clínica
  aparecer nas buscas locais do Google; recomendo fazer isso assim que o
  endereço estiver definido.
