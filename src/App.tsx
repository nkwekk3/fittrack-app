import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SetLog, type WorkoutLog } from './db';
import { 
  Dumbbell, Calendar, Flame, History, Lightbulb, 
  Plus, Check, Timer, Download, Shuffle, BatteryCharging, 
  AlertTriangle, CheckCircle2, BarChart2, HelpCircle, ChevronRight, ChevronLeft, X
} from 'lucide-react';


const CATEGORIES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];

// Exercise Substitution Database
const EXERCISE_SUBSTITUTES: { [key: string]: string[] } = {
  'leg press': ['Bulgarian Split Squats', 'Barbell Front Squats', 'Goblet Squats', 'Walking Lunges'],
  'bench press': ['Dumbbell Press', 'Weighted Push-ups', 'Dip Station'],
  'lat pulldown': ['Pull-ups', 'Chin-ups', 'Inverted Rows'],
  'hamstring curl': ['Romanian Deadlifts', 'Nordic Curls', 'Swiss Ball Leg Curls'],
  'cable flyes': ['Dumbbell Flyes', 'Resistance Band Flyes', 'Deficit Push-ups']
};

// Tutorial Slides Data
const TUTORIAL_STEPS = [
  {
    title: "Welcome to FitTrack Offline! 🏋️",
    desc: "A fast, offline-first workout logger built for progressive overload, set volume tracking, and recovery monitoring."
  },
  {
    title: "1. Log & Substitute Exercises",
    desc: "Track sets, target reps, and weights. Missing a machine like the Leg Press? Tap 'Substitute' to get instant bodyweight or free-weight alternatives."
  },
  {
    title: "2. Post-Rest Day Recovery Check",
    desc: "After rest days, complete a quick 30-second assessment. If you score low on readiness, the app automatically reschedules today's workouts on your calendar!"
  },
  {
    title: "3. Auto Deload & Set Volume",
    desc: "View your weekly set count per muscle group in the Log tab. If you miss reps 3 sessions in a row, the Recs tab will trigger a Deload recommendation to prevent burnout."
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'log' | 'plan' | 'history' | 'recs' | 'recovery' | 'guide'>('log');

  // IndexedDB Live Queries
  const logs = useLiveQuery(() => db.logs.orderBy('date').reverse().toArray()) || [];
  const plans = useLiveQuery(() => db.plans.toArray()) || [];
  const streakInfo = useLiveQuery(() => db.streak.get('user_streak'));

  // Onboarding / Tutorial State
  const [showModal, setShowModal] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Form States
  const [exerciseName, setExerciseName] = useState('');
  const [category, setCategory] = useState('Push');
  const [targetSets, setTargetSets] = useState(3);
  const [targetReps, setTargetReps] = useState(8);
  const [targetWeight, setTargetWeight] = useState(20);
  const [notes, setNotes] = useState('');
  const [setsInput, setSetsInput] = useState<{ repsCompleted: number }[]>([]);
  const [isLogging, setIsLogging] = useState(false);

  // Plan Form State
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);

  // Rest Timer State
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  // Recovery Questionnaire States
  const [soreness, setSoreness] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [passedJumpTest, setPassedJumpTest] = useState(true);
  const [recoveryResult, setRecoveryResult] = useState<{ score: number; recommendation: string } | null>(null);

  // Check for First-Time User
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('fittrack_tutorial_completed');
    if (!hasSeenTutorial) {
      setShowModal(true);
    }
  }, []);

  const closeTutorial = () => {
    localStorage.setItem('fittrack_tutorial_completed', 'true');
    setShowModal(false);
  };

  // Timer Countdown Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerActive && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => (prev !== null && prev > 1 ? prev - 1 : 0));
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
      alert('⏰ Rest Time Over! Ready for the next set.');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timerSeconds]);

  const startRestTimer = (seconds: number) => {
    setTimerSeconds(seconds);
    setTimerActive(true);
  };

  const calculate1RM = (weight: number, reps: number) => {
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
  };

  const startLogging = () => {
    if (!exerciseName.trim()) return;
    setSetsInput(Array.from({ length: targetSets }, () => ({ repsCompleted: targetReps })));
    setIsLogging(true);
  };

  // Substitute Machine/Exercise Helper
  const substituteExercise = () => {
    const key = exerciseName.toLowerCase().trim();
    if (EXERCISE_SUBSTITUTES[key]) {
      const alternatives = EXERCISE_SUBSTITUTES[key];
      const randomSub = alternatives[Math.floor(Math.random() * alternatives.length)];
      setExerciseName(randomSub);
    } else {
      alert(`No direct substitutes pre-listed for "${exerciseName}". You can manually adjust the exercise name.`);
    }
  };

  // Save Completed Workout
  const saveWorkout = async () => {
  const today = new Date().toISOString().split('T')[0];

  const setsData: SetLog[] = setsInput.map((s, idx) => ({
    setNumber: idx + 1,
    targetReps,
    repsCompleted: s.repsCompleted,
    weight: targetWeight,
    passed: s.repsCompleted >= targetReps,
    estimatedOneRepMax: calculate1RM(targetWeight, s.repsCompleted),
    setType: 'Normal', // Matches the SetType union type in db.ts
  }));

    await db.logs.add({
      date: today,
      exerciseName,
      category,
      notes,
      sets: setsData
    });

    // Update Streak
    const currentStreak = streakInfo?.currentStreak || 0;
    const lastDate = streakInfo?.lastWorkoutDate || '';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = currentStreak;
    if (lastDate !== today) {
      newStreak = lastDate === yesterdayStr ? currentStreak + 1 : 1;
      await db.streak.put({ id: 'user_streak', currentStreak: newStreak, lastWorkoutDate: today });
    }

    setIsLogging(false);
    setExerciseName('');
    setNotes('');
    setTimerActive(false);
    setTimerSeconds(null);
    setActiveTab('history');
  };

  // Save Planned Workout
  const savePlan = async () => {
    if (!exerciseName.trim()) return;
    await db.plans.add({
      date: planDate,
      exerciseName,
      category,
      targetSets,
      targetReps,
      targetWeight
    });
    setExerciseName('');
    alert('Workout Planned!');
  };

  // Calculate Recovery Assessment Score
  const runRecoveryCheck = async () => {
    const sorenessScore = (10 - soreness) * 5;
    const sleepScore = sleep * 3;
    const testScore = passedJumpTest ? 20 : 0;

    const totalScore = sorenessScore + sleepScore + testScore;
    const needsMoreRest = totalScore < 60 || soreness >= 8;
    const recommendation = needsMoreRest ? 'Rest More' : 'Train';
    const today = new Date().toISOString().split('T')[0];

    await db.recovery.add({
      date: today,
      sorenessLevel: soreness,
      sleepQuality: sleep,
      passedTest: passedJumpTest,
      readinessScore: totalScore,
      recommendation
    });

    if (needsMoreRest) {
      const todayPlans = await db.plans.where('date').equals(today).toArray();
      for (const p of todayPlans) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        await db.plans.update(p.id!, { date: tomorrowStr });
      }
    }

    setRecoveryResult({ score: totalScore, recommendation });
  };

  // Calculate Weekly Muscle Volume
  const getWeeklyVolume = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startStr = startOfWeek.toISOString().split('T')[0];

    const weeklyLogs = logs.filter(l => l.date >= startStr);
    const categoryVolume: { [key: string]: number } = { Push: 0, Pull: 0, Legs: 0, Upper: 0, Lower: 0 };

    weeklyLogs.forEach(l => {
      if (categoryVolume[l.category] !== undefined) {
        categoryVolume[l.category] += l.sets.length;
      }
    });

    return categoryVolume;
  };

  // Deload Logic Analysis
  const getRecommendationAndDeload = (name: string) => {
    const history = logs.filter(l => l.exerciseName.toLowerCase() === name.toLowerCase());
    if (history.length === 0) return 'No history yet. Start with a baseline weight.';

    const recentSessions = history.slice(0, 3);
    const failedSessionsCount = recentSessions.filter(s => s.sets.some(set => !set.passed)).length;

    if (recentSessions.length >= 3 && failedSessionsCount === 3) {
      const deloadWeight = Math.round(recentSessions[0].sets[0].weight * 0.6);
      return `⚠️ DELOAD RECOMMENDED: You have missed target reps 3 sessions in a row on ${name}. Reduce weight to ${deloadWeight}kg (-40%) for 1 week to allow CNS & joint recovery.`;
    }

    const lastSession = history[0];
    const allPassed = lastSession.sets.every(s => s.passed);

    if (allPassed) {
      return ` Great job! All sets completed last session. Try adding 2.5kg - 5kg today.`;
    } else {
      return ` Keep current weight (${lastSession.sets[0].weight}kg). Focus on hitting full target reps before increasing weight.`;
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (logs.length === 0) return alert('No logs to export.');
    let csv = 'Date,Category,Exercise,Notes,Set,Target Reps,Reps Done,Weight,Passed,Est 1RM\n';
    logs.forEach(l => {
      l.sets.forEach(s => {
        csv += `"${l.date}","${l.category}","${l.exerciseName}","${l.notes || ''}",${s.setNumber},${s.targetReps},${s.repsCompleted},${s.weight},${s.passed},${s.estimatedOneRepMax}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workouts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const weeklyVolume = getWeeklyVolume();

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>FitTrack Offline</h1>
        <div style={styles.streakBadge}>
          <Flame color="#f97316" size={18} />
          <span style={{ fontWeight: 'bold', marginLeft: '4px' }}>{streakInfo?.currentStreak || 0} Day Streak</span>
        </div>
      </header>

      {/* FIRST-TIME USER TUTORIAL MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <button style={styles.closeModalBtn} onClick={closeTutorial}><X size={18} /></button>
            <h3 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>{TUTORIAL_STEPS[tutorialStep].title}</h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', minHeight: '60px' }}>
              {TUTORIAL_STEPS[tutorialStep].desc}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {tutorialStep > 0 && (
                  <button style={styles.stepBtn} onClick={() => setTutorialStep(p => p - 1)}><ChevronLeft size={16} /></button>
                )}
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                  <button style={styles.stepBtnPrimary} onClick={() => setTutorialStep(p => p + 1)}>Next <ChevronRight size={16} /></button>
                ) : (
                  <button style={styles.stepBtnPrimary} onClick={closeTutorial}>Got it!</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rest Timer Widget */}
      {timerSeconds !== null && (
        <div style={styles.timerWidget}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Timer size={18} color="#38bdf8" />
            <span style={{ fontWeight: 'bold' }}>Rest Timer: {timerSeconds}s</span>
          </div>
          <button style={styles.smallStopBtn} onClick={() => setTimerSeconds(null)}>Dismiss</button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.content}>
        {/* LOG TAB */}
        {activeTab === 'log' && (
          <div>
            <h2 style={styles.tabHeading}>Log Workout</h2>
            {!isLogging ? (
              <div style={styles.card}>
                <label style={styles.label}>Category / Split</label>
                <select style={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={styles.label}>Exercise Name</label>
                  <button type="button" style={styles.subBtn} onClick={substituteExercise}>
                    <Shuffle size={12} style={{ marginRight: '4px' }} /> Substitute
                  </button>
                </div>
                <input style={styles.input} value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="e.g., Leg Press or Bench Press" />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Target Sets</label>
                    <input style={styles.input} type="number" value={targetSets} onChange={e => setTargetSets(Number(e.target.value))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Target Reps</label>
                    <input style={styles.input} type="number" value={targetReps} onChange={e => setTargetReps(Number(e.target.value))} />
                  </div>
                </div>

                <label style={styles.label}>Weight (kg)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <button type="button" style={styles.weightBtn} onClick={() => setTargetWeight(p => Math.max(0, p - 5))}>-5</button>
                  <button type="button" style={styles.weightBtn} onClick={() => setTargetWeight(p => Math.max(0, p - 2.5))}>-2.5</button>
                  <input style={{ ...styles.input, marginBottom: 0, textAlign: 'center', fontWeight: 'bold' }} type="number" value={targetWeight} onChange={e => setTargetWeight(Number(e.target.value))} />
                  <button type="button" style={styles.weightBtn} onClick={() => setTargetWeight(p => p + 2.5)}>+2.5</button>
                  <button type="button" style={styles.weightBtn} onClick={() => setTargetWeight(p => p + 5)}>+5</button>
                </div>

                <label style={styles.label}>Notes (Optional)</label>
                <input style={styles.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Form cues, seat notch, etc." />

                <button style={styles.primaryBtn} onClick={startLogging}>Start Session</button>
              </div>
            ) : (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{exerciseName}</h3>
                  <span style={styles.tagBadge}>{category}</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: '6px 0 12px 0' }}>
                  Target: {targetSets} sets × {targetReps} reps @ {targetWeight}kg
                </p>

                {setsInput.map((set, idx) => {
                  const passed = set.repsCompleted >= targetReps;
                  const est1RM = calculate1RM(targetWeight, set.repsCompleted);
                  return (
                    <div 
                      key={idx} 
                      style={{
                        ...styles.setRow,
                        borderColor: passed ? '#22c55e' : '#ef4444',
                        backgroundColor: passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                      }}
                    >
                      <div>
                        <strong>Set {idx + 1}</strong>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Est 1RM: {est1RM}kg</div>
                      </div>
                      <div>
                        <span style={{ marginRight: '8px', fontSize: '14px' }}>Reps:</span>
                        <input 
                          type="number" 
                          style={styles.setContainerInput}
                          value={set.repsCompleted} 
                          onChange={e => {
                            const updated = [...setsInput];
                            updated[idx].repsCompleted = Number(e.target.value);
                            setSetsInput(updated);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div style={{ margin: '16px 0' }}>
                  <label style={styles.label}>Rest Timer</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" style={styles.timerBtn} onClick={() => startRestTimer(30)}>30s</button>
                    <button type="button" style={styles.timerBtn} onClick={() => startRestTimer(60)}>60s</button>
                    <button type="button" style={styles.timerBtn} onClick={() => startRestTimer(90)}>90s</button>
                    <button type="button" style={styles.timerBtn} onClick={() => startRestTimer(120)}>120s</button>
                  </div>
                </div>

                <button style={{ ...styles.primaryBtn, backgroundColor: '#22c55e' }} onClick={saveWorkout}>
                  <Check size={18} style={{ marginRight: '6px' }} /> Finish Exercise
                </button>
              </div>
            )}

            {/* Weekly Volume Tracker */}
            <div style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <BarChart2 size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '15px' }}>Weekly Muscle Volume (Completed Sets)</h3>
              </div>
              {Object.entries(weeklyVolume).map(([cat, count]) => (
                <div key={cat} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                    <span>{cat}</span>
                    <span>{count} / 12-20 sets</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#0f172a', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (count / 15) * 100)}%`, backgroundColor: '#3b82f6', height: '100%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === 'plan' && (
          <div>
            <h2 style={styles.tabHeading}>Plan Workouts</h2>
            <div style={styles.card}>
              <label style={styles.label}>Date</label>
              <input style={styles.input} type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} />

              <label style={styles.label}>Category</label>
              <select style={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <label style={styles.label}>Exercise</label>
              <input style={styles.input} value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="e.g., Squats" />

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Sets</label>
                  <input style={styles.input} type="number" value={targetSets} onChange={e => setTargetSets(Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Reps</label>
                  <input style={styles.input} type="number" value={targetReps} onChange={e => setTargetReps(Number(e.target.value))} />
                </div>
              </div>

              <label style={styles.label}>Weight (kg)</label>
              <input style={styles.input} type="number" value={targetWeight} onChange={e => setTargetWeight(Number(e.target.value))} />

              <button style={styles.primaryBtn} onClick={savePlan}><Plus size={18} /> Schedule Exercise</button>
            </div>

            <h3>Upcoming Scheduled</h3>
            {plans.map(p => (
              <div key={p.id} style={styles.historyCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{p.exerciseName}</strong>
                  <span style={styles.tagBadge}>{p.category}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                  📅 {p.date} — {p.targetSets}x{p.targetReps} @ {p.targetWeight}kg
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RECOVERY CHECK TAB */}
        {activeTab === 'recovery' && (
          <div>
            <h2 style={styles.tabHeading}>Post-Rest Day Recovery Check</h2>
            {!recoveryResult ? (
              <div style={styles.card}>
                <label style={styles.label}>Muscle Soreness Level: {soreness}/10</label>
                <input type="range" min="1" max="10" value={soreness} onChange={e => setSoreness(Number(e.target.value))} style={{ width: '100%', marginBottom: '12px' }} />

                <label style={styles.label}>Sleep Quality: {sleep}/10</label>
                <input type="range" min="1" max="10" value={sleep} onChange={e => setSleep(Number(e.target.value))} style={{ width: '100%', marginBottom: '16px' }} />

                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                  <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Equipment-Free Test: Jump Reach Power</strong>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 8px 0' }}>
                    Jump as high as you can against a wall. Does your jump reach feel explosive and normal?
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <input type="checkbox" checked={passedJumpTest} onChange={e => setPassedJumpTest(e.target.checked)} />
                    Normal Explosive Power
                  </label>
                </div>

                <button style={styles.primaryBtn} onClick={runRecoveryCheck}>Calculate Readiness</button>
              </div>
            ) : (
              <div style={{ ...styles.card, textAlign: 'center' }}>
                {recoveryResult.recommendation === 'Rest More' ? (
                  <div>
                    <AlertTriangle color="#ef4444" size={48} style={{ margin: '0 auto 8px auto' }} />
                    <h3 style={{ color: '#ef4444' }}>Extra Rest Needed</h3>
                    <p style={{ fontSize: '13px', color: '#cbd5e1' }}>
                      Readiness Score: <strong>{recoveryResult.score}%</strong>. High fatigue detected. Planned workouts today were shifted forward 1 day on your calendar.
                    </p>
                  </div>
                ) : (
                  <div>
                    <CheckCircle2 color="#22c55e" size={48} style={{ margin: '0 auto 8px auto' }} />
                    <h3 style={{ color: '#22c55e' }}>Ready to Train!</h3>
                    <p style={{ fontSize: '13px', color: '#cbd5e1' }}>
                      Readiness Score: <strong>{recoveryResult.score}%</strong>. Central nervous system and muscles are recovered.
                    </p>
                  </div>
                )}
                <button style={{ ...styles.primaryBtn, backgroundColor: '#334155' }} onClick={() => setRecoveryResult(null)}>Retake Test</button>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ ...styles.tabHeading, margin: 0 }}>Workout History</h2>
              <button style={styles.exportBtn} onClick={exportToCSV}><Download size={14} style={{ marginRight: '4px' }} /> Export CSV</button>
            </div>

            {logs.map((log: WorkoutLog) => (
              <div key={log.id} style={styles.historyCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{log.exerciseName}</strong>
                    <span style={{ ...styles.tagBadge, marginLeft: '6px' }}>{log.category}</span>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>{log.date}</span>
                </div>
                {log.notes && <div style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', margin: '4px 0' }}>📝 "{log.notes}"</div>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {log.sets.map((s, idx) => (
                    <span key={idx} style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#fff', backgroundColor: s.passed ? '#22c55e' : '#ef4444' }}>
                      Set {s.setNumber}: {s.repsCompleted}/{s.targetReps}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RECS & DELOAD TAB */}
        {activeTab === 'recs' && (
          <div>
            <h2 style={styles.tabHeading}>Overload & Deload Analysis</h2>
            <div style={styles.card}>
              <label style={styles.label}>Type Exercise Name</label>
              <input style={styles.input} value={exerciseName} onChange={e => setExerciseName(e.target.value)} placeholder="e.g., Bench Press" />
              {exerciseName && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#334155', borderRadius: '6px' }}>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{getRecommendationAndDeload(exerciseName)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PERMANENT GUIDE TAB */}
        {activeTab === 'guide' && (
          <div>
            <h2 style={styles.tabHeading}>User Guide & Walkthrough</h2>
            
            <div style={styles.card}>
              <h3 style={{ color: '#38bdf8', marginTop: 0 }}>How to Use FitTrack</h3>
              <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
                Follow these simple steps to make the most of your training, volume tracking, and recovery management.
              </p>
            </div>

            {TUTORIAL_STEPS.map((step, idx) => (
              <div key={idx} style={{ ...styles.card, borderLeft: '4px solid #38bdf8' }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#f8fafc' }}>{step.title}</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>{step.desc}</p>
              </div>
            ))}

            <button style={styles.primaryBtn} onClick={() => { setTutorialStep(0); setShowModal(true); }}>
              Re-launch Interactive Tour
            </button>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav style={styles.nav}>
        <button style={activeTab === 'log' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('log')}>
          <Dumbbell size={18} />
          <span style={{ fontSize: '10px' }}>Log</span>
        </button>
        <button style={activeTab === 'plan' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('plan')}>
          <Calendar size={18} />
          <span style={{ fontSize: '10px' }}>Plan</span>
        </button>
        <button style={activeTab === 'recovery' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('recovery')}>
          <BatteryCharging size={18} />
          <span style={{ fontSize: '10px' }}>Recovery</span>
        </button>
        <button style={activeTab === 'history' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('history')}>
          <History size={18} />
          <span style={{ fontSize: '10px' }}>History</span>
        </button>
        <button style={activeTab === 'recs' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('recs')}>
          <Lightbulb size={18} />
          <span style={{ fontSize: '10px' }}>Recs</span>
        </button>
        <button style={activeTab === 'guide' ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab('guide')}>
          <HelpCircle size={18} />
          <span style={{ fontSize: '10px' }}>Guide</span>
        </button>
      </nav>
    </div>
  );
}

// Mobile Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: { maxWidth: '480px', margin: '0 auto', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  header: { padding: '16px', backgroundColor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' },
  streakBadge: { display: 'flex', alignItems: 'center', backgroundColor: '#334155', padding: '4px 10px', borderRadius: '16px', fontSize: '12px' },
  timerWidget: { backgroundColor: '#1e3a8a', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2563eb' },
  smallStopBtn: { backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' },
  content: { flex: 1, padding: '16px', paddingBottom: '80px' },
  tabHeading: { fontSize: '18px', marginBottom: '12px' },
  card: { backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', marginBottom: '16px' },
  historyCard: { backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', marginBottom: '8px', borderLeft: '4px solid #3b82f6' },
  label: { fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' },
  input: { width: '100%', padding: '10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' },
  primaryBtn: { width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', marginTop: '8px' },
  subBtn: { backgroundColor: 'transparent', color: '#38bdf8', border: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  weightBtn: { backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px', cursor: 'pointer', minWidth: '40px' },
  setRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid', borderRadius: '6px', marginBottom: '8px' },
  setContainerInput: { width: '60px', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#fff', textAlign: 'center' },
  timerBtn: { flex: 1, padding: '8px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  tagBadge: { backgroundColor: '#0f172a', border: '1px solid #334155', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', color: '#38bdf8' },
  exportBtn: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  nav: { position: 'fixed', bottom: 0, width: '100%', maxWidth: '480px', backgroundColor: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navBtn: { background: 'none', border: 'none', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  activeNavBtn: { background: 'none', border: 'none', color: '#38bdf8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '100%', position: 'relative' },
  closeModalBtn: { position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' },
  stepBtn: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' },
  stepBtnPrimary: { backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }
};