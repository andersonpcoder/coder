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

## Pendências antes de publicar

Estes itens estão marcados no próprio HTML/CSS com placeholders e devem
ser substituídos por conteúdo real da cliente:

- Todas as fotos (`.img-placeholder`) — foto de hero, foto circular "quem
  sou eu", foto de formação, fotos dos parceiros, galeria do consultório,
  capas dos posts do blog.
- Endereço real do consultório e embed do Google Maps (`.map-frame`) nas
  páginas Início e Consultório.
- Integração real do formulário de contato (atualmente usa `mailto:` como
  fallback — ver `TODO` em `assets/js/main.js`) e os links de redes
  sociais (Facebook/WhatsApp/Instagram) no rodapé.
- Datas de formação (lista atualmente com `—` como placeholder de ano).
- Conteúdo real dos posts do blog (atualmente com título de exemplo e
  "Em breve" como data).
- Especialidades dos parceiros Dra. Bianca e Dr. Rodrigo.
