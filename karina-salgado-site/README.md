# Site — Karina Salgado (Ortodontista)

Site institucional estático (HTML/CSS/JS puro, sem build step) para a
ortodontista Karina Salgado, baseado no briefing em vídeo da cliente.

## Estrutura

- `index.html` — Início (hero, três tipos de tratamento, quem sou eu, área
  de atuação, formação, fale conosco + mapa)
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

O formulário do rodapé (`#contactForm` na Início) já está preparado para
envio automático via [Web3Forms](https://web3forms.com) (serviço gratuito,
sem backend próprio):

1. Crie uma conta gratuita em web3forms.com com o e-mail
   `karinasalgado7@hotmail.com` e copie a "Access Key" gerada.
2. Em `index.html`, troque o valor `PENDENTE_WEB3FORMS_ACCESS_KEY` do campo
   `<input type="hidden" name="access_key" ...>` pela chave real.

Enquanto a chave não for trocada, ou se a chamada à API falhar por qualquer
motivo (sem internet, serviço fora do ar), o formulário cai automaticamente
no fallback `mailto:` já existente — abre o cliente de e-mail do visitante
e mostra a mensagem na tela com um botão "Copiar mensagem", para o caso de
nenhum cliente de e-mail estar configurado no navegador.

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

## SEO / metadados

Já aplicados em todas as páginas, mas com placeholders que **precisam
ser trocados quando o domínio real for definido** (marcados com
`PENDENTE` no HTML):

- Favicon "KS" (`assets/img/favicon.svg`).
- Meta tags Open Graph / Twitter Card (título, descrição, imagem) para
  preview bonito ao compartilhar o link no WhatsApp/Instagram — hoje
  apontam para `https://www.karinasalgado.com.br/...` como placeholder.
- `robots.txt` e `sitemap.xml` — mesmo placeholder de domínio.
- Botão flutuante de WhatsApp em todas as páginas + link do WhatsApp no
  rodapé da Início — já usam o número real (`5591920054813` / +55 91
  92005-4813).

## Pendências antes de publicar

Estes itens estão marcados no próprio HTML/CSS com placeholders e devem
ser substituídos por conteúdo real da cliente:

- Fotos dos parceiros (Dra. Bruna Gilho, Dr. Sérgio Sizo).
- Access key real do Web3Forms no formulário de contato — ver seção
  "Formulário de contato" acima (o código já está pronto, falta só a
  cliente gerar a chave gratuita e colar em `index.html`).
- Link real do Facebook no rodapé (sabemos que a página se chama "Dra
  Karina Salgado" no Facebook, mas não temos a URL).
- Domínio real (troca o placeholder `karinasalgado.com.br` nas meta tags,
  `robots.txt` e `sitemap.xml`).
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
