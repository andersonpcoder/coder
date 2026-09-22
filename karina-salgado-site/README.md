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
- `blog.html` — Grid de posts (capa, título, data)
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
- `karina-consultorio-1.jpg` / `karina-consultorio-2.jpg` — 2 das 4 fotos
  da galeria em Consultório

## Sobre / Formação

Bio ("Quem sou eu") e a lista de formação na Início já usam dados reais
enviados pela cliente: atua desde 2014, graduação e mestrado pela UFPA,
especialização em Ortodontia e Ortopedia Facial pela ABO-PA, e docência de
pós-graduação no Instituto Odontológico das Américas. E-mail de contato:
`karinasalgado7@hotmail.com` (já aplicado no formulário e no fallback
`mailto:`).

## Mapa / localização

O link do Google Maps enviado pela cliente
(`https://maps.app.goo.gl/aQv5k465MCF19TEn8`) já está aplicado como botão
"Ver localização no Google Maps" nas páginas Início e Consultório
(`.map-frame`). Esse link curto não pôde ser resolvido automaticamente
(bloqueado pelo proxy de rede do ambiente de desenvolvimento) para gerar
um mapa **incorporado** (iframe). Assim que o endereço completo em texto
(rua, número, bairro, cidade) for informado, dá pra trocar o botão por um
embed real.

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
  rodapé da Início — hoje usam o número placeholder `5500000000000`
  (formato esperado: `55` + DDD + número, sem espaços/traços).

## Pendências antes de publicar

Estes itens estão marcados no próprio HTML/CSS com placeholders e devem
ser substituídos por conteúdo real da cliente:

- 2 fotos que faltam na galeria do Consultório (`.img-placeholder` em
  `consultorio.html`) — só havia 5 fotos disponíveis no total.
- Fotos dos parceiros (Dra. Bruna Gilho, Dr. Sérgio Sizo) e capas dos
  posts do blog.
- Endereço completo em texto do consultório, para gerar o mapa
  incorporado (embed) em vez do botão de link (ver seção acima).
- Integração real do formulário de contato (atualmente usa `mailto:` para
  `karinasalgado7@hotmail.com` como fallback — ver `TODO` em
  `assets/js/main.js`) e o link do Facebook no rodapé.
- Número de WhatsApp real (ver seção "SEO / metadados" acima).
- Domínio real (troca o placeholder `karinasalgado.com.br` nas meta tags,
  `robots.txt` e `sitemap.xml`).
- Anos de cada etapa da formação (a lista já tem instituições reais —
  UFPA, ABO-PA, Instituto Odontológico das Américas — mas sem ano
  individual; só sabemos que ela atua na odontologia desde 2014).
- Conteúdo real dos posts do blog (atualmente com título de exemplo e
  "Em breve" como data).
- Cadastro no Google Perfil da Empresa (Google Business Profile) — não é
  algo que se faz pelo código, mas é o principal fator para a clínica
  aparecer nas buscas locais do Google; recomendo fazer isso assim que o
  endereço estiver definido.
