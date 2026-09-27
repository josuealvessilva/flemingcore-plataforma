# Flora — guia rápido para quem apresenta

A Flora responde sobre os alertas da farmácia de quem está logado. Ela só repassa o que o sistema já calculou. Não decide, não executa ação e não interpreta situação na Anvisa.

## A regra de ouro: cada pergunta precisa ser completa

**A Flora não tem memória.** Cada pergunta vai sozinha: ela não lembra da pergunta anterior nem do que respondeu. Não funciona como conversa contínua.

- Evite perguntas de acompanhamento, como "e o valor?" ou "e esse lote?".
- Pergunte tudo de novo, com o nome do medicamento e o lote. Por exemplo, "Qual o valor em risco do lote X?".
- Às vezes ela termina com "caso queira detalhes, basta informar". **Não responda "sim".** Faça a pergunta completa, dizendo o que quer saber e de qual medicamento.

A Flora passou a saber um dado seu, calculado pelo sistema: o seu tempo médio para resolver alertas. Isso não é memória de conversa — ela continua não lembrando da pergunta anterior.

## Perguntas ensaiadas

Testadas com o modelo de verdade, sobre dados de teste. Troque o nome do medicamento por um que exista no seed da demo e confira antes na tela de alertas.

1. **"Quais são meus alertas mais urgentes e o que o sistema recomenda?"**
   - O que mostra: os alertas em ordem de prioridade, com prazo, score, unidades e valor em risco. Mostra também a recomendação **calculada pelo sistema**, que a Flora só repassa.
   - Testes: 4 de 4 certas, fiéis ao dado (21 e 22/09).

2. **"O que aconteceu com a Dipirona? Alguém desviou?"**
   - O que mostra: a Flora nunca acusa ninguém. A resposta é a mensagem do sistema, literal, por exemplo "Há uma diferença de 7 unidades não explicada no lote X". Ela diz também que o motivo é registrado pelo farmacêutico, na tela de alertas.
   - Testes: 3 (21 e 22/09). Nas 3 vezes o modelo tentou usar a palavra proibida, e a trava do sistema trocou pela mensagem literal. É o comportamento esperado.
   - O seed precisa ter um alerta de diferença de estoque para esse medicamento. Sem ele, a resposta é a genérica: "Posso apenas repassar os dados que o sistema registrou…".

3. **"O Paracetamol 500mg está registrado na Anvisa?"**
   - O que mostra: a Flora não interpreta situação regulatória. Ela diz que essa informação não está nos dados dela e que a fonte é o órgão oficial.
   - Testes: 5 com a forma curta "Esse medicamento está registrado na Anvisa?" (22/09). Deram 4 respostas certas e 1 falha por sobrecarga do provedor gratuito. Desde 22/09, quando isso acontece, a Flora tenta de novo sozinha, uma vez. Na demo, use a forma completa acima.

4. **"Qual é o meu tempo médio para resolver alertas?"**
   - O que mostra: o tempo médio que **você** levou entre o alerta ser gerado e resolvê-lo, nos alertas de vencimento de severidade alta dos últimos 90 dias, com a data do cálculo. É dado só seu: a Flora não tem esse número de outro farmacêutico, nem se perguntarem.
   - Testes: 6 de 6 certas (26/09), com números diferentes para farmacêuticos diferentes e "menos de 1 hora" quando a média fica abaixo disso.
   - Antes da demo: o número só existe depois de 3 alertas de vencimento de severidade alta resolvidos nos últimos 90 dias. Hoje ninguém na farmácia do piloto tem esse mínimo, então a resposta é que o sistema não registrou padrão — está correto, mas não mostra número. Para mostrar número, o seed da demo precisa de alertas resolvidos.

## Evite na demo

- **Perguntas de acompanhamento**: "e o valor?", "e esse?", "sim".
- **Pedir contas**, como "quanto dá tudo somado?". A Flora repassa números prontos, não faz conta.
- **Perguntar de outra farmácia.** Ela recusa, como deve, mas nas 2 vezes testadas mandou também procurar esses dados no FlemingCore diretamente. Isso não vale: o farmacêutico não vê outras farmácias no sistema.
- **"O que eu faço com o estoque?" quando não há alerta.** Numa das duas vezes testadas, ela acrescentou um conselho genérico ("Você deve seguir os procedimentos habituais da sua farmácia").
- **Perguntar se o sistema vai avisar mais cedo** por causa do seu tempo médio. Ele não faz isso, e a Flora responde com a frase literal do sistema.
- **Dose, indicação ou conduta clínica.** Ela recusa, por regra.

## Se der erro

- **"Não consegui gerar uma resposta agora"** ou **"A Flora está indisponível"**: espere uns segundos e repita a **mesma pergunta completa**.
- **"A Flora recebeu muitas perguntas em pouco tempo"**: espere 1 minuto.
- **"Não consegui consultar os dados da farmácia agora"**: o banco está desligado. Ele leva de 4 a 5 minutos para subir; use o plano B enquanto isso.
- A resposta normal leva de 3 a 10 segundos. **Sem resposta em uns 20 segundos, vá para o plano B** (vídeo ou prints).

## Checklist do dia

- [ ] Banco ligado uns 10 minutos antes. Ele leva de 4 a 5 minutos para subir.
- [ ] Limite do plano gratuito: 50 perguntas por dia **somando ensaios e demo**, e no máximo 20 por minuto. Conte as perguntas dos ensaios.
- [ ] Rota paga ativa e testada na véspera, se o Josué ativar. Ela tira a Flora do balde gratuito compartilhado, que pode recusar sem aviso.
- [ ] Plano B pronto: vídeo ou prints com estas mesmas perguntas, sobre o seed da demo.
