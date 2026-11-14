import type { FocusCommand, FocusSession, FocusState } from "../focus";
import type { LearningDraft } from "../learning";
import type { FeedbackDraft, LearningFeedback } from "../learning-feedback";
import type { RoadmapDraft } from "../roadmap-draft";
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
  getFocusState(): Promise<FocusState>;
  updateFocus(command: FocusCommand, now?: number): Promise<FocusState>;
  listFocusSessions(): Promise<FocusSession[]>;
  deleteFocusSession(id: string): Promise<void>;
  getLearningDraft(key: string): Promise<LearningDraft | undefined>;
  saveLearningDraft(draft: LearningDraft): Promise<void>;
  saveLearningRecord(
    draft: LearningDraft,
    feedbackSource?: string,
  ): Promise<StudyRecord>;
  deleteRecord(id: string): Promise<void>;
  listFeedbacks(): Promise<LearningFeedback[]>;
  getFeedbackDraft(recordId: string): Promise<FeedbackDraft | undefined>;
  saveFeedbackDraft(draft: FeedbackDraft): Promise<void>;
  importFeedback(recordId: string, source: string): Promise<LearningFeedback>;

  getRoadmapDraft(themeId: string): Promise<RoadmapDraft | undefined>;
  saveRoadmapDraft(draft: RoadmapDraft): Promise<void>;
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
