import Dexie, { type Table } from 'dexie';

export interface SetLog {
  setNumber: number;
  targetReps: number;
  repsCompleted: number;
  weight: number;
  passed: boolean;
  estimatedOneRepMax: number;
}

export interface WorkoutLog {
  id?: number;
  date: string; // YYYY-MM-DD
  exerciseName: string;
  category: string; // Push, Pull, Legs, Upper, Lower
  notes?: string;
  sets: SetLog[];
}

export interface PlannedWorkout {
  id?: number;
  date: string; // YYYY-MM-DD
  exerciseName: string;
  category: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
}

export interface StreakData {
  id: string;
  currentStreak: number;
  lastWorkoutDate: string;
}

export interface RecoveryLog {
  id?: number;
  date: string;
  sorenessLevel: number;
  sleepQuality: number;
  passedTest: boolean;
  readinessScore: number;
  recommendation: 'Train' | 'Rest More';
}

class WorkoutDatabase extends Dexie {
  logs!: Table<WorkoutLog>;
  plans!: Table<PlannedWorkout>;
  streak!: Table<StreakData>;
  recovery!: Table<RecoveryLog>;

  constructor() {
    super('WorkoutTrackerDB');
    this.version(3).stores({
      logs: '++id, date, exerciseName, category',
      plans: '++id, date, category',
      streak: 'id',
      recovery: '++id, date, recommendation'
    });
  }
}

export const db = new WorkoutDatabase();