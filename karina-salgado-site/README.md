# Site — Karina Salgado (Ortodontista)

Site institucional estático (HTML/CSS/JS puro, sem build step) para a
ortodontista Karina Salgado, baseado no briefing em vídeo da cliente.

## Estrutura

- `index.html` — Início (hero, três tipos de tratamento, quem sou eu, área
  de atuação, formação, fale conosco + mapa)
- `tratamentos.html` — Tratamento Infantil, Invisalign, Tratamento
  Ortopédico, e o bloco "Ortodontia além dos dentes" (apneia obstrutiva do
  sono, respiração bucal, hábitos de sucção)
- `parcerias.html` — Parceiros (Dra. Bianca, Dr. Rodrigo) e demais serviços
  (limpeza, restauração, periodontal, clareamento, canal, extração, cárie)
- `consultorio.html` — Galeria de fotos do consultório e mapa de como
  chegar
- `blog.html` — Grid de posts (capa, título, data)
- `assets/css/style.css` — estilos compartilhados (luxo minimalista, fundo
  branco, Cormorant Garamond + Inter)
- `assets/js/main.js` — menu mobile e formulário de contato

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

## Mapa / localização

O link do Google Maps enviado pela cliente
(`https://maps.app.goo.gl/aQv5k465MCF19TEn8`) já está aplicado como botão
"Ver localização no Google Maps" nas páginas Início e Consultório
(`.map-frame`). Esse link curto não pôde ser resolvido automaticamente
(bloqueado pelo proxy de rede do ambiente de desenvolvimento) para gerar
um mapa **incorporado** (iframe). Assim que o endereço completo em texto
(rua, número, bairro, cidade) for informado, dá pra trocar o botão por um
embed real.

## Pendências antes de publicar

Estes itens estão marcados no próprio HTML/CSS com placeholders e devem
ser substituídos por conteúdo real da cliente:

- 2 fotos que faltam na galeria do Consultório (`.img-placeholder` em
  `consultorio.html`) — só havia 5 fotos disponíveis no total.
- Fotos dos parceiros (Dra. Bianca, Dr. Rodrigo) e capas dos posts do
  blog.
- Endereço completo em texto do consultório, para gerar o mapa
  incorporado (embed) em vez do botão de link (ver seção acima).
- Integração real do formulário de contato (atualmente usa `mailto:` como
  fallback — ver `TODO` em `assets/js/main.js`) e os links de redes
  sociais (Facebook/WhatsApp/Instagram) no rodapé.
- Datas de formação (lista atualmente com `—` como placeholder de ano).
- Conteúdo real dos posts do blog (atualmente com título de exemplo e
  "Em breve" como data).
- Especialidades dos parceiros Dra. Bianca e Dr. Rodrigo.
