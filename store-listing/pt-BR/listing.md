# Profile Prism

## Descrição curta

Quão autêntico é este perfil do LinkedIn? Pontue evidências visíveis de autenticidade no dispositivo.

## Descrição completa

**Quão autêntico é este perfil?** O propósito do Profile Prism é pontuar as evidências visíveis de autenticidade de um perfil do LinkedIn em um índice explicável de 0 a 100 ao lado do nome.

A pontuação inicial automática resume o quanto as informações atualmente renderizadas na página parecem consistentes e estabelecidas. Passe o mouse ou use o foco do teclado no selo ao lado do nome ou no botão de pontuação no canto inferior esquerdo para ver uma explicação concisa. Pressione **Clique para verificar a autenticidade** quando quiser que a extensão role o perfil atual, carregue suas seções visíveis e inspecione os detalhes nativos “Sobre este membro” antes de publicar o resultado final do perfil visível.

Limitações importantes:

- É uma pontuação heurística determinística, não uma probabilidade.
- Não é verificação de identidade nem determina se uma pessoa é real, falsa, segura, confiável ou envolvida em fraude.
- Não detecta contas roubadas ou comprometidas.
- Não lê mensagens, vagas, dados de contato, outras abas, cookies nem APIs privadas do LinkedIn.
- A verificação completa só ocorre depois de sua ação, pode ser cancelada, permanece no perfil atual e não abre páginas recolhidas “Exibir tudo” nem links externos.
- Não use a pontuação como único fundamento para decisões de recrutamento, emprego, denúncia, bloqueio ou confiança.

Privacidade:

- As informações do perfil são processadas temporariamente no dispositivo.
- Nenhum conteúdo, URL, imagem, pontuação ou evidência do perfil é retido.
- O texto bruto da janela de verificação, nomes de organizações, URLs e identificadores de perfil são descartados; apenas evidências estruturadas permanecem na memória da rota atual.
- Nenhuma informação de perfil ou atividade de navegação é transmitida.
- Não há backend, telemetria, análise de uso, publicidade, modelo remoto ou consulta externa.

Interfaces compatíveis: inglês, português e espanhol.

## Justificativa das permissões

- `storage`: lembra a pausa da avaliação automática, preferências da interface e a versão das regras. Nunca armazena informações derivadas de perfis.
- `https://www.linkedin.com/*`: mantém a extensão disponível durante a navegação interna do LinkedIn. Ela ignora rotas que não sejam de perfil e lê informações renderizadas apenas em páginas `/in/{profile_id}/` compatíveis.
