import type {
  Subject,
  StudyItem,
  StudyRecord,
  Theme,
  ThemeInput,
} from "../model";
export interface StudyRepository {
  listSubjects(): Promise<Subject[]>;
  createSubject(name: string): Promise<Subject>;
  renameSubject(id: string, name: string): Promise<Subject>;
  listThemes(): Promise<Theme[]>;
  getTheme(id: string): Promise<Theme | undefined>;
  createTheme(input: ThemeInput): Promise<Theme>;
  updateTheme(id: string, input: ThemeInput): Promise<Theme>;
  deleteTheme(id: string): Promise<void>;
  listItems(themeId?: string): Promise<StudyItem[]>;
  createItem(themeId: string, title: string): Promise<StudyItem>;
  updateItem(
    id: string,
    input: { title: string; completed: boolean },
  ): Promise<StudyItem>;
  deleteItem(id: string): Promise<void>;
  listRecords(themeId?: string): Promise<StudyRecord[]>;
  addRecord(themeId: string, note: string): Promise<StudyRecord>;
}
