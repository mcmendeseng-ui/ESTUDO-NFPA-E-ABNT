# Norma em Cena — recuperação reconstruída para GitHub Pages

**Situação:** reconstrução nova a partir de um pacote de recuperação parcial de 14/11/2026. Não é a interface original que se perdeu. Não contém normas consultadas nem treinamentos técnicos verificados.

## O que funciona nesta versão

- Site responsivo para desktop e celular, com biblioteca e estúdio de criação.
- Aula **“Duas referências. Uma leitura mais clara.”** preservada no conteúdo (5 cenas, roteiros, durações e textos recuperados de `lib/model.ts`).
- Pré-visualização animada com personagem SVG ilustrado, partes articuladas, modos de movimento (`explain`, `point`, `walk`, `inspect`, `wave`, `idle`), cenas comparativas e diagramas.
- Linha do tempo da aula: reproduzir, pausar, avançar/voltar, arrastar a posição.
- Editor de cenas, movimentos, duração, textos, comparativo e referência; adicionar, duplicar, excluir e reorganizar cenas; criar novas aulas.
- Voz em português pelo mecanismo de síntese do navegador, conforme disponibilidade local de vozes. A voz Francisca não é garantida.
- Salvamento automático em **localStorage deste navegador**. **Exporte o JSON** para manter um backup: a publicação no GitHub não salva suas edições automaticamente.
- Importação de projetos JSON.
- Área de fontes com links oficiais NFPA e ABNT.

## O que NÃO funciona ou não foi feito

- Não há áudio profissional anexado nem vídeo MP4/WebM exportável.
- Não há sincronização da narração com gestos no nível de fonemas, apenas simultaneidade aproximada com a reprodução.
- Não existe autenticação ou banco de dados de usuários: a rota Cloudflare recuperada **não é compatível** com hospedagem estática no GitHub Pages.
- Não houve leitura de normas NFPA/ABNT neste processo. Toda aula técnica precisa ser verificada na fonte primária antes de ser tratada como material validado.
- Este conteúdo não replica visualmente o site original perdido. O design é uma reconstrução autoral com o mesmo objetivo.

## Como publicar no GitHub Pages

1. Crie um **repositório novo** chamado `norma-em-cena` em sua conta GitHub ou utilize um repositório vazio que você autorize.
2. Envie **todo o conteúdo desta pasta**, preservando `index.html`, `styles.css`, `js/`, `assets/` e `.nojekyll` na raiz. Não envie somente o `index.html`.
3. Abra **Settings > Pages** → Build and deployment → **Deploy from a branch** → `main` → `/ (root)` → Save.
4. O endereço será `https://SEU-USUARIO.github.io/norma-em-cena/` depois que o GitHub concluir a implantação. Use o link mostrado nas configurações, que é a referência autoritativa.
5. Abra no celular. Para preservar edições, use **Exportar projeto (.json)** e guarde o arquivo; **Importar** permite continuar em outro dispositivo.

O navegador precisa de rede para carregar a fonte Google; se estiver offline, exibirá a fonte de sistema substituta. Todo o código do site e os desenhos SVG funcionam sem bibliotecas hospedadas externamente.

## Organização

- `index.html`: interface principal.
- `styles.css`: identidade visual e responsividade.
- `js/data.js`: modelo e aula original de cinco cenas transcrita da recuperação.
- `js/storage.js`: persistência local e importação/exportação JSON.
- `js/motion.js`: personagem SVG com articulações e visuais de cena.
- `js/app.js`: editor, biblioteca, reprodução, narração e navegação.
- Os cinco arquivos originais recuperados permanecem no ZIP de origem fornecido pela usuária; **não foram incluídos no pacote público do site**, para evitar expor metadados e código de backend não utilizado.
- `docs/RECUPERACAO.md`: descrição dos limites do pacote.

### Segurança das fontes

O site nunca deve incluir PDFs completos das normas, sessões autenticadas NFPA/ABNT ou conteúdo de acesso restrito. Guarde documentos oficiais nas respectivas plataformas e informe apenas referência, edição, seção e explicação autoral. Nenhuma conclusão normativa pode ser gerada apenas por uma referência genérica.
