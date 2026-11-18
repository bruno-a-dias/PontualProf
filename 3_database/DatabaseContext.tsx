import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ClassScheduleItem,
  Institution,
  PontoLogEntry,
  PontoRule,
  UserProfile,
} from '../1_types/types';
import {
  INITIAL_CLASSES_2027_1,
  INITIAL_INSTITUTIONS,
  INITIAL_PONTO_RULES,
  INITIAL_SEMESTERS,
  INITIAL_USER_PROFILE,
} from './seedData2027';
import { loadLocalDatabase, saveLocalDatabase } from './sqliteService';

interface DatabaseContextValue {
  activeSemester: string;
  semesters: string[];
  userProfile: UserProfile;
  institutions: Institution[];
  pontoRules: PontoRule[];
  classes: ClassScheduleItem[];
  pontoLogs: PontoLogEntry[];
  setActiveSemester: (sem: string) => void;
  addSemester: (sem: string, cloneCurrent: boolean) => void;
  updateUserProfile: (partial: Partial<UserProfile>) => void;
  upsertClass: (item: ClassScheduleItem) => void;
  deleteClass: (id: string) => void;
  upsertInstitution: (inst: Institution) => void;
  deleteInstitution: (id: string) => void;
  upsertPontoRule: (rule: PontoRule) => void;
  deletePontoRule: (id: string) => void;
  addPontoLog: (entry: Omit<PontoLogEntry, 'id'>) => void;
  resetToFactory2027: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSemester, setActiveSemester] = useState<string>('2027/1');
  const [semesters, setSemesters] = useState<string[]>(INITIAL_SEMESTERS);
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [institutions, setInstitutions] = useState<Institution[]>(INITIAL_INSTITUTIONS);
  const [pontoRules, setPontoRules] = useState<PontoRule[]>(INITIAL_PONTO_RULES);
  const [classes, setClasses] = useState<ClassScheduleItem[]>(INITIAL_CLASSES_2027_1);
  const [pontoLogs, setPontoLogs] = useState<PontoLogEntry[]>([]);

  useEffect(() => {
    loadLocalDatabase().then((saved) => {
      if (saved) {
        setActiveSemester(saved.activeSemester || '2027/1');
        setSemesters(saved.semesters || INITIAL_SEMESTERS);
        setUserProfile(saved.userProfile || INITIAL_USER_PROFILE);
        setInstitutions(saved.institutions || INITIAL_INSTITUTIONS);
        setPontoRules(saved.pontoRules || INITIAL_PONTO_RULES);
        setClasses(saved.classes || INITIAL_CLASSES_2027_1);
        setPontoLogs(saved.pontoLogs || []);
      }
    });
  }, []);

  useEffect(() => {
    saveLocalDatabase({
      activeSemester,
      semesters,
      userProfile,
      institutions,
      pontoRules,
      classes,
      pontoLogs,
    });
  }, [activeSemester, semesters, userProfile, institutions, pontoRules, classes, pontoLogs]);

  const updateUserProfile = (partial: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...partial }));
  };

  const upsertClass = (item: ClassScheduleItem) => {
    setClasses((prev) => {
      const idx = prev.findIndex((c) => c.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [...prev, item];
    });
  };

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const upsertInstitution = (inst: Institution) => {
    setInstitutions((prev) => {
      const idx = prev.findIndex((i) => i.id === inst.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = inst;
        return copy;
      }
      return [...prev, inst];
    });
  };

  const deleteInstitution = (id: string) => {
    setInstitutions((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const upsertPontoRule = (rule: PontoRule) => {
    setPontoRules((prev) => {
      const idx = prev.findIndex(
        (r) =>
          r.institutionId === rule.institutionId &&
          r.dayOfWeek === rule.dayOfWeek &&
          r.shift === rule.shift
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = rule;
        return copy;
      }
      return [...prev, rule];
    });
  };

  const deletePontoRule = (id: string) => {
    setPontoRules((prev) => prev.filter((r) => r.id !== id));
  };

  const addSemester = (sem: string, cloneCurrent: boolean) => {
    if (!semesters.includes(sem)) {
      setSemesters((prev) => [...prev, sem]);
      if (cloneCurrent) {
        const cloned = classes
          .filter((c) => c.semester === activeSemester)
          .map((c, idx) => ({
            ...c,
            id: `cls_${Date.now()}_${idx}`,
            semester: sem,
          }));
        setClasses((prev) => [...prev, ...cloned]);
      }
    }
    setActiveSemester(sem);
  };

  const addPontoLog = (entry: Omit<PontoLogEntry, 'id'>) => {
    setPontoLogs((prev) => [{ ...entry, id: `log_${Date.now()}` }, ...prev]);
  };

  const resetToFactory2027 = () => {
    setActiveSemester('2027/1');
    setSemesters(INITIAL_SEMESTERS);
    setInstitutions(INITIAL_INSTITUTIONS);
    setPontoRules(INITIAL_PONTO_RULES);
    setClasses(INITIAL_CLASSES_2027_1);
    setPontoLogs([]);
  };

  return (
    <DatabaseContext.Provider
      value={{
        activeSemester,
        semesters,
        userProfile,
        institutions,
        pontoRules,
        classes,
        pontoLogs,
        setActiveSemester,
        addSemester,
        updateUserProfile,
        upsertClass,
        deleteClass,
        upsertInstitution,
        deleteInstitution,
        upsertPontoRule,
        deletePontoRule,
        addPontoLog,
        resetToFactory2027,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase deve ser usado dentro de DatabaseProvider');
  return ctx;
};
