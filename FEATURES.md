# FEATURES

* [x] Definir a jornada desejada (tempo de trabalho);

* [x] Selecionar o que deseja deixar visível;

* [x] Mostrar ou ocultar campo do almoço;

* [x] Modo pomodoro conseguir definir o tempo de foco e de descanso;

* [x] Pomodoro, emitir um alerta ou alguma maneira de mostrar que acabou o tempo de foco e é para descanso;

* [x] Essas criar uma tela de configuração;
  * [x] Ver melhor tratativa, se modal ou uma aba ao lado do restante;
=========

## Definições acordadas (plano de ação)

### V1 (escopo atual)

* Entregar núcleo de configurações:
  * Jornada desejada (tempo de trabalho);
  * Campos visíveis na tela principal;
  * Exibir/ocultar campo de almoço.
* UX da configuração: painel lateral (aba ao lado), não modal.
* Critério de pronto: interface funcional ponta a ponta.
* Persistência: fora da V1 (por enquanto sem salvar localmente).

### Fluxo esperado (V1)

* Abrir painel de configurações pelo botão de configuração;
* Ajustar jornada, campos visíveis e almoço;
* Aplicar mudanças e refletir na UI principal;
* Reiniciar app volta para estado padrão (sem persistência na V1).

### Validações e qualidade (V1)

* Jornada aceita apenas valor válido;
* Valor inválido mostra feedback e bloqueia aplicação;
* Toggles de visibilidade/almoço mantêm estado consistente.

### Backlog (desenvolvimento futuro)

* Adicionar persistência local das configurações;
* Restaurar configurações ao abrir app;
* Implementar modo Pomodoro:
  * Definir tempo de foco;
  * Definir tempo de descanso.

### Ideias extras (sugeridas)

* [ ] Persistir contagem de ciclos Pomodoro do dia e resetar automaticamente na virada de data;
* [ ] Histórico de sessões (foco/descanso) com total por dia;
* [ ] Atalhos de teclado globais: iniciar/pausar e pular fase;
* [ ] Opção de som personalizado por fase (fim de foco e fim de descanso);
* [ ] Intervalo longo opcional após N ciclos completos (ex.: 15 min a cada 4 ciclos).
