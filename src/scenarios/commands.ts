import { CommandError, type Store } from '../core';
import { getScenario } from './catalog';

export function registerScenarioCommands(store: Store): void {
  const session = (st: import('../core').State) => { if (!st.session) throw new CommandError('no_session', 'Aucun TP en cours'); return st.session; };
  store.registerCommand('scenario.begin', (ctx, p) => {
    ctx.state.session = { scenarioId: String(p['id']), mode: p['mode'] === 'exam' ? 'exam' : 'tp', startedAt: ctx.now, logStart: Number(p['logStart'] ?? 0), hints: {}, solutionViewed: false, stage: 0, answers: {}, wrong: 0 };
    ctx.emit('ScenarioStarted', { kind: 'scenario', id: String(p['id']) }, { mode: ctx.state.session.mode });
  });
  store.registerCommand('scenario.hint', (ctx, p) => {
    const s = session(ctx.state); if (s.mode === 'exam') throw new CommandError('exam_mode', 'Pas d\'indices en mode examen');
    if (s.finishedAt !== undefined) throw new CommandError('finished', 'Le TP est terminé');
    const sc = getScenario(s.scenarioId); const obj = String(p['objective']);
    const levels = sc?.hints.find(h => h.for === obj)?.levels.length ?? 0; const used = s.hints[obj] ?? 0;
    if (used >= levels) throw new CommandError('no_more_hints', 'Plus d\'indice pour cet objectif');
    s.hints[obj] = used + 1; ctx.emit('HintUsed', { kind: 'scenario', id: s.scenarioId }, { objective: obj, level: used + 1 });
  });
  store.registerCommand('scenario.answer', (ctx, p) => {
    const s = session(ctx.state); if (s.finishedAt !== undefined) throw new CommandError('finished', 'Le TP est terminé');
    const obj = getScenario(s.scenarioId)?.objectives.find(o => o.id === String(p['objective'])); const q = obj?.question;
    if (!q) throw new CommandError('no_question', 'Question inconnue');
    const choice = Number(p['choice']); if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) throw new CommandError('bad_choice', 'Choix invalide');
    if (s.answers[obj!.id]?.correct) throw new CommandError('already', 'Question déjà réussie');
    const correct = choice === q.correct; s.answers[obj!.id] = { choice, correct }; if (!correct) s.wrong += 1;
    ctx.emit('QuestionAnswered', { kind: 'scenario', id: s.scenarioId }, { objective: obj!.id, correct });
  });
  store.registerCommand('scenario.advance', ctx => {
    const s = session(ctx.state); const sc = getScenario(s.scenarioId); if (!sc) throw new CommandError('no_scenario', 'Scénario inconnu');
    if (s.stage >= sc.stages.length - 1) throw new CommandError('last_stage', 'Dernière étape');
    s.stage += 1; ctx.emit('StageStarted', { kind: 'scenario', id: s.scenarioId }, { stage: s.stage });
  });
  store.registerCommand('scenario.revealSolution', ctx => {
    const s = session(ctx.state); if (s.mode === 'exam') throw new CommandError('exam_mode', 'Pas de solution en mode examen');
    if (s.solutionViewed) throw new CommandError('already', 'Solution déjà affichée');
    s.solutionViewed = true; ctx.emit('SolutionRevealed', { kind: 'scenario', id: s.scenarioId });
  });
  store.registerCommand('scenario.finish', ctx => {
    const s = session(ctx.state); if (s.finishedAt !== undefined) throw new CommandError('finished', 'Déjà terminé');
    s.finishedAt = ctx.now; ctx.emit('ScenarioFinished', { kind: 'scenario', id: s.scenarioId });
  });
  store.registerCommand('scenario.quit', ctx => { const s = session(ctx.state); ctx.emit('ScenarioQuit', { kind: 'scenario', id: s.scenarioId }); ctx.state.session = null; });
}
