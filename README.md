# Whiteline Fluence

Site pessoal do canal **@whitelinefluence** (TikTok e Instagram), dedicado ao meu Renault Fluence GT Line 2016.

> Projeto de uso pessoal. Não é um template nem aceita contribuições.

## Objetivo

Ter uma página única que funcione como "cartão de visita" do canal:

- **Apresentar o canal e o carro**: quem grava, que tipo de conteúdo sai (curiosidades, ficha técnica, dia a dia, tira-dúvidas e comparativos).
- **Mostrar números reais**: curtidas e seguidores do TikTok e seguidores do Instagram, atualizados automaticamente.
- **Centralizar os links de afiliado**: a lista "Tudo que uso no Fluence", com os produtos que aparecem nos vídeos (Mercado Livre).
- **Atrair parcerias**: seção comercial com formatos de publicidade e contato direto por e-mail.

## Seções da página

| # | Seção | Âncora | O que tem |
|---|-------|--------|-----------|
| — | Hero | `#topo` | Título animado, botões para TikTok/Instagram, foto principal e contadores ao vivo |
| — | Faixa + galeria | — | Marquee vermelho com os temas do canal e carrossel infinito de fotos |
| — | Alcance | `#alcance` | Destaque com o total de views (+1,5 mi, sendo 1,2 mi no TikTok) — números fixos, atualizar à mão. Abaixo, os cards de **metas** (próximo marco de seguidores no Instagram e no TikTok, com barra de progresso ao vivo) |
| 01 | Sobre o canal | `#sobre` | Apresentação do canal e do Luiz (idade, primeiro carro, estilo dos vídeos) |
| 02 | Ficha técnica | `#ficha` | Potência, torque, motor, câmbio CVT, porta-malas, rodas e dimensões |
| 03 | Em destaque | `#videos` | Cards dos vídeos mais vistos |
| 04 | Eventos | `#eventos` | Encontros, exposições e eventos automotivos (cards gerados do array `eventosData`) |
| 05 | Produtos | `#produtos` | 11 links de afiliado + link para o Linktree |
| 06 | Parcerias | `#parcerias` | Formatos (vídeo dedicado, inserção, stories, afiliação), vaga para a 1ª marca e contato |
| 07 | FAQ | `#faq` | Perguntas frequentes em acordeão |
| — | Rodapé | — | Links das redes e aviso de links de afiliado |

## Estrutura do projeto

```
whiteline_fluence/
└── site/                  ← raiz do deploy na Vercel
    ├── index.html         ← a página inteira (HTML + CSS + lógica do componente)
    ├── support.js         ← runtime "dc" gerado (carrega React/Babel da unpkg e renderiza o <x-dc>)
    ├── image-slot.js      ← ferramenta do editor de design (não vai para produção)
    ├── api/
    │   └── stats.js       ← função serverless GET /api/stats
    ├── assets/            ← fotos (hero, perfil, galeria g*, vídeos v*, eventos/)
    ├── vercel.json        ← headers de segurança e cache
    └── .vercelignore      ← exclui image-slot.js do deploy
```

## Como funciona

### Página (`index.html`)

A página é escrita no formato **x-dc**: o HTML fica dentro de `<x-dc>` com marcações de template (`{{ ... }}`, `<sc-if>`, `<sc-for>`), e a lógica fica num `<script type="text/x-dc">` com uma classe `Component extends DCLogic`. O `support.js` lê isso e monta como um componente React no navegador.

> ⚠️ `support.js` é **gerado** — não editar à mão.

A lógica do componente cuida de:

- **Animações**: letras do título entrando uma a uma, elementos com `data-reveal` aparecendo no scroll, contadores (`data-count`) e parallax (`data-parallax`, desligado em telas ≤ 900px).
- **Acessibilidade de movimento**: se o sistema pedir `prefers-reduced-motion` (ou a prop `animations` for `false`), as animações são desligadas.
- **FAQ**: acordeão controlado pelo estado `open`.
- **Metas**: cards montados a partir do array `metasData` (marcos de seguidores por rede). A próxima meta é o primeiro marco acima do número atual; passou de todos, ela vira o dobro do último. O progresso usa os seguidores do `/api/stats` e a barra enche quando o card aparece na tela.
- **Eventos**: cards montados a partir do array `eventosData`, ordenados do mais recente para o mais antigo; a data `AAAA-MM-DD` vira "14 set 2026".
- **E-mail**: montado em tempo de execução (`['usuario', 'dominio'].join('@')`) para não ficar em texto puro no HTML e fugir de robôs coletores. Botão "Copiar e-mail" usa a Clipboard API.

Props editáveis (em `data-props`): `animations` e `showMarquee`.

### Contadores ao vivo (`api/stats.js`)

Função serverless da Vercel em `GET /api/stats`:

1. Busca seguidores e curtidas do TikTok na API do [tokcounter.com](https://tiktok-api.tokcounter.com/user/data/whitelinefluence) (`stats.followers` e `stats.likes`). Da Vercel, a página do TikTok chega com números atrasados; a leitura direta do perfil (`followerCount`/`heartCount` do JSON `__UNIVERSAL_DATA_FOR_REHYDRATION__`) ficou como reserva.
2. Busca os seguidores do Instagram no JSON público do [instastatistics.com](https://instastatistics.com/api/user/whitelinefluence) (`followers`). O Instagram bloqueia os IPs da Vercel (redireciona para o login com `is_from_rle`, com qualquer User-Agent), então a leitura direta do perfil (`og:description`, ex.: `"742 Followers, ..."`) ficou só como reserva — funciona no `vercel dev` local.
3. Nas leituras diretas (reserva), usa User-Agent de iPhone, porque com UA de desktop o TikTok devolve desafio anti-bot.
4. Confere se cada número é plausível antes de usar: descarta valores que não sejam inteiros positivos e ignora mudanças bruscas (queda de mais de 20% ou salto de mais de 50% em relação ao último valor bom). Uma mudança brusca só é aceita se o mesmo valor (±5%) se repetir 3 vezes seguidas. Os descartes aparecem nos logs.
5. Guarda o resultado em memória por **2 minutos**; requisições simultâneas compartilham a mesma busca. Se uma rede falhar, mantém o último valor bom dela.
6. Responde com `Cache-Control: s-maxage=120, stale-while-revalidate=600`.

Resposta:

```json
{
  "tiktok":    { "followers": 4500, "likes": 92000 },
  "instagram": { "followers": 800 },
  "updatedAt": "2026-09-30T12:00:00.000Z"
}
```

No front, a página chama `/api/stats` ao carregar, a cada 60 s (só com a aba visível) e ao voltar para a aba. Os números já escritos no HTML servem de fallback se a API falhar.

### Segurança (`vercel.json`)

- **CSP** restrita: scripts só do próprio site e da `unpkg.com`, fontes do Google Fonts, `connect-src 'self'`, `frame-ancestors 'none'`.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (câmera, microfone, localização etc. bloqueados) e `COOP same-origin`.
- `/assets/*` com cache de 7 dias.

## Rodando localmente

Precisa do [Vercel CLI](https://vercel.com/docs/cli) para a função `/api/stats` funcionar:

```bash
npm i -g vercel
cd site
vercel dev
```

Abrir `http://localhost:3000`.

Sem a Vercel dá para abrir só o visual com qualquer servidor estático (ex.: `npx serve site`), mas os contadores ficam nos valores fixos do HTML.

> Abrir o `index.html` direto pelo `file://` não funciona bem, porque o runtime carrega scripts externos.

## Deploy

Hospedado na **Vercel** com a pasta `site/` como *Root Directory*. Não há etapa de build: é só fazer push (se o repositório estiver ligado à Vercel) ou rodar `vercel --prod` dentro de `site/`.

## Tarefas comuns

| Quero… | Onde mexer |
|--------|------------|
| Adicionar/remover produto | Seção `<!-- PRODUTOS -->` no `index.html` (copiar uma linha `<a class="wl-prod">` e renumerar) |
| Trocar fotos | Substituir o arquivo em `site/assets/` mantendo o nome, ou mudar o `src` |
| Atualizar total de views | Seção `<!-- ALCANCE -->`: `data-count` + texto de cada número e a `width` (%) das barras |
| Atualizar ficha técnica | Seção `<!-- FICHA TÉCNICA -->` (o número animado fica em `data-count`) |
| Adicionar/mudar metas de seguidores | Array `metasData` no script do final do `index.html` (lista `marcos` de cada rede). O fallback sem API fica em `state.seg` |
| Adicionar evento | Array `eventosData` no script do final do `index.html` (fotos em `site/assets/eventos/`; com mais de uma o card alterna estilo story) |
| Editar o FAQ | Array `faqData` no script do final do `index.html` |
| Trocar o e-mail comercial | Constante `EMAIL` no script do final do `index.html` |
| Mudar o @ das redes | `USER` em `api/stats.js` e os links no `index.html` |
| Ajustar layout mobile | Bloco `<style>` no topo (`@media` 900px, 640px e 380px) |

## Identidade visual

- **Cores**: fundo `#0b0b0c`, texto `#f4f3f1`, vermelho `#e3262c` (hover `#ff3b3f`, escuro `#c81e24`).
- **Fontes**: *Archivo* (com largura variável, usada em `font-stretch` 112–125%) e *JetBrains Mono* para rótulos.

## Observações

- Os contadores dependem de serviços de terceiros com endpoints não oficiais (tokcounter.com para o TikTok e instastatistics.com para o Instagram). Se um deles sair do ar, a API tenta a leitura direta do perfil e, se ela também falhar, o site mostra os números fixos do HTML. Para o Instagram, a alternativa definitiva é a API oficial (conta profissional + token da Meta).
- A leitura direta (reserva) é feita por *scraping* das páginas públicas; se as redes mudarem o HTML, a API para de achar os números (o site continua de pé com os valores fixos). Os erros aparecem nos logs da função na Vercel.
- O site contém links de afiliado, e isso está avisado no rodapé e no FAQ.
