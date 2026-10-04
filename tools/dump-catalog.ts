import { SCENARIOS } from '../src/scenarios';
console.log(JSON.stringify(SCENARIOS.map(s => ({ n: s.number, title: s.title, level: s.level, levelLabel: s.levelLabel, difficulty: s.difficulty, duration: s.duration, context: s.context, skills: s.skills, stages: s.stages.map(g => g.title), objectives: s.objectives.length, questions: s.objectives.filter(o => o.question).length }))));
