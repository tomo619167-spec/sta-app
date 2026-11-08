import type { SubjectIconKey, SubjectIconSetting } from "../subject-icons";
import type {
  Subject,
  MasteryChange,
  FourLevel,
  StudyTarget,
  RecordOptions,
  StudyItem,
  StudyRecord,
  Theme,
  ThemeInput,
} from "../model";
export interface StudyRepository {
  listSubjectIcons(): Promise<SubjectIconSetting[]>;
  setSubjectIcon(
    subjectId: string,
    icon: SubjectIconKey | "auto",
  ): Promise<SubjectIconSetting>;
  listMasteryHistory(themeId?: string): Promise<MasteryChange[]>;
  setMastery(
    themeId: string,
    target: StudyTarget,
    level: FourLevel,
  ): Promise<MasteryChange>;
  listSubjects(): Promise<Subject[]>;
  createSubject(name: string): Promise<Subject>;
  renameSubject(id: string, name: string): Promise<Subject>;
  listThemes(): Promise<Theme[]>;
  getTheme(id: string): Promise<Theme | undefined>;
  createTheme(input: ThemeInput): Promise<Theme>;
  updateTheme(id: string, input: ThemeInput): Promise<Theme>;
  updateThemeGoal(id: string, goal: string): Promise<Theme>;
  moveItem(
    themeId: string,
    itemId: string,
    direction: "up" | "down",
  ): Promise<void>;
  importRoadmap(
    themeId: string,
    source: string,
    allowDuplicates?: boolean,
  ): Promise<StudyItem[]>;
  deleteTheme(id: string): Promise<void>;
  listItems(themeId?: string): Promise<StudyItem[]>;
  createItem(themeId: string, title: string, goal?: string): Promise<StudyItem>;
  updateItem(
    id: string,
    input: { title: string; completed: boolean; goal?: string },
  ): Promise<StudyItem>;
  deleteItem(id: string): Promise<void>;
  listRecords(themeId?: string): Promise<StudyRecord[]>;
  listTargetRecords(target: StudyTarget): Promise<StudyRecord[]>;
  addRecord(
    themeId: string,
    note: string,
    options?: RecordOptions,
  ): Promise<StudyRecord>;
}
