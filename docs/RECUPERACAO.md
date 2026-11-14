# Proveniência da reconstrução

Em 14/11/2026, foi recebido o arquivo `Norma_em_Cena_Recuperacao_Parcial(1).zip`.

O ZIP preservava as seguintes partes do código: `.openai/hosting.json`, `app/api/studio/route.ts`, `lib/files.ts`, `lib/model.ts` e `package.json`. Sua documentação informa que a página inicial, o motor de desenho, a exportação de vídeo, o estúdio visual e arquivos auxiliares não foram recuperados.

### O que foi preservado semanticamente

A aula autoral introdutória em cinco cenas foi migrada para `js/data.js`, preservando títulos, textos, pontos, narrações, durações, tipos de cena e comparações.

A estrutura básica de projetos/aulas/cenas e a funcionalidade de exportar projetos JSON foram adaptadas. As rotas originais `app/api/studio/route.ts` dependem de Cloudflare Workers, D1 e autenticação ausentes no GitHub Pages; por isso o arquivo original permanece no ZIP recuperado, fora do pacote público, e **não foi reutilizado como funcionalidade simulada**.

### O que foi construído agora

O layout e os componentes visuais são novos. Um personagem SVG estilizado foi implementado com animações CSS de articulações. Um reprodutor temporizado, editor de conteúdo, biblioteca de cenas e armazenamento local foram construídos. Essas funcionalidades são uma reconstrução, não cópias byte a byte da interface original.

### Conteúdo normativo

Nenhuma norma foi consultada durante esta reconstrução. O conteúdo introdutório ensina método de estudo, não requisitos da NFPA/ABNT. A expressão “revisado” é um estado editorial manual, não uma garantia de conformidade técnica.
